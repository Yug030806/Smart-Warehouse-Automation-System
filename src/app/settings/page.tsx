'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { Settings, Save, ShieldCheck, PlayCircle, Sparkles } from 'lucide-react';
import { SystemSettings } from '@/lib/database.types';
import mockDb from '@/lib/supabase/mockDb';

import { useAuth } from '@/lib/supabase/AuthProvider';

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [success, setSuccess] = useState(false);

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
    setTimeout(() => setSuccess(false), 2000);

    // Audit log
    mockDb.addAuditLog({
      id: `log-${Date.now()}`,
      user_email: user?.email || 'admin@demo.com',
      action: 'UPDATE_SETTINGS',
      object_type: 'SETTINGS',
      object_id: 'sys',
      previous_state: null,
      new_state: updated,
      timestamp: new Date().toISOString()
    });
  };

  const handleResetDemoData = () => {
    mockDb.resetToSeeds();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    window.location.reload();
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">System Config & Simulation Controls</h1>
            <p className="text-xs sm:text-sm text-slate-400">Configure global movement speeds, transitions, automation defaults and reset seed data.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <form onSubmit={handleSave} className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Simulator settings</h3>
                  {success && <span className="text-[10px] font-bold text-green-400">Settings saved successfully.</span>}
                </div>

                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-bold uppercase tracking-wider block">Default Cart Speed</label>
                    <input
                      type="number"
                      value={speed}
                      onChange={e => setSpeed(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-bold uppercase tracking-wider block">Animation Speed multiplier</label>
                    <input
                      type="number"
                      value={animSpeed}
                      onChange={e => setAnimSpeed(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-bold uppercase tracking-wider block">Auto-start next queued task</label>
                    <select
                      value={autoStart ? 'true' : 'false'}
                      onChange={e => setAutoStart(e.target.value === 'true')}
                      className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 font-semibold"
                    >
                      <option value="true">Enable Auto-Start</option>
                      <option value="false">Disable Auto-Start</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-bold uppercase tracking-wider block">Floor Elevator Transit Duration (sec)</label>
                    <input
                      type="number"
                      value={floorDuration}
                      onChange={e => setFloorDuration(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-900 pt-6 flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-slate-50 transition"
                  >
                    <Save className="h-4 w-4" /> Save Settings
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Demo Reset utilities */}
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Demo Control center</h3>
                <p className="text-xs text-slate-500 mt-1">Reset all database tables to initial seeds layout coordinates.</p>
              </div>

              <div className="pt-4 border-t border-slate-900 space-y-4">
                <button
                  onClick={handleResetDemoData}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-900/30 bg-red-950/20 text-red-400 hover:bg-red-950/30 text-xs font-bold transition"
                >
                  <PlayCircle className="h-4 w-4" />
                  RESET DATABASE TO DEMO SEEDS
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
