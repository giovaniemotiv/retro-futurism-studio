import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MultiHeadsetCortexClient, MentalCommandEvent, MotionEvent, PerformanceMetricsEvent } from '@/lib/multiHeadsetCortexClient';

interface CortexContextType {
  client: MultiHeadsetCortexClient | null;
  status: 'disconnected' | 'connecting' | 'initializing' | 'ready' | 'error';
  connectedHeadsets: string[];
  connect: (clientId: string, clientSecret: string) => Promise<MultiHeadsetCortexClient>;
  disconnect: () => void;
}

const CortexContext = createContext<CortexContextType | null>(null);

export const useCortex = () => {
  const context = useContext(CortexContext);
  if (!context) {
    throw new Error('useCortex must be used within CortexProvider');
  }
  return context;
};

interface CortexProviderProps {
  children: ReactNode;
}

export const CortexProvider = ({ children }: CortexProviderProps) => {
  const [client, setClient] = useState<MultiHeadsetCortexClient | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'initializing' | 'ready' | 'error'>('disconnected');
  const [connectedHeadsets, setConnectedHeadsets] = useState<string[]>([]);

  const connect = async (clientId: string, clientSecret: string): Promise<MultiHeadsetCortexClient> => {
    if (client) {
      console.warn('Already connected to Cortex');
      return client;
    }

    setStatus('connecting');

    const newClient = new MultiHeadsetCortexClient({
      clientId,
      clientSecret,
    });

    // Set up event handlers that dispatch to window
    newClient.onConnectionStatus = (newStatus) => {
      //console.log('🔌 CortexContext connection status:', newStatus);
      setStatus(newStatus as any);
    };

    newClient.onMentalCommand = (event: MentalCommandEvent) => {
      // High-frequency log removed for performance
      window.dispatchEvent(new CustomEvent('mental-command', { detail: event }));
    };

    newClient.onMotion = (event: MotionEvent) => {
      // High-frequency log removed for performance
      window.dispatchEvent(new CustomEvent('motion-event', { detail: event }));
    };

    newClient.onPerformanceMetrics = (event: PerformanceMetricsEvent) => {
      // High-frequency log removed for performance
      window.dispatchEvent(new CustomEvent('performance-metrics', { detail: event }));
    };

    newClient.onHeadsetStatus = (headsetId: string, headsetStatus: string) => {
      //console.log(`🎧 Headset ${headsetId} status: ${headsetStatus}`);
      // Update connected headsets list
      setConnectedHeadsets((prev) => {
        if (headsetStatus === 'ready' && !prev.includes(headsetId)) {
          return [...prev, headsetId];
        } else if (headsetStatus !== 'ready' && prev.includes(headsetId)) {
          return prev.filter((id) => id !== headsetId);
        }
        return prev;
      });
    };

    newClient.onError = (error: string) => {
      console.error('❌ CortexContext error:', error);
      setStatus('error');
    };

    setClient(newClient);

    try {
      await newClient.initialize();
      //console.log('✅ CortexContext: Client initialized successfully');
      return newClient;
    } catch (err) {
      console.error('Failed to initialize Cortex:', err);
      setStatus('error');
      throw err;
    }
  };

  const disconnect = () => {
    if (client) {
      //console.log('🔌 CortexContext disconnecting...');
      client.disconnect();
      setClient(null);
      setStatus('disconnected');
      setConnectedHeadsets([]);
    }
  };

  // CRITICAL: Do NOT disconnect on unmount - keep connection alive
  // The client persists until explicitly disconnected or app closes
  
  const value: CortexContextType = {
    client,
    status,
    connectedHeadsets,
    connect,
    disconnect,
  };

  return <CortexContext.Provider value={value}>{children}</CortexContext.Provider>;
};
