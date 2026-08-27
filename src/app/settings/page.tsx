'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { Settings, Save, PlayCircle, CheckCircle2, Gauge, Timer, Zap, RotateCcw, ToggleLeft, ToggleRight } from 'lucide-react';
import { SystemSettings } from '@/lib/database.types';
import mockDb from '@/lib/supabase/mockDb';

import { useAuth } from '@/lib/supabase/AuthProvider';

export default function SettingsPage() {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';
  const isAdmin = userRole === 'ADMIN';

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [success, setSuccess] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Form values
  const [speed, setSpeed] = useState(1);
  const [animSpeed, setAnimSpeed] = useState(1);
  const [autoStart, setAutoStart] = useState(true);
  const [simMode, setSimMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [floorDuration, setFloorDuration] = useState(3);

  useEffect(() => {
    const s = mockDb.getSettings();
    setSettings(s);
    setSpeed(s.default_speed);
    setAnimSpeed(s.animation_speed);
    setAutoStart(s.auto_start);
    setSimMode(s.simulation_mode);
    setFloorDuration(s.floor_transition_duration);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const updated: SystemSettings = {
      id: 'sys-settings',
      default_speed: speed,
      animation_speed: animSpeed,
      auto_start: autoStart,
      simulation_mode: simMode,
      floor_transition_duration: floorDuration,
      updated_at: new Date().toISOString()
    };

    mockDb.saveSettings(updated);
    setSettings(updated);
    setSuccess(true);
    setSaveMessage('All simulation settings saved and applied successfully.');
    setTimeout(() => { setSuccess(false); setSaveMessage(''); }, 3000);

    // Audit log
    mockDb.addAuditLog({
      id: `log-${Date.now()}`,
      user_email: user?.email || 'admin@demo.com',
      action: 'UPDATE_SETTINGS',
      object_type: 'SETTINGS',
      object_id: 'sys',
      previous_state: settings,
      new_state: updated,
      timestamp: new Date().toISOString()
    });
  };

  const handleResetDemoData = () => {
    if (!isAdmin) return;
    mockDb.resetToSeeds();
    setSuccess(true);
    setSaveMessage('Database reset to demo seeds. Reloading...');
    setTimeout(() => {
      setSuccess(false);
      setSaveMessage('');
      window.location.reload();
    }, 1000);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="flex h-screen w-full overflow-hidden bg-slate-950">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
          <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

          <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">System Settings & Simulation Controls</h1>
              <p className="text-xs sm:text-sm text-slate-400">Configure global simulation parameters. Changes take effect on the Live Fleet Tracking page immediately after saving.</p>
            </div>

            {/* Success Toast */}
            {success && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-green-900/50 bg-green-950/20 text-green-400 animate-in fade-in">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="text-sm font-semibold">{saveMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <form onSubmit={handleSave} className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-blue-400" />
                      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Simulation Parameters</h3>
                    </div>
                    {!isAdmin && (
                      <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-900/50 px-2.5 py-1 rounded-lg">
                        Read-Only (Manager)
                      </span>
                    )}
                  </div>

                  {/* Default Cart Speed */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-blue-400" />
                      <label className="text-xs text-slate-300 font-bold uppercase tracking-wider">Default Cart Speed Multiplier</label>
                    </div>
                    <p className="text-[11px] text-slate-500 -mt-1">
                      Sets the initial speed multiplier when starting a new drive simulation on the Live Fleet Tracking page. A value of 2 means carts move at 2x the base speed.
                    </p>
                    <div className="flex items-center gap-3">
                      {[1, 2, 5, 10].map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => setSpeed(s)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border disabled:opacity-40 disabled:cursor-not-allowed ${
                            speed === s
                              ? 'bg-blue-600 border-blue-500 text-slate-50 shadow-md shadow-blue-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono">
                      Currently: <span className="text-blue-400 font-bold">{speed}x</span> — Each grid step takes <span className="text-slate-300 font-bold">{Math.floor(800 / speed)}ms</span>
                    </p>
                  </div>

                  {/* Animation Speed */}
                  <div className="space-y-3 border-t border-slate-900 pt-6">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <label className="text-xs text-slate-300 font-bold uppercase tracking-wider">Animation Speed Multiplier</label>
                    </div>
                    <p className="text-[11px] text-slate-500 -mt-1">
                      Controls how quickly the map view updates and vehicle icons animate across the warehouse grid. Higher values = snappier visual feedback.
                    </p>
                    <div className="flex items-center gap-3">
                      {[1, 2, 5, 10].map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => setAnimSpeed(s)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border disabled:opacity-40 disabled:cursor-not-allowed ${
                            animSpeed === s
                              ? 'bg-yellow-600 border-yellow-500 text-slate-950 shadow-md shadow-yellow-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono">
                      Currently: <span className="text-yellow-400 font-bold">{animSpeed}x</span>
                    </p>
                  </div>

                  {/* Floor Elevator Transit Duration */}
                  <div className="space-y-3 border-t border-slate-900 pt-6">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-purple-400" />
                      <label className="text-xs text-slate-300 font-bold uppercase tracking-wider">Floor Elevator Transit Duration</label>
                    </div>
                    <p className="text-[11px] text-slate-500 -mt-1">
                      How many seconds a cart pauses at the elevator when transitioning between floors. Simulates real-world elevator travel time.
                    </p>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 5, 10].map((d) => (
                        <button
                          key={d}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => setFloorDuration(d)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border disabled:opacity-40 disabled:cursor-not-allowed ${
                            floorDuration === d
                              ? 'bg-purple-600 border-purple-500 text-slate-50 shadow-md shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono">
                      Currently: <span className="text-purple-400 font-bold">{floorDuration}s</span> per floor transition
                    </p>
                  </div>

                  {/* Auto-Start & Simulation Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-900 pt-6">
                    <div className="space-y-3">
                      <label className="text-xs text-slate-300 font-bold uppercase tracking-wider block">Auto-Start Next Task</label>
                      <p className="text-[11px] text-slate-500 -mt-1">
                        When enabled, carts automatically begin the next queued task after completing their current delivery.
                      </p>
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => isAdmin && setAutoStart(!autoStart)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                          autoStart
                            ? 'bg-green-950/30 border-green-900/50 text-green-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {autoStart ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                        {autoStart ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs text-slate-300 font-bold uppercase tracking-wider block">Simulation Mode</label>
                      <p className="text-[11px] text-slate-500 -mt-1">
                        AUTO assigns carts to tasks automatically. MANUAL requires clicking &quot;Start Drive&quot; for each task.
                      </p>
                      <div className="flex gap-3">
                        {(['AUTO', 'MANUAL'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => isAdmin && setSimMode(mode)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition border disabled:opacity-40 disabled:cursor-not-allowed ${
                              simMode === mode
                                ? 'bg-blue-600 border-blue-500 text-slate-50 shadow-md'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="border-t border-slate-900 pt-6 flex justify-end">
                      <button
                        type="submit"
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-extrabold text-slate-50 shadow-lg shadow-blue-600/20 transition-all duration-200 active:scale-95"
                      >
                        <Save className="h-4 w-4" /> Save All Settings
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* Right Column — Info + Reset */}
              <div className="space-y-6">
                {/* Current Active Config Summary */}
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Configuration</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900/40 border border-slate-900">
                      <span className="text-slate-400">Cart Speed</span>
                      <span className="text-blue-400 font-bold font-mono">{settings?.default_speed || 1}x</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900/40 border border-slate-900">
                      <span className="text-slate-400">Animation Speed</span>
                      <span className="text-yellow-400 font-bold font-mono">{settings?.animation_speed || 1}x</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900/40 border border-slate-900">
                      <span className="text-slate-400">Floor Transit</span>
                      <span className="text-purple-400 font-bold font-mono">{settings?.floor_transition_duration || 3}s</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900/40 border border-slate-900">
                      <span className="text-slate-400">Auto-Start</span>
                      <span className={`font-bold font-mono ${settings?.auto_start ? 'text-green-400' : 'text-slate-500'}`}>
                        {settings?.auto_start ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900/40 border border-slate-900">
                      <span className="text-slate-400">Sim Mode</span>
                      <span className="text-blue-400 font-bold font-mono">{settings?.simulation_mode || 'AUTO'}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 text-center">
                    These values are read by Live Fleet Tracking on every simulation start.
                  </p>
                </div>

                {/* Reset */}
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Demo Control Center</h3>
                  <p className="text-[11px] text-slate-500">
                    Reset all database tables (vehicles, tasks, boxes, settings) to initial demo seeds. This also resets simulation settings to defaults.
                  </p>

                  <div className="pt-2">
                    {isAdmin ? (
                      <button
                        onClick={handleResetDemoData}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-900/40 bg-red-950/20 text-red-400 hover:bg-red-950/40 text-xs font-bold transition active:scale-95"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset Database to Demo Seeds
                      </button>
                    ) : (
                      <p className="text-xs text-slate-500 text-center italic">Admin access required for database reset.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
