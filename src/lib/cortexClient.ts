/**
 * Emotiv Cortex API WebSocket Client
 * Connects to local Cortex service at wss://localhost:6868
 */

export interface CortexConfig {
  clientId: string;
  clientSecret: string;
  licenseId?: string;
}

export interface MentalCommandEvent {
  com: string; // Mental command (e.g., "push", "pull", "left", "right", "lift", "drop", "neutral")
  pow: number; // Power/confidence level (0-1)
  time: number;
}

export interface HeadsetInfo {
  id: string;
  status: string;
  connectedBy?: string;
  dongleSerial?: string;
  firmware?: string;
  motionSensors?: string[];
  sensors?: string[];
  settings?: {
    eegRate: number;
    mode: string;
  };
}

export class CortexClient {
  private ws: WebSocket | null = null;
  private config: CortexConfig;
  private authToken: string | null = null;
  private sessionId: string | null = null;
  private requestId = 0;
  private headsetId: string | null = null;
  
  private callbacks: Map<number, (response: any) => void> = new Map();
  public onMentalCommand: ((event: MentalCommandEvent) => void) | null = null;
  public onConnectionStatus: ((status: string) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  constructor(config: CortexConfig) {
    this.config = config;
  }

  /**
   * Connect to Cortex WebSocket API
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      //console.log('🔌 Connecting to Cortex API at wss://localhost:6868...');
      
      this.ws = new WebSocket('wss://localhost:6868');

      this.ws.onopen = () => {
        //console.log('✅ WebSocket connected');
        this.onConnectionStatus?.('connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.onError?.('Failed to connect to Cortex service. Make sure Emotiv Launcher is running.');
        reject(error);
      };

      this.ws.onclose = () => {
        //console.log('🔌 WebSocket disconnected');
        this.onConnectionStatus?.('disconnected');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any) {
    // High-frequency log removed for performance

    // Handle responses to requests
    if (message.id !== undefined && this.callbacks.has(message.id)) {
      const callback = this.callbacks.get(message.id);
      callback?.(message);
      this.callbacks.delete(message.id);
      return;
    }

    // Handle mental command data stream
    if (message.com !== undefined) {
      const event: MentalCommandEvent = {
        com: message.com[0], // Command name
        pow: message.com[1], // Power level
        time: message.time
      };
      this.onMentalCommand?.(event);
    }

    // Handle warnings and errors
    if (message.warning) {
      console.warn('⚠️ Cortex warning:', message.warning);
    }
    if (message.error) {
      console.error('❌ Cortex error:', message.error);
      this.onError?.(message.error.message);
    }
  }

  /**
   * Send a request to Cortex API
   */
  private sendRequest(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        method,
        params,
        id
      };

      //console.log('📤 Sending:', request);

      this.callbacks.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Step 1: Get Cortex Info
   */
  async getCortexInfo(): Promise<any> {
    const result = await this.sendRequest('getCortexInfo');
    //console.log('ℹ️ Cortex Info:', result);
    return result;
  }

  /**
   * Step 2: Request Access (authorize with Emotiv account)
   */
  async requestAccess(): Promise<void> {
    const result = await this.sendRequest('requestAccess', {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret
    });
    //console.log('🔑 Access requested:', result);
  }

  /**
   * Step 3: Authorize and get auth token
   */
  async authorize(): Promise<string> {
    const result = await this.sendRequest('authorize', {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      license: this.config.licenseId || '',
      debit: 5 // Debit 5 sessions from your Emotiv license
    });
    
    this.authToken = result.cortexToken;
    //console.log('✅ Authorized, token received');
    return this.authToken;
  }

  /**
   * Step 4: Query available headsets
   */
  async queryHeadsets(): Promise<HeadsetInfo[]> {
    const result = await this.sendRequest('queryHeadsets');
    //console.log('🎧 Available headsets:', result);
    
    if (result && result.length > 0) {
      this.headsetId = result[0].id;
    }
    
    return result;
  }

  /**
   * Step 5: Connect to headset (if not already connected)
   */
  async connectHeadset(headsetId?: string): Promise<void> {
    const id = headsetId || this.headsetId;
    if (!id) {
      throw new Error('No headset ID provided');
    }

    const result = await this.sendRequest('controlDevice', {
      command: 'connect',
      headset: id
    });
    
    //console.log('🎧 Headset connection initiated:', result);
  }

  /**
   * Step 6: Create a session
   */
  async createSession(headsetId?: string): Promise<string> {
    if (!this.authToken) {
      throw new Error('Not authorized. Call authorize() first.');
    }

    const id = headsetId || this.headsetId;
    if (!id) {
      throw new Error('No headset connected');
    }

    const result = await this.sendRequest('createSession', {
      cortexToken: this.authToken,
      headset: id,
      status: 'active'
    });

    this.sessionId = result.id;
    //console.log('✅ Session created:', this.sessionId);
    return this.sessionId;
  }

  /**
   * Step 7: Subscribe to mental command data
   */
  async subscribeMentalCommands(): Promise<void> {
    if (!this.authToken || !this.sessionId) {
      throw new Error('Must be authorized and have an active session');
    }

    const result = await this.sendRequest('subscribe', {
      cortexToken: this.authToken,
      session: this.sessionId,
      streams: ['com'] // Mental commands stream
    });

    //console.log('✅ Subscribed to mental commands:', result);
  }

  /**
   * Load mental command profile (optional - if user has trained commands)
   */
  async loadProfile(profileName: string): Promise<void> {
    if (!this.authToken || !this.headsetId) {
      throw new Error('Must be authorized and have a headset connected');
    }

    const result = await this.sendRequest('setupProfile', {
      cortexToken: this.authToken,
      headset: this.headsetId,
      profile: profileName,
      status: 'load'
    });

    //console.log('✅ Profile loaded:', result);
  }

  /**
   * Get list of trained profiles
   */
  async queryProfile(): Promise<string[]> {
    if (!this.authToken) {
      throw new Error('Not authorized');
    }

    const result = await this.sendRequest('queryProfile', {
      cortexToken: this.authToken
    });

    //console.log('📋 Available profiles:', result);
    return result;
  }

  /**
   * Complete initialization flow
   */
  async initialize(): Promise<void> {
    try {
      this.onConnectionStatus?.('initializing');
      
      // Connect to WebSocket
      await this.connect();
      
      // Get Cortex info
      await this.getCortexInfo();
      
      // Request access
      await this.requestAccess();
      
      // Authorize
      await this.authorize();
      
      // Query and connect to headset
      const headsets = await this.queryHeadsets();
      if (headsets.length === 0) {
        throw new Error('No headsets found. Please turn on your Emotiv headset.');
      }
      
      // Check if headset is already connected
      if (headsets[0].status !== 'connected') {
        await this.connectHeadset(headsets[0].id);
        // Wait a bit for connection to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Create session
      await this.createSession();
      
      // Try to load a profile (optional)
      try {
        const profiles = await this.queryProfile();
        if (profiles.length > 0) {
          await this.loadProfile(profiles[0]);
        }
      } catch (error) {
        //console.log('No profiles found or failed to load, continuing without profile');
      }
      
      // Subscribe to mental commands
      await this.subscribeMentalCommands();
      
      this.onConnectionStatus?.('ready');
      //console.log('🎉 Cortex client fully initialized and ready!');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.onConnectionStatus?.('error');
      throw error;
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authToken = null;
    this.sessionId = null;
    this.headsetId = null;
    //console.log('🔌 Disconnected from Cortex');
  }
}
