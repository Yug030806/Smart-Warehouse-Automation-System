'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { usePreventScroll } from '@/lib/usePreventScroll';
import { Search, MapPin, Truck, Plus, Trash2, BatteryCharging, AlertCircle, RefreshCw } from 'lucide-react';
import { Vehicle, Floor, Location, Task } from '@/lib/database.types';

export default function VehiclesPage() {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Add vehicle Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [vCode, setVCode] = useState('');
  const [vName, setVName] = useState('');
  const [floorId, setFloorId] = useState('');
  const [startLocId, setStartLocId] = useState('');

  // Edit Vehicle state
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editVName, setEditVName] = useState('');
  const [editStatus, setEditStatus] = useState<string>('AVAILABLE');

  usePreventScroll(Boolean(editingVehicle || showAddModal));

  const loadVehicles = () => {
    let list = (supabase.from('vehicles').select().data || []) as any[];
    const pList = supabase.from('profiles').select().data || [];
    const currentUserProfile = pList.find((p: any) => p.id === user?.id);
    const assignedWarehouses = currentUserProfile?.assigned_warehouse_ids || [];
    const isRestricted = ['MANAGER'].includes(userRole as string);

    let fls = supabase.from('floors').select().data || [];
    let locs = supabase.from('locations').select().data || [];
    let tsk = supabase.from('tasks').select().data || [];

    if (isRestricted && assignedWarehouses.length > 0) {
      const allowedF = fls.filter((f: any) => assignedWarehouses.includes(f.warehouse_id)).map((f: any) => f.id);
      const allowedL = locs.filter((l: any) => allowedF.includes(l.floor_id)).map((l: any) => l.id);

      list = list.filter((v: any) => allowedF.includes(v.current_floor_id));
      fls = fls.filter((f: any) => allowedF.includes(f.id));
      locs = locs.filter((l: any) => allowedL.includes(l.id));
      tsk = tsk.filter((t: any) => allowedL.includes(t.source_location_id));
    } else if (isRestricted) {
      list = [];
      fls = [];
      locs = [];
      tsk = [];
    }

    setVehicles(list as Vehicle[]);

    setFloors(fls as Floor[]);
    if (fls.length > 0) setFloorId(fls[0].id);

    setLocations(locs as Location[]);
    if (locs.length > 0) setStartLocId(locs[0].id);

    setTasks(tsk as Task[]);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vCode || !vName) return;

    // Find start location coordinates
    const selectedLoc = locations.find(l => l.id === startLocId);
    const x = selectedLoc ? selectedLoc.x : 5;
    const y = selectedLoc ? selectedLoc.y : 1;

    const newVehicle: Vehicle = {
      id: `v-${Date.now()}`,
      vehicle_code: vCode,
      name: vName,
      status: 'AVAILABLE',
      battery_percentage: 100,
      current_location_id: startLocId,
      current_floor_id: floorId,
      x_position: x,
      y_position: y,
      speed: 1,
      current_task_id: null,
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    supabase.from('vehicles').insert(newVehicle);
    setShowAddModal(false);
    setVCode('');
    setVName('');
    loadVehicles();
  };

  const handleDeleteVehicle = (id: string) => {
    supabase.from('vehicles').delete().eq('id', id);
    loadVehicles();
  };

  const handleSendToCharging = (id: string) => {
    const v = vehicles.find(x => x.id === id);
    if (!v) return;

    // Find charging station on vehicle's current floor
    const charger = locations.find(l => l.floor_id === v.current_floor_id && l.type === 'CHARGING');
    if (!charger) return;

    supabase.from('vehicles').update({
      status: 'CHARGING',
      x_position: charger.x,
      y_position: charger.y,
      current_location_id: charger.id,
      battery_percentage: 100
    }).eq('id', id);

    loadVehicles();
  };

  const handleResetVehicle = (id: string) => {
    const v = vehicles.find(x => x.id === id);
    if (!v) return;

    const charger = locations.find(l => l.floor_id === v.current_floor_id && l.type === 'CHARGING');
    const x = charger ? charger.x : 5;
    const y = charger ? charger.y : 1;

    supabase.from('vehicles').update({
      status: 'AVAILABLE',
      x_position: x,
      y_position: y,
      current_location_id: charger ? charger.id : null,
      current_task_id: null,
      battery_percentage: 95
    }).eq('id', id);

    loadVehicles();
  };



  const handleEditVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle || !editVName) return;

    supabase.from('vehicles').update({
      name: editVName,
      status: editStatus
    }).eq('id', editingVehicle.id);

    setEditingVehicle(null);
    loadVehicles();
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Vehicle Fleet Roster</h1>
              <p className="text-xs sm:text-sm text-slate-400">Manage autonomous carts, view battery charges, assign locations and monitor tasks.</p>
            </div>
            {['ADMIN', 'MANAGER'].includes(userRole) && (
              <button
                onClick={() => {
                  setVCode(`CART-${Math.floor(Math.random() * 900 + 100)}`);
                  setShowAddModal(true);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-slate-50 transition duration-150 shrink-0"
              >
                <Plus className="h-4 w-4" /> Commission Cart
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left side roster list */}
            <div className="lg:col-span-3 space-y-6">
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="pb-3">Cart Code</th>
                        <th className="pb-3">Name</th>
                        <th className="pb-3">Position</th>
                        <th className="pb-3">Battery</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Fleet Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60 text-slate-300">
                      {vehicles.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">No vehicles registered in fleet database.</td>
                        </tr>
                      ) : (
                        vehicles.map(v => {
                          const activeTask = tasks.find(t => t.id === v.current_task_id);
                          return (
                            <tr key={v.id}>
                              <td className="py-4 font-mono font-bold text-blue-400">{v.vehicle_code}</td>
                              <td className="py-4">
                                <span className="font-semibold text-slate-100">{v.name}</span>
                                {activeTask && <p className="text-[10px] text-slate-500">Active Task: {activeTask.task_code}</p>}
                              </td>
                              <td className="py-4">
                                <span className="font-medium text-slate-300">Floor {v.current_floor_id === 'f-01' ? '1' : v.current_floor_id === 'f-02' ? '2' : '3'}</span>
                                <span className="block text-[10px] text-slate-500 font-mono">[{v.x_position}, {v.y_position}]</span>
                              </td>
                              <td className="py-4">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className={`h-2.5 w-8 rounded-sm bg-slate-800 relative overflow-hidden border border-slate-700`}>
                                    <span 
                                      className={`absolute left-0 top-0 bottom-0 ${v.battery_percentage <= 20 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${v.battery_percentage}%` }}
                                    />
                                  </span>
                                  <span className="font-mono text-[10px]">{v.battery_percentage}%</span>
                                </div>
                              </td>
                              <td className="py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  v.status === 'AVAILABLE' ? 'bg-green-950 text-green-400' : (v.status === 'BUSY' ? 'bg-blue-950 text-blue-400' : 'bg-red-950 text-red-400')
                                }`}>{v.status}</span>
                              </td>
                              <td className="p-4 text-right space-x-1.5">
                                {['ADMIN', 'MANAGER'].includes(userRole) && (
                                  <button
                                    onClick={() => {
                                      setEditingVehicle(v);
                                      setEditVName(v.name);
                                      setEditStatus(v.status);
                                    }}
                                    title="Edit Vehicle Specs"
                                    className="p-1.5 rounded border border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 font-semibold text-[11px]"
                                  >
                                    Edit
                                  </button>
                                )}
                                {['ADMIN', 'MANAGER', 'OPERATOR'].includes(userRole) && (
                                  <>
                                    <button
                                      onClick={() => handleSendToCharging(v.id)}
                                      disabled={v.status === 'CHARGING'}
                                      title="Send to charging dock"
                                      className="p-1.5 rounded border border-slate-800 bg-slate-950 text-yellow-500 hover:bg-slate-900 disabled:opacity-30"
                                    >
                                      <BatteryCharging className="h-4.5 w-4.5" />
                                    </button>
                                    <button
                                      onClick={() => handleResetVehicle(v.id)}
                                      title="Reset Cart State"
                                      className="p-1.5 rounded border border-slate-800 bg-slate-950 text-blue-400 hover:bg-slate-900"
                                    >
                                      <RefreshCw className="h-4.5 w-4.5" />
                                    </button>
                                  </>
                                )}
                                {['ADMIN', 'MANAGER'].includes(userRole) && (
                                  <button
                                    onClick={() => handleDeleteVehicle(v.id)}
                                    className="p-1.5 rounded bg-red-950/20 text-red-400 hover:bg-red-950/40"
                                    title="Delete Vehicle"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick status summary panels */}
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-bold block">Status Breakdown</span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total commissioned:</span>
                    <span className="font-bold text-slate-200">{vehicles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Duty (BUSY):</span>
                    <span className="font-bold text-blue-400">{vehicles.filter(x => x.status === 'BUSY').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Standby (AVAILABLE):</span>
                    <span className="font-bold text-green-400">{vehicles.filter(x => x.status === 'AVAILABLE').length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Vehicle Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleEditVehicleSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Edit Vehicle Specs ({editingVehicle.vehicle_code})</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Callsign / Name</label>
                <input
                  type="text"
                  required
                  value={editVName}
                  onChange={e => setEditVName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Operational Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="BUSY">BUSY</option>
                  <option value="CHARGING">CHARGING</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="OFFLINE">OFFLINE</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setEditingVehicle(null)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Update Vehicle</button>
            </div>
          </form>
        </div>
      )}

      {/* Commission Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleAddVehicle} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Commission Autonomous Vehicle</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehicle Identifier Code</label>
                <input
                  type="text"
                  required
                  value={vCode}
                  onChange={e => setVCode(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Callsign / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pallet Runner Sigma"
                  value={vName}
                  onChange={e => setVName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Starting Level</label>
                  <select
                    value={floorId}
                    onChange={e => setFloorId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400"
                  >
                    {floors.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Initial Dock Node</label>
                  <select
                    value={startLocId}
                    onChange={e => setStartLocId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400"
                  >
                    {locations.filter(l => l.floor_id === floorId).map(l => (
                      <option key={l.id} value={l.id}>{l.name} [{l.x},{l.y}]</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Commission & Spawn</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
