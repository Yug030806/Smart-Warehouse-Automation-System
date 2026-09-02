'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { AlertCircle, CheckCircle, BellRing, Info, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';
import { Alert } from '@/lib/database.types';
import { triggerGlobalAlert } from '@/lib/alertService';

export default function AlertsPage() {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const loadAlerts = () => {
    const list = supabase.from('alerts').select().data || [];
    setAlerts(list as Alert[]);
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = (id: string) => {
    supabase.from('alerts').update({ is_acknowledged: true }).eq('id', id);
    loadAlerts();
  };

  const handleResolve = (id: string) => {
    supabase.from('alerts').update({
      is_acknowledged: true,
      resolved_at: new Date().toISOString()
    }).eq('id', id);
    loadAlerts();
  };

  const triggerTestAlert = (severity: 'CRITICAL' | 'WARNING' | 'INFO') => {
    if (severity === 'CRITICAL') {
      triggerGlobalAlert({
        type: 'BOX_MISMATCH',
        severity: 'CRITICAL',
        message: 'Critical Security Alert: Scanned payload barcode mismatch detected at Sorting Lane A3!',
        vehicle_id: 'v-04'
      });
    } else if (severity === 'WARNING') {
      triggerGlobalAlert({
        type: 'LOW_BATTERY',
        severity: 'WARNING',
        message: 'Battery Warning: Vehicle AMR-02 battery depleted to 14%. Docking requested.',
        vehicle_id: 'v-02'
      });
    } else {
      triggerGlobalAlert({
        type: 'SYSTEM_ERROR',
        severity: 'INFO',
        message: 'System Info: Autonomous floor 2 elevator calibration scheduled in 10 mins.',
      });
    }
    loadAlerts();
  };

  const filtered = alerts.filter(a => {
    if (filterSeverity === 'ALL') return true;
    return a.severity === filterSeverity;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 relative">
      <AmbientBackground intensity="low" />
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
                <span>Active System Alerts</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800/40 font-mono">Pop-up Enabled</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">View active system warnings, hardware anomalies, scanner mismatches and live pop-up alerts.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 px-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-yellow-400" />
                  Test Pop-up:
                </span>
                <button
                  onClick={() => triggerTestAlert('CRITICAL')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-950/80 text-red-300 border border-red-800/50 hover:bg-red-900 transition"
                >
                  Critical
                </button>
                <button
                  onClick={() => triggerTestAlert('WARNING')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-800/50 hover:bg-amber-900 transition"
                >
                  Warning
                </button>
                <button
                  onClick={() => triggerTestAlert('INFO')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 hover:bg-cyan-900 transition"
                >
                  Info
                </button>
              </div>

              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-400 font-semibold"
              >
                <option value="ALL">All Severities</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-900 bg-slate-950 p-6">
            <div className="space-y-4">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <CheckCircle className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="font-bold text-slate-300">All Systems Nominal</p>
                  <p className="mt-1">No active hardware failures or scanner mismatches recorded.</p>
                </div>
              ) : (
                filtered.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border flex items-start justify-between gap-4 transition duration-150 ${
                      alert.severity === 'CRITICAL' 
                        ? 'border-red-900/40 bg-red-950/10 text-red-400' 
                        : (alert.severity === 'WARNING' ? 'border-yellow-900/40 bg-yellow-950/10 text-yellow-500' : 'border-slate-800 bg-slate-900/20 text-slate-300')
                    }`}
                  >
                    <div className="flex gap-3">
                      {alert.severity === 'CRITICAL' ? (
                        <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs font-mono uppercase">{alert.type}</span>
                          <span className="text-[9px] text-slate-500 font-semibold">{new Date(alert.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-xs mt-1.5 font-medium">{alert.message}</p>
                      </div>
                    </div>

                    {!alert.is_acknowledged && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-bold border border-slate-800"
                        >
                          Resolve Alert
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
