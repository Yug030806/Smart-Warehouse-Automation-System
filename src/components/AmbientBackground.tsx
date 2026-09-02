'use client';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/ThemeProvider';

interface AmbientBackgroundProps {
  intensity?: 'low' | 'high';
  className?: string;
}

export default function AmbientBackground({ intensity = 'low', className = '' }: AmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    // 1. Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;



    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const isAesthetic = theme === 'aesthetic';

    // Responsive particle count budget
    const isMobile = width < 768;
    const baseCount = intensity === 'high' ? (isMobile ? 35 : 75) : (isMobile ? 20 : 45);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
    }

    const particles: Particle[] = [];

    for (let i = 0; i < baseCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (intensity === 'high' ? 0.8 : 0.5),
        vy: (Math.random() - 0.5) * (intensity === 'high' ? 0.8 : 0.5),
        radius: Math.random() * 3 + 2,
        alpha: Math.random() * 0.6 + 0.4
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Theme-dependent colors
    const nodeColor = isAesthetic
      ? (a: number) => `rgba(204, 179, 163, ${a})`    // dark nude #CCB3A3 nodes
      : (a: number) => `rgba(56, 189, 248, ${a})`;  // cyan nodes

    const lineColor = isAesthetic
      ? (a: number) => `rgba(217, 196, 183, ${a})`   // warm nude lines
      : (a: number) => `rgba(168, 85, 247, ${a})`;  // purple lines

    const glowColor = isAesthetic ? '#CCB3A3' : '#38bdf8';

    const glowStops = isAesthetic
      ? {
          inner: intensity === 'high' ? 'rgba(204, 179, 163, 0.28)' : 'rgba(217, 196, 183, 0.16)',
          mid:   intensity === 'high' ? 'rgba(140, 118, 105, 0.20)'  : 'rgba(99, 82, 72, 0.12)',
          outer: 'rgba(26, 22, 20, 0)'
        }
      : {
          inner: intensity === 'high' ? 'rgba(59, 130, 246, 0.28)' : 'rgba(14, 165, 233, 0.16)',
          mid:   intensity === 'high' ? 'rgba(147, 51, 234, 0.22)' : 'rgba(99, 102, 241, 0.12)',
          outer: 'rgba(10, 10, 15, 0)'
        };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render gradient aurora glow spot
      const glowGradient = ctx.createRadialGradient(
        width * 0.5,
        height * 0.3,
        50,
        width * 0.5,
        height * 0.3,
        Math.max(width, height) * 0.75
      );
      glowGradient.addColorStop(0, glowStops.inner);
      glowGradient.addColorStop(0.5, glowStops.mid);
      glowGradient.addColorStop(1, glowStops.outer);
      
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height);

      // Connect particle network lines
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.x += p1.vx;
        p1.y += p1.vy;

        if (p1.x < 0) p1.x = width;
        if (p1.x > width) p1.x = 0;
        if (p1.y < 0) p1.y = height;
        if (p1.y > height) p1.y = 0;

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.radius, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor(p1.alpha * (intensity === 'high' ? 1.0 : 0.75));
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Connect nearby nodes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = intensity === 'high' ? 170 : 130;

          if (dist < maxDist) {
            const lineAlpha = (1 - dist / maxDist) * (intensity === 'high' ? 0.55 : 0.35);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = lineColor(lineAlpha);
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity, theme]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      aria-hidden="true"
    />
  );
}
