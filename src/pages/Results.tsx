import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, CheckCircle2 } from "lucide-react";
import { level1Images, level2Images } from "@/data/imageData";

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { level1Selections, level2Selections, connectedHeadsets } = location.state || { 
    level1Selections: new Map(), 
    level2Selections: new Map(),
    connectedHeadsets: []
  };

  const getImageById = (id: number) => {
    return [...level1Images, ...level2Images].find(img => img.id === id);
  };

  // Auto-trigger Sora video generation and navigate to excitement levels
  useEffect(() => {
    if (!level1Selections || !level2Selections) return;

    const collectMetadata = () => {
      const allMetadata: string[] = [];
      
      // Collect metadata from level 1 selections
      level1Selections.forEach((imageId: number) => {
        const image = getImageById(imageId);
        if (image?.metadata) {
          allMetadata.push(...image.metadata);
        }
      });

      // Collect metadata from level 2 selections
      level2Selections.forEach((imageId: number) => {
        const image = getImageById(imageId);
        if (image?.metadata) {
          allMetadata.push(...image.metadata);
        }
      });

      return allMetadata;
    };

    const startBackgroundGeneration = async () => {
      const metadata = collectMetadata();
      //console.log("🎬 Starting Sora generation in background with metadata:", metadata);

      // Start Sora generation (returns immediately with job ID)
      // The actual generation happens on the server
      const videoJobId = `job_${Date.now()}`;
      
      // Navigate to excitement level 3 (new artistic earth-forming level)
      navigate("/excitement-level-3", { 
        state: { 
          metadata,
          videoJobId,
          connectedHeadsets,
          performanceMetrics: location.state?.performanceMetrics,
          motionEvent: location.state?.motionEvent
        },
        replace: true 
      });
    };

    // Small delay to let user see results before transitioning
    const timer = setTimeout(startBackgroundGeneration, 2000);
    return () => clearTimeout(timer);
  }, [level1Selections, level2Selections, navigate, connectedHeadsets, location.state]);

  // Import headset color utility
  const getHeadsetColorByIndex = (index: number): string => {
    const colors = [
      'hsl(var(--primary))',
      'hsl(142, 76%, 36%)',
      'hsl(217, 91%, 60%)',
      'hsl(280, 67%, 55%)',
      'hsl(25, 95%, 53%)',
    ];
    return colors[index % colors.length];
  };

  const handleStartOver = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-12 w-12 text-primary animate-pulse-glow" />
            </div>
            <h1 className="text-4xl font-bold uppercase tracking-wider mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Selection Complete
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              {connectedHeadsets.length} user{connectedHeadsets.length !== 1 ? 's' : ''} completed selections across both levels
            </p>
            
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={handleStartOver}
                variant="outline"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Start Over
              </Button>
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Download className="h-4 w-4" />
                Export Selections
              </Button>
            </div>
          </div>

          <div className="space-y-12">
            {/* Level 1 Selections by Headset */}
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-wider mb-6 flex items-center gap-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
                  1
                </span>
                Level 1 Selections
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from(level1Selections.entries()).map(([headsetId, imageId], index) => {
                  const image = getImageById(imageId);
                  if (!image) return null;
                  const color = getHeadsetColorByIndex(index);
                  
                  return (
                    <Card key={headsetId} className="overflow-hidden border-2" style={{ borderColor: color }}>
                      <div className="aspect-video relative">
                        <img
                          src={image.url}
                          alt={image.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2">
                          <div 
                            className="px-3 py-1 rounded-full backdrop-blur-sm border-2 font-mono text-xs font-bold"
                            style={{
                              backgroundColor: `${color}20`,
                              borderColor: color,
                              color: color,
                            }}
                          >
                            {headsetId.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-card">
                        <p className="text-sm font-semibold text-center">{image.title}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Level 2 Selections by Headset */}
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-wider mb-6 flex items-center gap-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
                  2
                </span>
                Level 2 Selections
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from(level2Selections.entries()).map(([headsetId, imageId], index) => {
                  const image = getImageById(imageId);
                  if (!image) return null;
                  const color = getHeadsetColorByIndex(index);
                  
                  return (
                    <Card key={headsetId} className="overflow-hidden border-2" style={{ borderColor: color }}>
                      <div className="aspect-video relative">
                        <img
                          src={image.url}
                          alt={image.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2">
                          <div 
                            className="px-3 py-1 rounded-full backdrop-blur-sm border-2 font-mono text-xs font-bold"
                            style={{
                              backgroundColor: `${color}20`,
                              borderColor: color,
                              color: color,
                            }}
                          >
                            {headsetId.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-card">
                        <p className="text-sm font-semibold text-center">{image.title}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scan line effect */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-scan-line" />
      </div>
    </div>
  );
};

export default Results;
