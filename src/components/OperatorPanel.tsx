import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Settings, Zap, Target } from "lucide-react";

interface OperatorPanelProps {
  sessionId: string;
  connectedHeadsets: string[];
  currentLevel: number;
  onControlsChange?: (controls: OperatorControls) => void;
}

export interface OperatorControls {
  pushSensitivity: number;
  autoCycleSpeed: number;
  manualSelection: {
    headsetId: string | null;
    imageId: number | null;
    level: number | null;
  };
}

export const OperatorPanel = ({ 
  sessionId, 
  connectedHeadsets, 
  currentLevel,
  onControlsChange 
}: OperatorPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pushSensitivity, setPushSensitivity] = useState(0.30);
  const [autoCycleSpeed, setAutoCycleSpeed] = useState(6000);
  const [selectedHeadset, setSelectedHeadset] = useState<string>("");
  const [manualImageId, setManualImageId] = useState<number | null>(null);

  // Subscribe to operator controls changes
  useEffect(() => {
    const channel = supabase
      .channel(`operator-controls-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operator_controls',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          //console.log('📡 Operator controls updated:', payload);
          if (payload.new) {
            const controls = payload.new as any;
            if (controls.push_sensitivity !== null) {
              setPushSensitivity(controls.push_sensitivity);
            }
            if (controls.auto_cycle_speed !== null) {
              setAutoCycleSpeed(controls.auto_cycle_speed);
            }
            
            if (onControlsChange) {
              onControlsChange({
                pushSensitivity: controls.push_sensitivity ?? 0.30,
                autoCycleSpeed: controls.auto_cycle_speed ?? 6000,
                manualSelection: {
                  headsetId: controls.manual_selection_headset_id,
                  imageId: controls.manual_selection_image_id,
                  level: controls.manual_selection_level
                }
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, onControlsChange]);

  const updateControls = async (updates: Partial<OperatorControls>) => {
    const { data, error } = await supabase
      .from('operator_controls')
      .upsert({
        session_id: sessionId,
        push_sensitivity: updates.pushSensitivity ?? pushSensitivity,
        auto_cycle_speed: updates.autoCycleSpeed ?? autoCycleSpeed,
        manual_selection_headset_id: updates.manualSelection?.headsetId ?? null,
        manual_selection_image_id: updates.manualSelection?.imageId ?? null,
        manual_selection_level: updates.manualSelection?.level ?? null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_id'
      });

    if (error) {
      console.error('Error updating operator controls:', error);
    } else {
      //console.log('✅ Operator controls updated');
    }
  };

  const handleSensitivityChange = (value: number[]) => {
    const newSensitivity = value[0];
    setPushSensitivity(newSensitivity);
    updateControls({ pushSensitivity: newSensitivity });
  };

  const handleSpeedChange = (value: number[]) => {
    const newSpeed = value[0];
    setAutoCycleSpeed(newSpeed);
    updateControls({ autoCycleSpeed: newSpeed });
  };

  const handleManualSelection = (imageId: number) => {
    if (!selectedHeadset) return;
    
    setManualImageId(imageId);
    updateControls({
      manualSelection: {
        headsetId: selectedHeadset,
        imageId,
        level: currentLevel
      }
    });
  };

  return (
    <>
      {/* Operator toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-20 right-4 z-50 p-3 bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg hover:border-primary/60 transition-all"
      >
        <Settings className="w-5 h-5 text-primary" />
      </button>

      {/* Operator panel */}
      {isOpen && (
        <div className="fixed top-32 right-4 z-50 w-80 bg-card/95 backdrop-blur-md border border-primary/30 rounded-lg p-4 shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-bold text-primary uppercase tracking-wider">
                Operator Controls
              </h3>
            </div>

            {/* Push Sensitivity */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                Push Sensitivity: {pushSensitivity.toFixed(2)}
              </label>
              <Slider
                value={[pushSensitivity]}
                onValueChange={handleSensitivityChange}
                min={0.1}
                max={0.5}
                step={0.05}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Lower = easier to trigger
              </p>
            </div>

            {/* Auto-Cycle Speed */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Auto-Cycle Speed: {(autoCycleSpeed / 1000).toFixed(1)}s
              </label>
              <Slider
                value={[autoCycleSpeed]}
                onValueChange={handleSpeedChange}
                min={2000}
                max={10000}
                step={1000}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Time between image advances
              </p>
            </div>

            {/* Manual Selection */}
            <div className="space-y-2 border-t border-border pt-4">
              <label className="text-sm text-muted-foreground font-semibold">
                Manual Selection
              </label>
              
              {/* Headset selector */}
              <select
                value={selectedHeadset}
                onChange={(e) => setSelectedHeadset(e.target.value)}
                className="w-full p-2 bg-background border border-border rounded text-foreground"
              >
                <option value="">Select Headset</option>
                {connectedHeadsets.map((headsetId) => (
                  <option key={headsetId} value={headsetId}>
                    {headsetId}
                  </option>
                ))}
              </select>

              {/* Image ID input */}
              <input
                type="number"
                placeholder="Image ID (1-9)"
                onChange={(e) => setManualImageId(parseInt(e.target.value))}
                className="w-full p-2 bg-background border border-border rounded text-foreground"
                min={1}
                max={9}
              />

              <Button
                onClick={() => manualImageId && handleManualSelection(manualImageId)}
                disabled={!selectedHeadset || !manualImageId}
                className="w-full"
              >
                Force Selection
              </Button>
            </div>

            {/* Status */}
            <div className="text-xs text-muted-foreground border-t border-border pt-2">
              <p>Level: {currentLevel}</p>
              <p>Connected: {connectedHeadsets.length} headsets</p>
              <p>Session: {sessionId.slice(0, 8)}...</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
