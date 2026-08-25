'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Alert } from '@/lib/database.types';
import { 
  ShieldAlert, 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  BellRing
} from 'lucide-react';

// Web Audio API synth chime generator
function playAlertChime(severity: string) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    if (severity === 'CRITICAL') {
      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.3);
      osc2.frequency.setValueAtTime(1760, now);
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.3);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
    } else if (severity === 'WARNING') {
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc1.start(now);
      osc1.stop(now + 0.3);
    } else {
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc1.start(now);
      osc1.stop(now + 0.2);
    }
  } catch (e) {
    // Ignore audio context autoplay restrictions
  }
}

export default function AlertPopupModal() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastAlertIdRef = useRef<string | null>(null);

  // Fetch active unacknowledged alerts that have not been dismissed in current pop-up session
  const fetchActiveAlerts = useCallback(() => {
    try {
      const res = supabase.from('alerts').select().eq('is_acknowledged', false).data || [];
      const unackAlerts = (res as Alert[]).filter(a => !a.is_acknowledged);
      
      setAlerts(unackAlerts);
    } catch (e) {
      console.error('Error loading alerts for pop-up:', e);
    }
  }, []);

  useEffect(() => {
    fetchActiveAlerts();
    const interval = setInterval(fetchActiveAlerts, 2000);

    // Listen for custom immediate pop-up trigger
    const handleNewAlertEvent = (e: Event) => {
      const customEv = e as CustomEvent<Alert>;
      if (customEv.detail) {
        setAlerts(prev => {
          if (prev.some(a => a.id === customEv.detail.id)) return prev;
          return [customEv.detail, ...prev];
        });
        setDismissedIds(prev => {
          const updated = new Set(prev);
          updated.delete(customEv.detail.id);
          return updated;
        });
        if (soundEnabled) playAlertChime(customEv.detail.severity || 'WARNING');
      }
      fetchActiveAlerts();
    };

    window.addEventListener('swl:new-alert-popup', handleNewAlertEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('swl:new-alert-popup', handleNewAlertEvent);
    };
  }, [fetchActiveAlerts, soundEnabled]);

  // Undismissed alerts list
  const activeAlerts = alerts.filter(a => !dismissedIds.has(a.id));

  // Play chime when new undismissed alert arrives
  useEffect(() => {
    if (activeAlerts.length > 0) {
      const newest = activeAlerts[0];
      if (newest.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = newest.id;
        if (soundEnabled) {
          playAlertChime(newest.severity);
        }
      }
    }
  }, [activeAlerts, soundEnabled]);

  // Adjust index if out of bounds
  useEffect(() => {
    if (currentIndex >= activeAlerts.length && activeAlerts.length > 0) {
      setCurrentIndex(activeAlerts.length - 1);
    }
  }, [activeAlerts.length, currentIndex]);

  if (activeAlerts.length === 0) return null;

  const currentAlert = activeAlerts[currentIndex] || activeAlerts[0];

  const handleResolveAlert = (id: string) => {
    try {
      supabase.from('alerts').update({
        is_acknowledged: true,
        resolved_at: new Date().toISOString()
      }).eq('id', id);
    } catch (e) {
      console.error('Error resolving alert:', e);
    }

    setAlerts(prev => prev.filter(a => a.id !== id));
    setDismissedIds(prev => {
      const copy = new Set(prev);
      copy.add(id);
      return copy;
    });

    if (currentIndex >= activeAlerts.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleDismissCurrent = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    if (currentIndex >= activeAlerts.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const isCritical = currentAlert.severity === 'CRITICAL';
  const isWarning = currentAlert.severity === 'WARNING';

  const severityBadgeClass = isCritical
    ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-sm shadow-red-500/20'
    : isWarning
    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm shadow-amber-500/20'
    : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-sm shadow-cyan-500/20';

  const modalContainerClass = isCritical
    ? 'border-red-500/80 shadow-[0_10px_35px_rgba(239,68,68,0.35)] bg-slate-950/95'
    : isWarning
    ? 'border-amber-500/80 shadow-[0_10px_35px_rgba(245,158,11,0.3)] bg-slate-950/95'
    : 'border-cyan-500/80 shadow-[0_10px_30px_rgba(6,182,212,0.25)] bg-slate-950/95';

  return (
    // Corner Floating Toast Container (Non-blocking background overlay so user can interact with page)
    <div className="fixed top-4 right-4 sm:top-5 sm:right-5 z-[100] w-full max-w-sm sm:max-w-md pointer-events-none p-2 sm:p-0">
      <div 
        className={`pointer-events-auto relative w-full rounded-2xl border p-4 text-slate-100 backdrop-blur-xl transition-all duration-300 shadow-2xl animate-in slide-in-from-top-4 fade-in ${modalContainerClass}`}
        role="dialog"
        aria-label="Alert Notification"
      >
        {/* Top Glowing Ambient Line */}
        <div 
          className={`absolute -top-px left-6 right-6 h-0.5 rounded-full ${
            isCritical ? 'bg-red-500 shadow-[0_0_12px_#ef4444]' : isWarning ? 'bg-amber-500 shadow-[0_0_12px_#f59e0b]' : 'bg-cyan-500 shadow-[0_0_12px_#06b6d4]'
          }`} 
        />

        {/* Header Controls */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isCritical ? 'bg-red-400' : isWarning ? 'bg-amber-400' : 'bg-cyan-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-cyan-500'
              }`} />
            </span>

            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
              System Alert
            </span>

            {activeAlerts.length > 1 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {currentIndex + 1} / {activeAlerts.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
              className="p-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 transition"
              aria-label="Toggle alert sound"
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-400" /> : <VolumeX className="h-3.5 w-3.5 text-slate-500" />}
            </button>

            <button
              onClick={() => handleDismissCurrent(currentAlert.id)}
              title="Dismiss"
              className="p-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100 transition"
              aria-label="Dismiss alert"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Alert Body */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`p-2 rounded-lg shrink-0 border mt-0.5 ${
            isCritical 
              ? 'bg-red-950/70 border-red-800/60 text-red-400 animate-pulse' 
              : isWarning 
              ? 'bg-amber-950/70 border-amber-800/60 text-amber-400' 
              : 'bg-cyan-950/70 border-cyan-800/60 text-cyan-400'
          }`}>
            {isCritical ? (
              <ShieldAlert className="h-5 w-5" />
            ) : isWarning ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <BellRing className="h-5 w-5" />
            )}
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${severityBadgeClass}`}>
                {currentAlert.severity}
              </span>
              <span className="text-[11px] font-mono font-bold text-slate-200 uppercase truncate">
                {currentAlert.type}
              </span>
            </div>

            <p className="text-xs text-slate-200 font-medium leading-snug">
              {currentAlert.message}
            </p>

            {currentAlert.vehicle_id && (
              <p className="text-[10px] font-mono text-blue-400 pt-0.5">
                Vehicle: {currentAlert.vehicle_id}
              </p>
            )}
          </div>
        </div>

        {/* Multi-alert Carousel Controls (If > 1 active alert) */}
        {activeAlerts.length > 1 && (
          <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 mb-3 text-[11px] text-slate-400">
            <span>Pending Alerts:</span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="p-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-[10px] text-slate-300">
                {currentIndex + 1} of {activeAlerts.length}
              </span>
              <button
                disabled={currentIndex >= activeAlerts.length - 1}
                onClick={() => setCurrentIndex(prev => Math.min(activeAlerts.length - 1, prev + 1))}
                className="p-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
          <button
            onClick={() => {
              handleDismissCurrent(currentAlert.id);
              router.push('/alerts');
            }}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Alert Center</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleDismissCurrent(currentAlert.id)}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 transition"
            >
              Dismiss
            </button>

            <button
              onClick={() => handleResolveAlert(currentAlert.id)}
              className={`text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 transition shadow-md ${
                isCritical 
                  ? 'bg-red-600 hover:bg-red-500 text-white' 
                  : isWarning 
                  ? 'bg-amber-600 hover:bg-amber-500 text-slate-950' 
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Resolve</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
