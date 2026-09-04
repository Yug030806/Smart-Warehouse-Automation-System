'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTheme, ThemeMode } from '@/lib/ThemeProvider';
import { Bell, AlertTriangle, Menu, Sun, Moon, Sparkles, PlusCircle } from 'lucide-react';
import { Alert, Notification } from '@/lib/database.types';
import { triggerGlobalAlert } from '@/lib/alertService';

interface NavbarProps {
  onMenuClick?: () => void;
}

const themeOptions: { mode: ThemeMode; icon: typeof Moon; label: string }[] = [
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'aesthetic', icon: Sparkles, label: 'Aesthetic' },
];

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAlertsMenu, setShowAlertsMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchUpdates = async () => {
      try {
        const [aRes, nRes] = await Promise.all([
          supabase.from('alerts').select().eq('is_acknowledged', false),
          supabase.from('notifications').select().eq('is_read', false)
        ]);
        if (isMounted) {
          setAlerts((aRes.data || []) as Alert[]);
          setNotifications((nRes.data || []) as Notification[]);
        }
      } catch (err) {
        console.error('Failed to fetch navbar alerts:', err);
      }
    };

    fetchUpdates();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchUpdates();
    }, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleClearNotifs = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications([]);
  };

  const handleAcknowledgeAlert = async (id: string) => {
    await supabase.from('alerts').update({ is_acknowledged: true }).eq('id', id);
    setAlerts(alerts.filter(x => x.id !== id));
  };

  const triggerQuickTestAlert = () => {
    triggerGlobalAlert({
      type: 'ROUTE_BLOCKED',
      severity: 'CRITICAL',
      message: 'Critical Fleet Anomaly: Unexpected obstacle detected on Main Transit Corridor 2.',
      vehicle_id: 'v-01'
    });
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-3 sm:px-6 md:px-8 relative z-30">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 pr-2 relative z-10">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800/80 md:hidden transition-colors shrink-0"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0 truncate">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            TELEMETRY: ONLINE
          </div>
          <h2 className="text-xs md:text-sm font-bold tracking-wider uppercase text-slate-200 truncate">
            Smart Warehouse OS
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 relative shrink-0 z-10">
        {/* Background overlay to close menus when clicking outside */}
        {(showAlertsMenu || showNotifMenu) && (
          <div 
            className="fixed inset-0 z-40"
            onClick={() => { setShowAlertsMenu(false); setShowNotifMenu(false); }}
          />
        )}
        
        {/* Theme Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-800 bg-slate-900">
          {themeOptions.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setTheme(mode)}
              title={`${label} Mode`}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                theme === mode
                  ? mode === 'aesthetic'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : mode === 'light'
                      ? 'bg-[#a67c33] text-white shadow-md shadow-[#a67c33]/30'
                      : 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {/* Active System Warnings */}
        <div className="relative">
          <button 
            onClick={() => { setShowAlertsMenu(!showAlertsMenu); setShowNotifMenu(false); }}
            className={`p-2 rounded-xl border transition-all duration-150 relative ${
              alerts.length > 0 
                ? 'border-yellow-600/30 bg-yellow-950/20 text-yellow-500 hover:bg-yellow-950/30' 
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-600 text-[10px] font-bold text-slate-950">
                {alerts.length}
              </span>
            )}
          </button>

          {showAlertsMenu && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl z-50">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-bold text-slate-300">Active Fleet Warnings</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={triggerQuickTestAlert}
                    className="text-[10px] bg-red-950 text-red-400 hover:bg-red-900 border border-red-800/40 px-2 py-0.5 rounded font-bold transition"
                  >
                    + Test Pop-up
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono">({alerts.length})</span>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto overscroll-contain">
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No active alerts. All systems nominal.</p>
                ) : (
                  alerts.map(a => (
                    <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          a.severity === 'CRITICAL' ? 'bg-red-950 text-red-400 border border-red-900/30' : 'bg-yellow-950 text-yellow-500 border border-yellow-900/30'
                        }`}>{a.severity}</span>
                        <button 
                          onClick={() => handleAcknowledgeAlert(a.id)}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Resolve
                        </button>
                      </div>
                      <p className="text-xs text-slate-300">{a.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button 
            onClick={() => { setShowNotifMenu(!showNotifMenu); setShowAlertsMenu(false); }}
            className={`p-2 rounded-xl border transition-all duration-150 relative ${
              notifications.length > 0 
                ? 'border-blue-600/30 bg-blue-950/20 text-blue-500 hover:bg-blue-950/30' 
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="h-4 w-4" />
            {notifications.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-slate-100">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl z-50">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-bold text-slate-300">Notification Center</span>
                <button 
                  onClick={handleClearNotifs}
                  className="text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-widest font-bold"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto overscroll-contain">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No new notifications.</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
                      <h4 className="text-xs font-semibold text-slate-200">{n.title}</h4>
                      <p className="mt-1 text-[11px] text-slate-400">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
