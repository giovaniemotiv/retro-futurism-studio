import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CortexClient, MentalCommandEvent } from "@/lib/cortexClient";
import { Brain, Power, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CortexConnectionProps {
  onMentalCommand?: (command: MentalCommandEvent) => void;
}

export const CortexConnection = ({ onMentalCommand }: CortexConnectionProps) => {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'initializing' | 'ready' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<MentalCommandEvent | null>(null);
  const [cortexClient, setCortexClient] = useState<CortexClient | null>(null);

  const handleConnect = async () => {
    // Trim credentials to remove any whitespace
    const trimmedClientId = clientId.trim();
    const trimmedClientSecret = clientSecret.trim();
    
    if (!trimmedClientId || !trimmedClientSecret) {
      toast({
        title: "Missing Credentials",
        description: "Please enter your Emotiv Client ID and Client Secret",
        variant: "destructive",
      });
      return;
    }

    //console.log('🔑 Connecting with Client ID:', trimmedClientId);
    //console.log('🔑 Client Secret length:', trimmedClientSecret.length, 'characters');

    setStatus('connecting');
    setError(null);

    try {
      const client = new CortexClient({
        clientId: trimmedClientId,
        clientSecret: trimmedClientSecret,
      });

      // Set up event handlers
      client.onConnectionStatus = (newStatus) => {
        //console.log('Connection status:', newStatus);
        if (newStatus === 'ready') {
          setStatus('ready');
          toast({
            title: "Connected!",
            description: "Successfully connected to Emotiv Cortex",
          });
        } else if (newStatus === 'initializing') {
          setStatus('initializing');
        } else if (newStatus === 'error') {
          setStatus('error');
        }
      };

      client.onMentalCommand = (event) => {
        //console.log('Mental command:', event);
        setLastCommand(event);
        onMentalCommand?.(event);
      };

      client.onError = (errorMessage) => {
        console.error('Cortex error:', errorMessage);
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      };

      setCortexClient(client);
      await client.initialize();

    } catch (err) {
      console.error('Connection error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to connect to Cortex');
      toast({
        title: "Connection Failed",
        description: "Make sure Emotiv Launcher is running and your credentials are correct",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    if (cortexClient) {
      cortexClient.disconnect();
      setCortexClient(null);
    }
    setStatus('disconnected');
    setLastCommand(null);
    toast({
      title: "Disconnected",
      description: "Disconnected from Emotiv Cortex",
    });
  };

  useEffect(() => {
    return () => {
      if (cortexClient) {
        cortexClient.disconnect();
      }
    };
  }, [cortexClient]);

  const getStatusIcon = () => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-5 w-5 text-primary animate-pulse-glow" />;
      case 'connecting':
      case 'initializing':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Power className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ready':
        return 'Connected & Ready';
      case 'connecting':
        return 'Connecting...';
      case 'initializing':
        return 'Initializing Session...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Not Connected';
    }
  };

  return (
    <Card className="p-6 border-primary/30 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          Cortex Connection
        </h3>
      </div>

      <Alert className="mb-6 border-primary/30 bg-primary/5">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm text-muted-foreground">
          <strong>Run locally required:</strong> You must run this app on your computer 
          (not Lovable preview) because Cortex uses wss://localhost:6868.
          Get credentials from{" "}
          <a 
            href="https://www.emotiv.com/my-account/cortex-apps/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Emotiv Developer Portal
          </a>
          {". Make sure Emotiv Launcher is running."}
        </AlertDescription>
      </Alert>

      {status === 'disconnected' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="clientId" className="text-sm uppercase tracking-wider">
              Client ID
            </Label>
            <Input
              id="clientId"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value.trim())}
              placeholder="Enter your Emotiv Client ID"
              className="mt-2 font-mono"
            />
          </div>

          <div>
            <Label htmlFor="clientSecret" className="text-sm uppercase tracking-wider">
              Client Secret
            </Label>
            <Input
              id="clientSecret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value.trim())}
              placeholder="Enter your Emotiv Client Secret"
              className="mt-2 font-mono"
            />
          </div>

          <Button
            onClick={handleConnect}
            className="w-full bg-primary hover:bg-primary/90 font-bold uppercase tracking-wider"
          >
            Connect to Cortex
          </Button>
        </div>
      )}

      {(status !== 'disconnected') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/50">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <div className="text-sm font-bold uppercase tracking-wider">
                  {getStatusText()}
                </div>
                {status === 'ready' && lastCommand && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Last Command: <span className="text-primary font-mono">{lastCommand.com}</span> 
                    {" "}(Power: {(lastCommand.pow * 100).toFixed(0)}%)
                  </div>
                )}
              </div>
            </div>
            {status === 'ready' && (
              <Button
                onClick={handleDisconnect}
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                Disconnect
              </Button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Card>
  );
};
