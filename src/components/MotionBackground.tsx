'use client';

import { useTheme } from '@/lib/ThemeProvider';
import { usePathname } from 'next/navigation';

export default function MotionBackground() {
  const { theme } = useTheme();
  const pathname = usePathname();

  // Don't render on login page
  if (pathname === '/login') return null;

  // Keep light mode clean & minimal
  if (theme === 'light') return null;

  const isAesthetic = theme === 'aesthetic';

  return (
    <div className="motion-bg-container pointer-events-none fixed inset-0 z-0 overflow-hidden">
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
  );
}
