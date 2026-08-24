'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Bell, AlertTriangle, Menu } from 'lucide-react';
import { Alert, Notification } from '@/lib/database.types';

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAlertsMenu, setShowAlertsMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  useEffect(() => {
    // Initial fetch of notifications and alerts
    const fetchUpdates = () => {
      const activeAlerts = supabase.from('alerts').select().eq('is_acknowledged', false).data || [];
      setAlerts(activeAlerts as Alert[]);
      const unreadNotifs = supabase.from('notifications').select().eq('is_read', false).data || [];
      setNotifications(unreadNotifs as Notification[]);
    };

    fetchUpdates();
    const interval = setInterval(fetchUpdates, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClearNotifs = () => {
    supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications([]);
  };

  const handleAcknowledgeAlert = (id: string) => {
    supabase.from('alerts').update({ is_acknowledged: true }).eq('id', id);
    setAlerts(alerts.filter(x => x.id !== id));
  };

  return (
    <header className="h-16 border-b border-slate-900 bg-slate-950 flex items-center justify-between px-4 md:px-8 relative z-30">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 md:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h2 className="text-xs md:text-sm font-semibold tracking-wider uppercase text-slate-400 truncate">
          Warehouse Logistics
        </h2>
      </div>

      <div className="flex items-center gap-3 md:gap-4 relative">
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
                <span className="text-[10px] text-slate-500 font-mono">Unresolved ({alerts.length})</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
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
              <div className="space-y-2 max-h-60 overflow-y-auto">
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

