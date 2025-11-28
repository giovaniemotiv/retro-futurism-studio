import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
}

interface ParticleDissolveProps {
  trigger: boolean;
  onComplete?: () => void;
}

export const ParticleDissolve = ({ trigger, onComplete }: ParticleDissolveProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!trigger || isAnimating) return;

    //console.log('🎆 Particle effect triggered!');
    setIsAnimating(true);
    
    // Create more particles for better visibility
    const newParticles: Particle[] = [];
    const particleCount = 60; // Increased from 40
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 3 + Math.random() * 4; // Faster and more varied
      
      newParticles.push({
        id: i,
        x: 50,
        y: 50,
        size: 3 + Math.random() * 6, // Larger particles
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed,
        opacity: 1,
        color: `hsl(var(--primary))`,
      });
    }
    
    setParticles(newParticles);

    // Animate particles
    const animationDuration = 1200; // Longer animation
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      setParticles(prev =>
        prev.map(p => ({
          ...p,
          x: p.x + p.speedX,
          y: p.y + p.speedY,
          opacity: Math.max(0, 1 - progress),
          speedY: p.speedY + 0.15, // Stronger gravity
        }))
      );
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        setParticles([]);
        onComplete?.();
      }
    };
    
    requestAnimationFrame(animate);
  }, [trigger]);

  if (!isAnimating && particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            opacity: particle.opacity,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
            filter: 'blur(0.5px)',
          }}
        />
      ))}
      
      {/* Enhanced radial flash effect */}
      <div
        className="absolute inset-0 animate-pulse"
        style={{
          background: `radial-gradient(circle at center, hsl(var(--primary) / 0.5) 0%, transparent 60%)`,
          opacity: isAnimating ? 1 : 0,
          transition: 'opacity 0.5s ease-out',
        }}
      />
    </div>
  );
};