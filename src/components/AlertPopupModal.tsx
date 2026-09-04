'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { Alert } from '@/lib/database.types';
import mockDb from '@/lib/supabase/mockDb';
import { generateUUID } from '@/lib/uuid';
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

// Helper to filter out internal system/script errors and legacy alerts from the popup modal
function isSystemOrIgnoredAlert(a: Alert | any): boolean {
  if (!a) return true;
  if (a.is_acknowledged) return true;
  if (a.type === 'SYSTEM_ERROR') return true;
  const msg = (a.message || '').toLowerCase();
  if (
    msg.includes('system error') ||
    msg.includes('typeerror') ||
    msg.includes('uncaught') ||
    msg.includes('is not a function') ||
    msg.includes('.catch') ||
    msg.includes('r.nd') ||
    msg.includes('elevator calibration') ||
    msg.includes('unhandled exception') ||
    msg.includes('failed to fetch') ||
    msg.includes('script error')
  ) {
    return true;
  }
  return false;
}

export default function AlertPopupModal() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      // Clear legacy permanent localStorage suppression so active alerts pop up properly
      localStorage.removeItem('swl_dismissed_alert_popups');
      const saved = sessionStorage.getItem('swl_dismissed_alert_popups');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastAlertIdRef = useRef<string | null>(null);

  // Do not show popup modal on auth pages or when user is logged out
  const isAuthPage = ['/login', '/signup'].includes(pathname) || !user;

  // Fetch active alerts - fetches live unacknowledged alerts from Supabase and local cache
  const fetchActiveAlerts = useCallback(async () => {
    if (isAuthPage) return;
    try {
      // 1. Fetch live unacknowledged alerts from Supabase database
      const { data: dbAlerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('is_acknowledged', false)
        .order('created_at', { ascending: false });

      // 2. Fetch from local cache as well
      const localAlerts = mockDb.getAlerts() || [];

      // 3. Merge without duplicates (Supabase takes precedence), filtering out system/script errors
      const mergedMap = new Map<string, Alert>();
      (dbAlerts || []).forEach((a: any) => {
        if (!isSystemOrIgnoredAlert(a)) {
          mergedMap.set(a.id, a as Alert);
        }
      });
      localAlerts.forEach((a: Alert) => {
        if (!isSystemOrIgnoredAlert(a)) {
          if (!mergedMap.has(a.id)) {
            mergedMap.set(a.id, a);
          }
        }
      });

      const res = Array.from(mergedMap.values());
      setAlerts(res);
    } catch (e) {
      console.error('Error loading alerts for pop-up:', e);
    }
  }, [isAuthPage]);

  useEffect(() => {
    if (isAuthPage) {
      setAlerts([]);
      return;
    }

    // Auto-clean any legacy error alerts from localStorage immediately
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('sih_logistics_mock_db');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.alerts && Array.isArray(parsed.alerts)) {
            const initialCount = parsed.alerts.length;
            parsed.alerts = parsed.alerts.filter((a: any) => !isSystemOrIgnoredAlert(a));
            if (parsed.alerts.length !== initialCount) {
              localStorage.setItem('sih_logistics_mock_db', JSON.stringify(parsed));
            }
          }
        }
      } catch {}
    }

    fetchActiveAlerts();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchActiveAlerts();
    }, 10000);

    // Subscribe to Supabase realtime broadcast on alerts table
    const channel = supabase
      .channel('realtime:alerts-popup')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (payload: any) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newAlert = payload.new as Alert;
            if (!isSystemOrIgnoredAlert(newAlert)) {
              setAlerts(prev => {
                if (prev.some(a => a.id === newAlert.id)) return prev;
                return [newAlert, ...prev];
              });
              setDismissedIds(prev => {
                const next = new Set(prev);
                next.delete(newAlert.id);
                return next;
              });
              if (soundEnabled) playAlertChime(newAlert.severity || 'WARNING');
            }
          } else {
            fetchActiveAlerts();
          }
        }
      )
      .subscribe();

    // Subscribe to mockDb reactive events for instant popups without lag
    const unsubscribe = mockDb.subscribe((table) => {
      if (table === 'alerts') {
        fetchActiveAlerts();
      }
    });

    // Listen for custom immediate pop-up trigger
    const handleNewAlertEvent = (e: Event) => {
      const customEv = e as CustomEvent<Alert>;
      if (customEv.detail) {
        if (isSystemOrIgnoredAlert(customEv.detail)) return;
        setAlerts(prev => {
          const filtered = prev.filter(a => a.id !== customEv.detail.id);
          return [customEv.detail, ...filtered];
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

    // Reset popups listener
    const handleResetPopups = () => {
      setDismissedIds(new Set());
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('swl_dismissed_alert_popups');
      }
      fetchActiveAlerts();
    };

    window.addEventListener('swl:new-alert-popup', handleNewAlertEvent);
    window.addEventListener('swl:reset-alert-popups', handleResetPopups);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      unsubscribe();
      window.removeEventListener('swl:new-alert-popup', handleNewAlertEvent);
      window.removeEventListener('swl:reset-alert-popups', handleResetPopups);
    };
  }, [fetchActiveAlerts, soundEnabled, isAuthPage]);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeAlerts.length > 0) {
        const modal = document.getElementById('alert-popup-modal-content');
        if (modal && !modal.contains(e.target as Node)) {
          handleDismissCurrent(activeAlerts[0].id);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeAlerts, currentIndex]);

  if (activeAlerts.length === 0) return null;

  const currentAlert = activeAlerts[currentIndex] || activeAlerts[0];

  const handleResolveAlert = async (id: string) => {
    try {
      await supabase.from('alerts').update({
        is_acknowledged: true,
        resolved_at: new Date().toISOString()
      }).eq('id', id);
    } catch (e) {
      console.error('Error resolving alert in Supabase:', e);
    }

    try {
      const all = mockDb.getAlerts();
      const target = all.find(a => a.id === id);
      if (target) {
        mockDb.saveAlert({
          ...target,
          is_acknowledged: true,
          resolved_at: new Date().toISOString()
        });
      }
    } catch {}

    handleDismissCurrent(id);
    await fetchActiveAlerts();
  };

  const handleDismissCurrent = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev).add(id);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('swl_dismissed_alert_popups', JSON.stringify(Array.from(next)));
        } catch {}
      }
      return next;
    });
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
        id="alert-popup-modal-content"
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
