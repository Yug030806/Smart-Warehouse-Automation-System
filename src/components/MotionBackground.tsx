'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/lib/ThemeProvider';
import { usePathname } from 'next/navigation';

export default function MotionBackground() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const { clientX, clientY } = e;
      const moveX = (clientX / window.innerWidth - 0.5) * 40;
      const moveY = (clientY / window.innerHeight - 0.5) * 40;
      
      containerRef.current.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.05)`;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!mounted) return null;

  // Don't render on login page
  if (pathname === '/login') return null;



  const isAesthetic = theme === 'aesthetic';

  return (
    <div className="motion-bg-container pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full" 
        style={{ transform: 'scale(1.05)', transition: 'transform 0.1s ease-out' }}
      >
        {/* Dynamic Glowing Ambient Orbs */}
        <div className={`motion-orb orb-1 ${isAesthetic ? 'orb-aesthetic-1' : 'orb-dark-1'}`} />
        <div className={`motion-orb orb-2 ${isAesthetic ? 'orb-aesthetic-2' : 'orb-dark-2'}`} />
        <div className={`motion-orb orb-3 ${isAesthetic ? 'orb-aesthetic-3' : 'orb-dark-3'}`} />

        {/* Animated Circuit Streams */}
        <div className={`circuit-stream stream-1 ${isAesthetic ? 'stream-aesthetic' : 'stream-dark'}`} />
        <div className={`circuit-stream stream-2 ${isAesthetic ? 'stream-aesthetic' : 'stream-dark'}`} />
        <div className={`circuit-stream stream-3 ${isAesthetic ? 'stream-aesthetic' : 'stream-dark'}`} />

        {/* Tech Circuit Node Pulses */}
        <div className={`circuit-node node-1 ${isAesthetic ? 'node-aesthetic' : 'node-dark'}`} />
        <div className={`circuit-node node-2 ${isAesthetic ? 'node-aesthetic' : 'node-dark'}`} />

        {/* Floating Particles */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`floating-particle particle-${i + 1} ${isAesthetic ? 'particle-aesthetic' : 'particle-dark'}`}
          />
        ))}
      </div>
    </div>
  );
}
