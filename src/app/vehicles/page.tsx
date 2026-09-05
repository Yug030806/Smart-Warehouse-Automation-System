'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { usePreventScroll } from '@/lib/usePreventScroll';
import { Search, MapPin, Truck, Plus, Trash2, BatteryCharging, AlertCircle, RefreshCw } from 'lucide-react';
import { Vehicle, Floor, Location, Task, Warehouse } from '@/lib/database.types';
import { generateUUID } from '@/lib/uuid';

export default function VehiclesPage() {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [filterWarehouse, setFilterWarehouse] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add vehicle modal visibility
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit Vehicle state
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editVName, setEditVName] = useState('');
  const [editStatus, setEditStatus] = useState<Vehicle['status']>('AVAILABLE');

  usePreventScroll(Boolean(editingVehicle || showAddModal));

  const loadVehicles = async () => {
    const [vRes, pRes, fRes, lRes, tRes, wRes] = await Promise.all([
      supabase.from('vehicles').select(),
      supabase.from('profiles').select(),
      supabase.from('floors').select(),
      supabase.from('locations').select(),
      supabase.from('tasks').select(),
      supabase.from('warehouses').select(),
    ]);

    let list = (vRes.data || []) as any[];
    const pList = pRes.data || [];
    const currentUserProfile = pList.find((p: any) => p.id === user?.id);
    const assignedWarehouses = currentUserProfile?.assigned_warehouse_ids || [];
    const isRestricted = ['MANAGER'].includes(userRole as string);

    let fls = (fRes.data || []) as Floor[];
    let locs = (lRes.data || []) as Location[];
    let tsk = (tRes.data || []) as Task[];
    let whs = (wRes.data || []) as Warehouse[];

    if (isRestricted && assignedWarehouses.length > 0) {
      const allowedF = fls.filter((f: any) => assignedWarehouses.includes(f.warehouse_id)).map((f: any) => f.id);
      const allowedL = locs.filter((l: any) => allowedF.includes(l.floor_id)).map((l: any) => l.id);

      list = list.filter((v: any) => allowedF.includes(v.current_floor_id));
      fls = fls.filter((f: any) => allowedF.includes(f.id));
      locs = locs.filter((l: any) => allowedL.includes(l.id));
      tsk = tsk.filter((t: any) => allowedL.includes(t.source_location_id));
      whs = whs.filter((w: any) => assignedWarehouses.includes(w.id));
    }

    setVehicles(list as Vehicle[]);
    setFloors(fls as Floor[]);
    setLocations(locs as Location[]);
    setTasks(tsk as Task[]);
    setWarehouses(whs as Warehouse[]);
  };

  useEffect(() => {
    loadVehicles();
    const interval = setInterval(() => {
      // Pause background polling while any modal is open
      if (!showAddModal && !editingVehicle && !document.hidden) {
        loadVehicles();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [showAddModal, editingVehicle]);

  const handleDeleteVehicle = async (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
    try {
      await supabase.from('vehicles').delete().eq('id', id);
    } catch (err: any) {
      console.error('Failed to delete vehicle:', err);
      loadVehicles();
    }
  };

  const handleSendToCharging = async (id: string) => {
    const v = vehicles.find(x => x.id === id);
    if (!v) return;

    // Find charging station on vehicle's current floor
    const charger = locations.find(l => l.floor_id === v.current_floor_id && l.type === 'CHARGING');
    if (!charger) return;

    setVehicles(prev => prev.map(item => item.id === id ? {
      ...item,
      status: 'CHARGING',
      x_position: charger.x,
      y_position: charger.y,
      current_location_id: charger.id,
      battery_percentage: 100
    } : item));

    try {
      await supabase.from('vehicles').update({
        status: 'CHARGING',
        x_position: charger.x,
        y_position: charger.y,
        current_location_id: charger.id,
        battery_percentage: 100
      }).eq('id', id);
    } catch (err: any) {
      console.error('Failed to send vehicle to charging:', err);
      loadVehicles();
    }
  };

  const handleResetVehicle = async (id: string) => {
    const v = vehicles.find(x => x.id === id);
    if (!v) return;

    const charger = locations.find(l => l.floor_id === v.current_floor_id && l.type === 'CHARGING');
    const x = charger ? charger.x : 5;
    const y = charger ? charger.y : 1;

    setVehicles(prev => prev.map(item => item.id === id ? {
      ...item,
      status: 'AVAILABLE',
      x_position: x,
      y_position: y,
      current_location_id: charger ? charger.id : null,
      current_task_id: null,
      battery_percentage: 95
    } : item));

    try {
      await supabase.from('vehicles').update({
        status: 'AVAILABLE',
        x_position: x,
        y_position: y,
        current_location_id: charger ? charger.id : null,
        current_task_id: null,
        battery_percentage: 95
      }).eq('id', id);
    } catch (err: any) {
      console.error('Failed to reset vehicle:', err);
      loadVehicles();
    }
  };

  const handleEditVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle || !editVName) return;

    setVehicles(prev => prev.map(v => v.id === editingVehicle.id ? {
      ...v,
      name: editVName,
      status: editStatus
    } : v));
    setEditingVehicle(null);

    try {
      await supabase.from('vehicles').update({
        name: editVName,
        status: editStatus
      }).eq('id', editingVehicle.id);
    } catch (err: any) {
      console.error('Failed to update vehicle:', err);
      loadVehicles();
    }
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayedVehicles = vehicles.filter(v => {
    if (filterWarehouse !== 'ALL') {
      const fl = floors.find(f => f.id === v.current_floor_id);
      if (fl?.warehouse_id !== filterWarehouse) return false;
    }
    return true;
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 relative">
      <AmbientBackground intensity="low" />
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Vehicle Fleet Roster</h1>
              <p className="text-xs sm:text-sm text-slate-400">Manage autonomous AMRs, view battery charges, assign locations and monitor tasks.</p>
            </div>
            <div className="flex items-center gap-3">
              {warehouses.length > 1 && (
                <select
                  value={filterWarehouse}
                  onChange={e => setFilterWarehouse(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Warehouses ({warehouses.length})</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              )}
              {['ADMIN', 'MANAGER'].includes(userRole) && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-slate-50 transition duration-150 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Commission AMR
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left side roster list */}
            <div className="lg:col-span-3 space-y-6">
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="pb-3">AMR Code</th>
                        <th className="pb-3">Name</th>
                        <th className="pb-3">Position</th>
                        <th className="pb-3">Battery</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Fleet Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60 text-slate-300">
                      {displayedVehicles.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            {vehicles.length === 0 ? 'No vehicles registered in fleet database.' : 'No vehicles match current warehouse filter.'}
                          </td>
                        </tr>
                      ) : (
                        displayedVehicles.map(v => {
                          const activeTask = tasks.find(t => t.id === v.current_task_id);
                          const fl = floors.find(f => f.id === v.current_floor_id);
                          const wh = warehouses.find(w => w.id === fl?.warehouse_id);
                          const flName = fl?.name || (v.current_floor_id ? `Floor ${fl?.floor_number || 1}` : 'Unassigned');
                          return (
                            <tr key={v.id}>
                              <td className="py-4 font-mono font-bold text-blue-400">{v.vehicle_code}</td>
                              <td className="py-4">
                                <span className="font-semibold text-slate-100">{v.name}</span>
                                {activeTask && <p className="text-[10px] text-slate-500">Active Task: {activeTask.task_code}</p>}
                              </td>
                              <td className="py-4">
                                <div>
                                  {wh && <span className="block text-[10px] font-semibold text-blue-400">{wh.name}</span>}
                                  <span className="font-medium text-slate-200">{flName}</span>
                                  <span className="block text-[10px] text-slate-500 font-mono">[{v.x_position}, {v.y_position}]</span>
                                </div>
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
                                      title="Reset AMR State"
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
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-bold block">
                  Status Breakdown {filterWarehouse !== 'ALL' && <span className="text-blue-400 font-normal">({warehouses.find(w => w.id === filterWarehouse)?.name})</span>}
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total commissioned:</span>
                    <span className="font-bold text-slate-200">{displayedVehicles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Duty (BUSY):</span>
                    <span className="font-bold text-blue-400">{displayedVehicles.filter(x => x.status === 'BUSY').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Standby (AVAILABLE):</span>
                    <span className="font-bold text-green-400">{displayedVehicles.filter(x => x.status === 'AVAILABLE').length}</span>
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
                  onChange={e => setEditStatus(e.target.value as Vehicle['status'])}
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
        <CommissionAmrModal
          onClose={() => setShowAddModal(false)}
          floors={floors}
          locations={locations}
          warehouses={warehouses}
          initialWarehouseId={filterWarehouse !== 'ALL' ? filterWarehouse : undefined}
          onSuccess={(newV) => {
            if (newV) setVehicles(prev => [newV, ...prev]);
            else loadVehicles();
          }}
        />
      )}
    </div>
  );
}

interface CommissionModalProps {
  onClose: () => void;
  floors: Floor[];
  locations: Location[];
  warehouses: Warehouse[];
  initialWarehouseId?: string;
  onSuccess: (newV?: Vehicle) => void;
}

function CommissionAmrModal({ onClose, floors, locations, warehouses, initialWarehouseId, onSuccess }: CommissionModalProps) {
  const [selectedWhId, setSelectedWhId] = useState<string>(() => {
    if (initialWarehouseId && warehouses.some(w => w.id === initialWarehouseId)) {
      return initialWarehouseId;
    }
    if (floors.length > 0 && floors[0].warehouse_id) {
      return floors[0].warehouse_id;
    }
    return warehouses.length > 0 ? warehouses[0].id : '';
  });

  const availableFloors = selectedWhId
    ? floors.filter(f => f.warehouse_id === selectedWhId)
    : floors;

  const initialFloor = availableFloors.length > 0 ? availableFloors[0].id : (floors[0]?.id || '');
  const [vCode, setVCode] = useState(() => `AMR-${Math.floor(Math.random() * 900 + 100)}`);
  const [vName, setVName] = useState('');
  const [floorId, setFloorId] = useState(() => initialFloor);

  const currentFloorLocations = locations.filter(l => l.floor_id === floorId);
  const [startLocId, setStartLocId] = useState(() => currentFloorLocations.length > 0 ? currentFloorLocations[0].id : '');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If warehouses arrive asynchronously, initialize selectedWhId
  useEffect(() => {
    if (!selectedWhId && warehouses.length > 0) {
      setSelectedWhId(warehouses[0].id);
    }
  }, [warehouses, selectedWhId]);

  // Keep floorId and startLocId valid when available floors change
  useEffect(() => {
    if (availableFloors.length > 0) {
      if (!floorId || !availableFloors.some(f => f.id === floorId)) {
        const nextFloor = availableFloors[0].id;
        setFloorId(nextFloor);
        const flLocs = locations.filter(l => l.floor_id === nextFloor);
        setStartLocId(flLocs.length > 0 ? flLocs[0].id : '');
      }
    }
  }, [availableFloors, floorId, locations]);

  const handleWarehouseChange = (newWhId: string) => {
    setSelectedWhId(newWhId);
    const whFloors = floors.filter(f => f.warehouse_id === newWhId);
    const nextFid = whFloors.length > 0 ? whFloors[0].id : '';
    setFloorId(nextFid);
    const flLocs = locations.filter(l => l.floor_id === nextFid);
    setStartLocId(flLocs.length > 0 ? flLocs[0].id : '');
  };

  const handleFloorChange = (newFid: string) => {
    setFloorId(newFid);
    const flLocs = locations.filter(l => l.floor_id === newFid);
    setStartLocId(flLocs.length > 0 ? flLocs[0].id : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vCode.trim() || !vName.trim()) return;

    setModalError(null);

    try {
      const selectedLoc = locations.find(l => l.id === startLocId);
      const x = selectedLoc ? selectedLoc.x : 5;
      const y = selectedLoc ? selectedLoc.y : 1;

      const targetFloorId = floorId || (availableFloors.length > 0 ? availableFloors[0].id : (floors.length > 0 ? floors[0].id : null));
      if (!targetFloorId) {
        setModalError('No floor level found to commission this AMR.');
        return;
      }

      const newId = generateUUID();
      const newVehicle: Vehicle = {
        id: newId,
        vehicle_code: vCode.trim(),
        name: vName.trim(),
        status: 'AVAILABLE',
        battery_percentage: 100,
        current_location_id: startLocId ? startLocId : null,
        current_floor_id: targetFloorId,
        x_position: x,
        y_position: y,
        speed: 1,
        current_task_id: null,
        created_at: new Date().toISOString()
      };

      // Optimistically add to list and close immediately
      onSuccess(newVehicle);
      onClose();

      (async () => {
        try {
          await supabase.from('vehicles').insert(newVehicle);
        } catch (err: any) {
          console.error('Failed to commission AMR in background:', err);
          alert('Failed to commission AMR: ' + (err?.message || 'Database error'));
        }
      })();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to commission AMR.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-100">Commission Autonomous Vehicle (AMR)</h3>

        {modalError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            {modalError}
          </div>
        )}

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

          {warehouses.length > 1 && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Warehouse Facility</label>
              <select
                value={selectedWhId}
                onChange={e => handleWarehouseChange(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-semibold text-slate-100 outline-none focus:border-blue-500"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Starting Level</label>
              <select
                value={floorId}
                onChange={e => handleFloorChange(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 outline-none focus:border-blue-500"
              >
                {availableFloors.map(f => {
                  const wh = warehouses.find(w => w.id === f.warehouse_id);
                  const flLabel = f.name || `Floor ${f.floor_number}`;
                  return (
                    <option key={f.id} value={f.id}>
                      {wh && warehouses.length > 1 ? `${flLabel} (${wh.name})` : flLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Initial Dock Node</label>
              <select
                value={startLocId}
                onChange={e => setStartLocId(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="">(Origin Node [5, 1])</option>
                {currentFloorLocations.map(l => (
                  <option key={l.id} value={l.id}>{l.name} [{l.x},{l.y}]</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition shadow-md"
          >
            {isSubmitting ? 'Commissioning...' : 'Commission & Spawn'}
          </button>
        </div>
      </form>
    </div>
  );
}
