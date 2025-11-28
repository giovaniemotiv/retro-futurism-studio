import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RotateCcw, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const VideoOutput = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { metadata, collectiveScore, soundtrack, level3Selections } = location.state || {};

  useEffect(() => {
    const metadataFromState = metadata || location.state?.metadata;
    
    if (!metadataFromState || metadataFromState.length === 0) {
      toast({
        title: "No Selection Data",
        description: "Please complete the selection process first.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    //console.log("🎬 Starting Sora video generation with metadata:", metadataFromState);
    if (collectiveScore) {
      //console.log("🎵 Collective excitement score:", collectiveScore);
      //console.log("🎶 Selected soundtrack:", soundtrack?.name);
    }
    
    // Call the Sora edge function with extended timeout
    const generateVideo = async () => {
      try {
        // Use direct fetch with extended timeout (6 minutes) instead of supabase.functions.invoke
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 360000); // 6 minutes

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sora-video`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ metadata: metadataFromState }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("❌ Sora generation error:", response.status, errorData);
          setError(errorData.error || `Failed to generate video (${response.status})`);
          setIsGenerating(false);
          return;
        }

        const data = await response.json();
        
        if (data?.videoUrl) {
          //console.log("✅ Video generated:", data.videoUrl);
          setVideoUrl(data.videoUrl);
        } else {
          setError("No video URL returned from API");
        }
      } catch (err) {
        console.error("❌ Unexpected error:", err);
        if (err instanceof Error && err.name === 'AbortError') {
          setError("Video generation timed out. The process may still be running - please try again in a moment.");
        } else {
          setError(err instanceof Error ? err.message : "Unknown error occurred");
        }
      } finally {
        setIsGenerating(false);
      }
    };

    generateVideo();
  }, [location.state, navigate, toast, metadata, collectiveScore, soundtrack]);

  const handleStartOver = () => {
    navigate("/");
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="p-8 max-w-2xl w-full">
          <div className="flex flex-col items-center gap-6">
            <AlertCircle className="w-16 h-16 text-destructive" />
            <h1 className="text-3xl font-bold text-foreground">Generation Error</h1>
            <p className="text-muted-foreground text-center">{error}</p>
            <Button onClick={handleStartOver} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Start Over
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="p-8 max-w-6xl w-full">
        {isGenerating ? (
          <div className="flex flex-col items-center gap-6 py-12">
            <Loader2 className="w-20 h-20 animate-spin text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Generating Your Vision...</h1>
            <p className="text-muted-foreground text-xl text-center max-w-2xl">
              BraveWave is transforming your selections into a cinematic experience using AI.
            </p>
            <div className="mt-8 space-y-2 text-center">
              <div className="text-sm text-muted-foreground">
                Processing metadata tags...
              </div>
              <div className="text-sm text-muted-foreground animate-pulse">
                This typically takes 2-5 minutes
              </div>
              <div className="text-xs text-muted-foreground/70 mt-4">
                Generating cinematic video with Sora AI
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-foreground mb-4">Your Generated Video</h1>
              <p className="text-muted-foreground text-lg mb-2">
                Created from your mind-controlled selections
              </p>
              {level3Selections && level3Selections.length > 0 && (
                <p className="text-sm text-muted-foreground mb-4">
                  Earth formed by {level3Selections.length} emotional resonance{level3Selections.length !== 1 ? 's' : ''}
                </p>
              )}
              {soundtrack && collectiveScore !== undefined && (
                <div className="inline-flex flex-col items-center gap-2 px-6 py-3 bg-primary/10 rounded-lg border border-primary/20 mt-4">
                  <div className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-primary">Soundtrack: {soundtrack.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{soundtrack.description}</p>
                  <p className="text-xs text-muted-foreground">Collective Excitement Score: {collectiveScore}/100</p>
                </div>
              )}
            </div>
            
            <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden">
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  className="w-full h-full object-cover"
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Video player loading...</p>
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={handleStartOver} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Create Another
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default VideoOutput;
