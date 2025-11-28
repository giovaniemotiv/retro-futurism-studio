import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Music, Volume2, Play, Pause } from "lucide-react";
import { getHeadsetColor } from "@/utils/headsetColors";
import { getSoundtrackByScore } from "@/data/soundtracks";
import { Brain3D } from "@/components/Brain3D";
import { CollectiveExcitementCore } from "@/components/CollectiveExcitementCore";
import type { PerformanceMetricsEvent } from "@/lib/multiHeadsetCortexClient";

const AudioEmotion = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const { 
    videoJobId,
    metadata,
    connectedHeadsets,
    level3Selections,
    performanceMetrics: passedMetrics
  } = location.state || {};

  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetricsEvent | null>(passedMetrics || null);
  const [excitementLevels, setExcitementLevels] = useState<Map<string, number>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [clipExcitementScores, setClipExcitementScores] = useState<Map<number, number[]>>(new Map());
  const [playbackStartTime, setPlaybackStartTime] = useState<number | null>(null);

  // Audio clip duration (20 seconds per clip)
  const CLIP_DURATION_MS = 20000;
  const TOTAL_CLIPS = 3; // Number of audio clips to play

  // Calculate average excitement for brain visualization
  const averageExcitement = Array.from(excitementLevels.values()).reduce((sum, val) => sum + val, 0) / Math.max(excitementLevels.size, 1);

  // Listen to real-time performance metrics via window events
  useEffect(() => {
    const handlePerformanceMetrics = ((event: CustomEvent<PerformanceMetricsEvent>) => {
      //console.log('📊 AudioEmotion received performance metrics event:', event.detail);
      setPerformanceMetrics(event.detail);
      
      // Update emotion levels from excitement, interest, and focus
      const { excitement, interest, focus, headsetId } = event.detail;
      const combinedScore = (excitement + interest + focus) / 3;
      
      //console.log(`🎵 EMOTION: ${headsetId} - excitement=${excitement.toFixed(2)}, interest=${interest.toFixed(2)}, focus=${focus.toFixed(2)}, combined=${combinedScore.toFixed(2)}`);
      
      setExcitementLevels(prev => new Map(prev).set(headsetId, combinedScore));
    }) as EventListener;
    
    window.addEventListener('performance-metrics', handlePerformanceMetrics);
    //console.log('✅ AudioEmotion event listener registered');
    
    return () => {
      window.removeEventListener('performance-metrics', handlePerformanceMetrics);
    };
  }, []);

  // Record excitement scores while audio is playing
  useEffect(() => {
    if (!isPlaying || playbackStartTime === null) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - playbackStartTime;
      
      // Record current excitement levels
      setClipExcitementScores(prev => {
        const scores = prev.get(currentClipIndex) || [];
        const currentScore = averageExcitement;
        return new Map(prev).set(currentClipIndex, [...scores, currentScore]);
      });

      // Check if clip duration has elapsed
      if (elapsed >= CLIP_DURATION_MS) {
        handleClipComplete();
      }
    }, 500); // Sample excitement every 500ms

    return () => clearInterval(interval);
  }, [isPlaying, playbackStartTime, currentClipIndex, averageExcitement]);

  const handleClipComplete = () => {
    setIsPlaying(false);
    setPlaybackStartTime(null);

    // Move to next clip or finish
    if (currentClipIndex < TOTAL_CLIPS - 1) {
      setTimeout(() => {
        setCurrentClipIndex(prev => prev + 1);
        startPlayback();
      }, 2000); // 2 second pause between clips
    } else {
      // All clips complete - calculate final score
      finishAudioEmotion();
    }
  };

  const startPlayback = () => {
    setIsPlaying(true);
    setPlaybackStartTime(Date.now());
    //console.log(`🎵 Playing audio clip ${currentClipIndex + 1}`);
  };

  const finishAudioEmotion = () => {
    //console.log("🎵 All audio clips complete! Calculating collective emotion score...");
    
    // Calculate average excitement across all clips
    let totalExcitement = 0;
    let totalSamples = 0;

    clipExcitementScores.forEach(scores => {
      totalExcitement += scores.reduce((sum, score) => sum + score, 0);
      totalSamples += scores.length;
    });

    const averageEmotionScore = totalSamples > 0 ? totalExcitement / totalSamples : 0;
    const collectiveScore = Math.round(averageEmotionScore * 100);

    //console.log(`🎶 Collective emotion score: ${collectiveScore}`);

    const selectedSoundtrack = getSoundtrackByScore(collectiveScore);
    //console.log(`🎶 Selected soundtrack: ${selectedSoundtrack.name}`);

    setTimeout(() => {
      navigate("/video-output", {
        state: {
          videoJobId,
          metadata,
          collectiveScore,
          soundtrack: selectedSoundtrack,
          level3Selections,
          audioEmotionScores: Array.from(clipExcitementScores.entries())
        }
      });
    }, 2000);
  };

  // Auto-start first clip on mount
  useEffect(() => {
    if (currentClipIndex === 0 && !isPlaying) {
      setTimeout(() => {
        startPlayback();
      }, 1000);
    }
  }, []);

  const getProgressPercentage = () => {
    if (!isPlaying || playbackStartTime === null) return 0;
    const elapsed = Date.now() - playbackStartTime;
    return Math.min((elapsed / CLIP_DURATION_MS) * 100, 100);
  };

  return (
    <div className="min-h-screen relative">
      {/* Animated Brain Background */}
      <Brain3D excitement={averageExcitement} className="opacity-20 z-0" />
      
      <Header />
      
      <div className="py-12 px-6">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <Music className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <h1 className="text-4xl font-bold uppercase tracking-wider mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Emotional Soundtrack Selection
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              Listen to the audio and let your emotions flow
            </p>
            <div className="text-sm text-muted-foreground/70">
              Clip {currentClipIndex + 1} of {TOTAL_CLIPS}
            </div>
          </div>

          {/* Collective Excitement Core Visualization */}
          <div className="flex justify-center mb-8">
            <CollectiveExcitementCore 
              averageExcitement={averageExcitement} 
              size={300}
            />
          </div>

          {/* Audio Status and Progress */}
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="p-6 border-primary/30 bg-card/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                {/* Audio Icon */}
                <div className="flex items-center gap-3">
                  {isPlaying ? (
                    <Volume2 className="h-8 w-8 text-primary animate-pulse" />
                  ) : (
                    <Pause className="h-8 w-8 text-primary/60" />
                  )}
                  <span className="text-lg font-mono">
                    {isPlaying ? 'Listening...' : 'Paused'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-300"
                      style={{ width: `${getProgressPercentage()}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{Math.round(getProgressPercentage())}%</span>
                    <span>{CLIP_DURATION_MS / 1000}s</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Excitement Meters */}
          <div className="flex justify-center gap-4 mb-8">
            {connectedHeadsets?.map((headsetId: string) => {
              const level = excitementLevels.get(headsetId) || 0;
              const color = getHeadsetColor(headsetId);
              
              return (
                <div key={headsetId} className="flex flex-col items-center gap-2">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center border-4 font-mono text-xs font-bold transition-all"
                    style={{
                      borderColor: color,
                      backgroundColor: `${color}40`,
                      transform: `scale(${1 + level * 0.2})`
                    }}
                  >
                    {(level * 100).toFixed(0)}%
                  </div>
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${level * 100}%`,
                        backgroundColor: color
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {headsetId.substring(0, 8)}...
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clip Progress Indicators */}
          <div className="flex justify-center gap-4">
            {Array.from({ length: TOTAL_CLIPS }).map((_, index) => (
              <div
                key={index}
                className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all ${
                  index < currentClipIndex 
                    ? 'border-primary bg-primary/20' 
                    : index === currentClipIndex
                    ? 'border-primary bg-primary/10 animate-pulse'
                    : 'border-muted bg-muted/5'
                }`}
              >
                <span className="text-sm font-mono">
                  {index < currentClipIndex ? '✓' : index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manual navigation buttons for testing */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-2">
        <button
          onClick={() => navigate("/excitement-level-3", { state: { connectedHeadsets, level3Selections } })}
          className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded text-sm font-mono transition-colors"
        >
          ← Level 3
        </button>
        <button
          onClick={() => navigate("/video-output", { state: { videoJobId, metadata } })}
          className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded text-sm font-mono transition-colors"
        >
          → Video
        </button>
      </div>

      {/* Scan line effect */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-scan-line" />
      </div>
    </div>
  );
};

export default AudioEmotion;
