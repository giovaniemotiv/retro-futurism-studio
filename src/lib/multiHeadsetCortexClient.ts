/**
 * Multi-Headset Emotiv Cortex API WebSocket Client
 * Supports connecting to and managing multiple headsets simultaneously
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
  headsetId: string; // Which headset this command came from
}

export interface MotionEvent {
  pitch: number;     // Vertical head tilt (look up/down) - Y cursor control
  roll: number;      // Side-to-side head tilt
  rotation: number;  // Horizontal head turn (left/right) - X cursor control
  accX: number;      // Acceleration X
  accY: number;      // Acceleration Y
  accZ: number;      // Acceleration Z
  time: number;
  headsetId: string;
}

export interface PerformanceMetricsEvent {
  excitement: number;   // 0-1 scale
  engagement: number;   // 0-1 scale
  stress: number;       // 0-1 scale
  relaxation: number;   // 0-1 scale
  interest: number;     // 0-1 scale
  focus: number;        // 0-1 scale
  time: number;
  headsetId: string;
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

export interface HeadsetSession {
  headsetId: string;
  sessionId: string;
  status: 'connecting' | 'ready' | 'error';
}

export class MultiHeadsetCortexClient {
  private ws: WebSocket | null = null;
  private config: CortexConfig;
  private authToken: string | null = null;
  private requestId = 0;
  
  // Track multiple sessions - one per headset
  private sessions: Map<string, HeadsetSession> = new Map();
  
  // Store the metrics columns schema from subscription response
  private metricsCols: string[] = [];
  
  private callbacks: Map<number, (response: any) => void> = new Map();
  public onMentalCommand: ((event: MentalCommandEvent) => void) | null = null;
  public onMotion: ((event: MotionEvent) => void) | null = null;
  public onPerformanceMetrics: ((event: PerformanceMetricsEvent) => void) | null = null;
  public onConnectionStatus: ((status: string) => void) | null = null;
  public onHeadsetStatus: ((headsetId: string, status: string) => void) | null = null;
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
    // High-frequency logs removed for performance

    // Handle responses to requests
    if (message.id !== undefined && this.callbacks.has(message.id)) {
      const callback = this.callbacks.get(message.id);
      callback?.(message);
      this.callbacks.delete(message.id);
      return;
    }

    // Handle mental command data stream
    if (message.com !== undefined) {
      // Find which headset this command is from based on session ID in the message
      const headsetId = message.sid ? this.getHeadsetIdBySessionId(message.sid) : 'unknown';
      
      const event: MentalCommandEvent = {
        com: message.com[0], // Command name
        pow: message.com[1], // Power level
        time: message.time,
        headsetId: headsetId
      };
      this.onMentalCommand?.(event);
    }

    // Handle motion sensor data stream
    if (message.mot !== undefined && Array.isArray(message.mot)) {
      const headsetId = message.sid ? this.getHeadsetIdBySessionId(message.sid) : 'unknown';
      
      // 🔧 FIXED: Correct motion data format from Emotiv Cortex API
      // Documentation: https://emotiv.gitbook.io/cortex-api/data-subscription/motion-data
      // Format: [COUNTER_MEMS, INTERPOLATED_MEMS, Q0, Q1, Q2, Q3, ACCX, ACCY, ACCZ, MAGX, MAGY, MAGZ]
      const [counter, interp, q0, q1, q2, q3, accX, accY, accZ, magX, magY, magZ] = message.mot;
      
      // Convert quaternion to Euler angles (in degrees)
      // Pitch: vertical head tilt (look up/down) - maps to Y cursor
      const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (q0 * q2 - q3 * q1)))) * (180 / Math.PI);
      
      // Rotation (Yaw): horizontal head turn (left/right) - maps to X cursor
      const rotation = Math.atan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (q2 * q2 + q3 * q3)) * (180 / Math.PI);
      
      // Roll: side-to-side head tilt
      const roll = Math.atan2(2 * (q0 * q1 + q2 * q3), 1 - 2 * (q1 * q1 + q2 * q2)) * (180 / Math.PI);
      
      const event: MotionEvent = {
        pitch,
        roll,
        rotation,
        accX: accX || 0,
        accY: accY || 0,
        accZ: accZ || 0,
        time: message.time,
        headsetId
      };
      
      this.onMotion?.(event);
    }

    // Handle performance metrics stream (excitement, engagement, etc.)
    if (message.met !== undefined && Array.isArray(message.met)) {
      const headsetId = message.sid ? this.getHeadsetIdBySessionId(message.sid) : 'unknown';
      
      // Build a map from the met array using the cols schema
      // met array format from Emotiv: [eng.isActive, eng, exc.isActive, exc, lex, str.isActive, str, rel.isActive, rel, int.isActive, int, attention.isActive, attention]
      const metMap: Record<string, any> = {};
      
      if (this.metricsCols.length > 0) {
        this.metricsCols.forEach((colName, index) => {
          metMap[colName] = message.met[index];
        });
      }
      
      // High-frequency performance metrics logs removed
      
      // Only use values when their corresponding .isActive flag is true
      const engagement = metMap['eng.isActive'] && metMap['eng'] !== null ? metMap['eng'] : 0;
      const excitement = metMap['exc.isActive'] && metMap['exc'] !== null ? metMap['exc'] : 0;
      const longTermExcitement = metMap['lex'] !== null ? metMap['lex'] : 0;
      const stress = metMap['str.isActive'] && metMap['str'] !== null ? metMap['str'] : 0;
      const relaxation = metMap['rel.isActive'] && metMap['rel'] !== null ? metMap['rel'] : 0;
      const interest = metMap['int.isActive'] && metMap['int'] !== null ? metMap['int'] : 0;
      const attention = metMap['attention.isActive'] && metMap['attention'] !== null ? metMap['attention'] : 0;
      
      const event: PerformanceMetricsEvent = {
        engagement,
        excitement,
        stress,
        relaxation,
        interest,
        focus: attention, // Map 'attention' to 'focus' for our interface
        time: message.time,
        headsetId: headsetId
      };
      
      // High-frequency dispatch log removed
      this.onPerformanceMetrics?.(event);
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
   * Helper to find headset ID by session ID
   */
  private getHeadsetIdBySessionId(sessionId: string): string {
    for (const [headsetId, session] of this.sessions.entries()) {
      if (session.sessionId === sessionId) {
        return headsetId;
      }
    }
    return 'unknown';
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
   * Get Cortex Info
   */
  async getCortexInfo(): Promise<any> {
    const result = await this.sendRequest('getCortexInfo');
    //console.log('ℹ️ Cortex Info:', result);
    return result;
  }

  /**
   * Request Access (authorize with Emotiv account)
   */
  async requestAccess(): Promise<void> {
    const result = await this.sendRequest('requestAccess', {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret
    });
    //console.log('🔑 Access requested:', result);
  }

  /**
   * Authorize and get auth token
   */
  async authorize(): Promise<string> {
    const result = await this.sendRequest('authorize', {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      license: this.config.licenseId || '',
      debit: 10 // Debit sessions from license (enough for multiple headsets)
    });
    
    this.authToken = result.cortexToken;
    //console.log('✅ Authorized, token received');
    return this.authToken;
  }

  /**
   * Query all available headsets
   */
  async queryHeadsets(): Promise<HeadsetInfo[]> {
    const result = await this.sendRequest('queryHeadsets');
    //console.log('🎧 Available headsets:', result);
    return result || [];
  }

  /**
   * Connect to a specific headset
   */
  async connectHeadset(headsetId: string): Promise<void> {
    this.onHeadsetStatus?.(headsetId, 'connecting');
    
    const result = await this.sendRequest('controlDevice', {
      command: 'connect',
      headset: headsetId
    });
    
    //console.log(`🎧 Headset ${headsetId} connection initiated:`, result);
  }

  /**
   * Create a session for a specific headset
   */
  async createSession(headsetId: string): Promise<string> {
    if (!this.authToken) {
      throw new Error('Not authorized. Call authorize() first.');
    }

    const result = await this.sendRequest('createSession', {
      cortexToken: this.authToken,
      headset: headsetId,
      status: 'active'
    });

    const sessionId = result.id;
    this.sessions.set(headsetId, {
      headsetId,
      sessionId,
      status: 'ready'
    });
    
    //console.log(`✅ Session created for headset ${headsetId}:`, sessionId);
    return sessionId;
  }

  /**
   * Subscribe to mental commands and motion data for a specific headset session
   */
  async subscribeMentalCommands(headsetId: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('Must be authorized');
    }

    const session = this.sessions.get(headsetId);
    if (!session) {
      throw new Error(`No session found for headset ${headsetId}`);
    }

    //console.log(`🔔 Subscribing to streams for headset ${headsetId}, session: ${session.sessionId}`);
    
    const result = await this.sendRequest('subscribe', {
      cortexToken: this.authToken,
      session: session.sessionId,
      streams: ['com', 'mot', 'met'] // Mental commands + motion sensors + performance metrics
    });

    //console.log(`✅ Subscribed to streams for headset ${headsetId}:`, JSON.stringify(result, null, 2));
    
    // Extract and store the 'met' columns schema from subscription response
    if (result.success && Array.isArray(result.success)) {
      const metStream = result.success.find((s: any) => s.streamName === 'met');
      if (metStream && metStream.cols) {
        this.metricsCols = metStream.cols;
        //console.log(`📋 Stored 'met' columns schema:`, this.metricsCols);
      }
    }
    
    //console.log(`📊 Performance metrics ('met') should now be streaming at 2Hz`);
  }

  /**
   * Load mental command profile for a specific headset (optional)
   */
  async loadProfile(headsetId: string, profileName: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('Must be authorized');
    }

    const result = await this.sendRequest('setupProfile', {
      cortexToken: this.authToken,
      headset: headsetId,
      profile: profileName,
      status: 'load'
    });

    //console.log(`✅ Profile loaded for headset ${headsetId}:`, result);
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
    return result || [];
  }

  /**
   * Initialize and connect to a specific headset
   */
  async initializeHeadset(headsetId: string): Promise<void> {
    try {
      this.onHeadsetStatus?.(headsetId, 'connecting');
      
      // Check if headset is already connected
      const headsets = await this.queryHeadsets();
      const headset = headsets.find(h => h.id === headsetId);
      
      if (!headset) {
        throw new Error(`Headset ${headsetId} not found`);
      }
      
      if (headset.status !== 'connected') {
        await this.connectHeadset(headsetId);
        // Wait for connection to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Create session
      await this.createSession(headsetId);
      
      // Try to load a profile (optional)
      try {
        const profiles = await this.queryProfile();
        if (profiles.length > 0) {
          await this.loadProfile(headsetId, profiles[0]);
        }
      } catch (error) {
        //console.log(`No profiles found for headset ${headsetId}, continuing without profile`);
      }
      
      // Subscribe to mental commands
      await this.subscribeMentalCommands(headsetId);
      
      this.onHeadsetStatus?.(headsetId, 'ready');
      //console.log(`🎉 Headset ${headsetId} fully initialized and ready!`);
      
    } catch (error) {
      console.error(`❌ Initialization failed for headset ${headsetId}:`, error);
      this.onHeadsetStatus?.(headsetId, 'error');
      throw error;
    }
  }

  /**
   * Initialize connection and authenticate (call this first)
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
      
      this.onConnectionStatus?.('ready');
      //console.log('🎉 Cortex client authenticated and ready!');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.onConnectionStatus?.('error');
      throw error;
    }
  }

  /**
   * Get all available headsets
   */
  getAvailableHeadsets(): Promise<HeadsetInfo[]> {
    return this.queryHeadsets();
  }

  /**
   * Get all connected sessions
   */
  getConnectedSessions(): Map<string, HeadsetSession> {
    return new Map(this.sessions);
  }

  /**
   * Disconnect a specific headset
   */
  async disconnectHeadset(headsetId: string): Promise<void> {
    const session = this.sessions.get(headsetId);
    if (session) {
      // Could add session closing logic here if needed
      this.sessions.delete(headsetId);
      this.onHeadsetStatus?.(headsetId, 'disconnected');
      //console.log(`🔌 Headset ${headsetId} disconnected`);
    }
  }

  /**
   * Disconnect all and cleanup
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.authToken = null;
    this.sessions.clear();
    //console.log('🔌 Disconnected from Cortex');
  }
}
