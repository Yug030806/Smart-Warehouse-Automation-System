'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/AuthProvider';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import KpiCard from '@/components/KpiCard';
import WarehouseMap from '@/components/WarehouseMap';
import { 
  Boxes, 
  Truck, 
  ClipboardList, 
  AlertTriangle, 
  Activity, 
  CheckCircle, 
  Clock, 
  Navigation, 
  UserCheck, 
  X, 
  Brain, 
  ShieldCheck 
} from 'lucide-react';
import { Box, Vehicle, Task, Alert, Profile, Floor } from '@/lib/database.types';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('');

  const [rawBoxes, setRawBoxes] = useState<Box[]>([]);
  const [rawVehicles, setRawVehicles] = useState<Vehicle[]>([]);
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [rawAlerts, setRawAlerts] = useState<Alert[]>([]);
  const [rawLocations, setRawLocations] = useState<any[]>([]);
  const [rawProfiles, setRawProfiles] = useState<Profile[]>([]);

  // Check for pending approval requests when admin logs in (query live DB & poll)
  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    const checkPending = async () => {
      let profiles: Profile[] = [];
      const res = await supabase.from('profiles').select();
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        profiles = res.data as Profile[];
      } else {
        try {
          const apiRes = await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'select', table: 'profiles' })
          }).then(r => r.json());
          if (apiRes && apiRes.data && Array.isArray(apiRes.data)) {
            profiles = apiRes.data;
          }
        } catch {}
      }

      const pending = profiles.filter(p => !p.is_active);
      if (pending.length > 0) {
        setPendingUsers(pending);
        setShowPendingPopup(true);
      } else {
        setPendingUsers([]);
        setShowPendingPopup(false);
      }
    };

    checkPending();
  }, [user]);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  useEffect(() => {
    if (selectedWarehouseId) {
      const whFloors = floors.filter(f => f.warehouse_id === selectedWarehouseId);
      if (whFloors.length > 0) {
        if (!whFloors.some(f => f.id === selectedFloor)) {
          setSelectedFloor(whFloors[0].id);
        }
      } else {
        setSelectedFloor('');
      }
    }
  }, [selectedWarehouseId, floors]);

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      try {
        const [bRes, vRes, tRes, aRes, pRes, fRes, lRes, wRes] = await Promise.all([
          supabase.from('boxes').select(),
          supabase.from('vehicles').select(),
          supabase.from('tasks').select(),
          supabase.from('alerts').select().eq('is_acknowledged', false),
          supabase.from('profiles').select(),
          supabase.from('floors').select(),
          supabase.from('locations').select(),
          supabase.from('warehouses').select()
        ]);

        const boxes = (bRes.data || []) as Box[];
        const vehicles = (vRes.data || []) as Vehicle[];
        const tasks = (tRes.data || []) as Task[];
        const alerts = (aRes.data || []) as Alert[];
        const pList = (pRes.data || []) as Profile[];
        const fls = (fRes.data || []) as Floor[];
        const locs = (lRes.data || []) as any[];

        if (isMounted) {
          if (wRes.data) {
            setWarehouses(wRes.data);
            setSelectedWarehouseId(prev => {
              if (prev && wRes.data.some((w: any) => w.id === prev)) return prev;
              return wRes.data.length > 0 ? wRes.data[0].id : '';
            });
          }

          if (fls) {
            setFloors(fls);
          }

          setRawBoxes(boxes);
          setRawVehicles(vehicles);
          setRawTasks(tasks);
          setRawAlerts(alerts);
          setRawProfiles(pList);
          setRawLocations(locs);

          const pending = pList.filter(p => !p.is_active);
          if (pending.length > 0) {
            setPendingUsers(pending);
            setShowPendingPopup(true);
          } else {
            setPendingUsers([]);
            setShowPendingPopup(false);
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard live data:', err);
      }
    };

    fetchDashboardData();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchDashboardData();
    }, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Dynamically compute stats and rosters filtered by the selected warehouse
  const { stats, activeTasksList, vehiclesList, alertsList } = useMemo(() => {
    const isFirstWarehouse = warehouses.length > 0 && selectedWarehouseId === warehouses[0].id;
    const whFloors = floors.filter(f => f.warehouse_id === selectedWarehouseId);
    const whFloorIds = new Set(whFloors.map(f => f.id));
    const whLocs = rawLocations.filter(l => whFloorIds.has(l.floor_id));
    const whLocIds = new Set(whLocs.map(l => l.id));

    // Role restriction (for MANAGER)
    const currentUserProfile = rawProfiles.find(
      (p: any) => p.id === user?.id || (user?.email && p.email?.toLowerCase() === user?.email?.toLowerCase())
    );
    const assignedWarehouses = currentUserProfile?.assigned_warehouse_ids || [];
    const userRole = user?.user_metadata?.role || (user as any)?.role || 'OPERATOR';
    const isRestricted = ['MANAGER'].includes(userRole);

    let boxes = rawBoxes;
    let vehicles = rawVehicles;
    let tasks = rawTasks;
    let alerts = rawAlerts;

    if (isRestricted && assignedWarehouses.length > 0) {
      const allowedF = floors.filter((f: any) => assignedWarehouses.includes(f.warehouse_id)).map((f: any) => f.id);
      const allowedL = rawLocations.filter((l: any) => allowedF.includes(l.floor_id)).map((l: any) => l.id);

      vehicles = vehicles.filter((v: any) => allowedF.includes(v.current_floor_id));
      boxes = boxes.filter((b: any) => allowedL.includes(b.current_location_id));
      tasks = tasks.filter((t: any) => allowedL.includes(t.source_location_id));
    }

    if (selectedWarehouseId) {
      vehicles = vehicles.filter(v => 
        (v.current_floor_id && whFloorIds.has(v.current_floor_id)) || 
        (!v.current_floor_id && isFirstWarehouse)
      );
      boxes = boxes.filter(b => 
        (b.current_location_id && whLocIds.has(b.current_location_id)) || 
        (b.destination_location_id && whLocIds.has(b.destination_location_id)) ||
        (!b.current_location_id && !b.destination_location_id && isFirstWarehouse)
      );
      tasks = tasks.filter(t => 
        (t.source_location_id && whLocIds.has(t.source_location_id)) || 
        (t.destination_location_id && whLocIds.has(t.destination_location_id)) ||
        (!t.source_location_id && !t.destination_location_id && isFirstWarehouse)
      );
      const vehIdSet = new Set(vehicles.map(v => v.id));
      const taskIdSet = new Set(tasks.map(t => t.id));
      alerts = alerts.filter(a => 
        (a.vehicle_id && vehIdSet.has(a.vehicle_id)) || 
        (a.task_id && taskIdSet.has(a.task_id)) ||
        (!a.vehicle_id && !a.task_id && isFirstWarehouse)
      );
    }

    const totalBoxes = boxes.length;
    const pendingTasks = tasks.filter(t => t.status === 'PENDING').length;
    const activeTasks = tasks.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'PICKUP_PENDING', 'PICKED_UP', 'DELIVERING'].includes(t.status)).length;
    const completedDeliveries = tasks.filter(t => t.status === 'COMPLETED').length;
    const totalPipelineTasks = completedDeliveries + pendingTasks + activeTasks;
    const taskCompletionRate = totalPipelineTasks > 0
      ? Math.round((completedDeliveries / totalPipelineTasks) * 100)
      : 100;

    const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE').length;
    const busyVehicles = vehicles.filter(v => v.status === 'BUSY').length;
    const operationalVehicles = vehicles.filter(v => ['AVAILABLE', 'BUSY', 'CHARGING'].includes(v.status)).length;
    const fleetUptimeHealth = vehicles.length > 0
      ? Math.round((operationalVehicles / vehicles.length) * 100)
      : 100;

    const urgentTasks = tasks.filter(t => t.priority === 'URGENT' && t.status !== 'COMPLETED').length;
    const activeAlerts = alerts.length;
    const edgeAiActive = vehicles.filter(v => v.sensor_suite_active).length;
    const obstaclesToday = vehicles.reduce((sum, v) => sum + (v.obstacle_count || 0), 0);

    return {
      stats: {
        totalBoxes,
        pendingTasks,
        activeTasks,
        completedDeliveries,
        taskCompletionRate,
        availableVehicles,
        busyVehicles,
        fleetUptimeHealth,
        urgentTasks,
        activeAlerts,
        edgeAiActive,
        obstaclesToday
      },
      activeTasksList: tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').slice(0, 5) as Task[],
      vehiclesList: vehicles as Vehicle[],
      alertsList: alerts.slice(0, 5) as Alert[]
    };
  }, [selectedWarehouseId, warehouses, floors, rawLocations, rawProfiles, user, rawBoxes, rawVehicles, rawTasks, rawAlerts]);

  return (
    <div className="md:flex h-screen w-full overflow-hidden bg-slate-950 relative">
      <AmbientBackground intensity="low" />
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex flex-col w-full md:flex-1 md:min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        {/* Pending Approvals Popup Modal */}
        {showPendingPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowPendingPopup(false)} />
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">Pending Approvals</h2>
                    <p className="text-[11px] text-slate-400">{pendingUsers.length} user{pendingUsers.length !== 1 ? 's' : ''} awaiting approval</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPendingPopup(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* User list */}
              <div className="px-6 pb-4 max-h-60 overflow-y-auto space-y-2">
                {pendingUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold text-blue-400">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{u.full_name}</p>
                        <p className="text-[10px] text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-orange-950/60 text-orange-400 border border-orange-500/20">
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setShowPendingPopup(false);
                    router.push('/users');
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors"
                >
                  Review Requests
                </button>
                <button
                  onClick={() => setShowPendingPopup(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
        
        <main className="flex-grow p-3 sm:p-6 md:p-8 overflow-y-auto space-y-6 md:space-y-8 overscroll-contain w-full min-w-0">
          {/* Top Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full min-w-0">
            <div className="min-w-0 w-full sm:w-auto flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="h-6 w-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_#3b82f6] shrink-0" />
                <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight leading-tight min-w-0">
                  Smart Warehouse Telemetry
                </h1>
                <div className="system-optimal-badge hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">System Optimal</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 sm:pl-4.5">
                Autonomous fleet telemetry, inventory throughput, and AGV performance metrics.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Warehouse selector (if multiple warehouses exist) */}
              {warehouses.length > 1 && (
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#141419] border border-slate-800/80 shrink-0">
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => {
                      const newWid = e.target.value;
                      setSelectedWarehouseId(newWid);
                      const whF = floors.filter(f => f.warehouse_id === newWid);
                      setSelectedFloor(whF.length > 0 ? whF[0].id : '');
                    }}
                    className="bg-slate-900 text-xs font-bold text-slate-200 px-3 py-1.5 rounded-xl border border-slate-800 outline-none cursor-pointer"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id} className="bg-slate-900 text-slate-200">
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Floor Switcher synced to the selected warehouse */}
              <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-[#141419] border border-slate-800/80 shrink-0 w-full sm:w-auto overflow-x-auto">
                {(() => {
                  const currentWarehouseFloors = floors.filter(
                    f => !selectedWarehouseId || f.warehouse_id === selectedWarehouseId
                  );

                  if (currentWarehouseFloors.length === 0) {
                    return (
                      <span className="text-[11px] text-slate-500 px-3 py-1.5 italic">
                        No levels configured
                      </span>
                    );
                  }

                  return currentWarehouseFloors.map((f, idx) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFloor(f.id)}
                      className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 text-center whitespace-nowrap ${
                        selectedFloor === f.id
                          ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      {f.name || `Floor ${f.floor_number || idx + 1}`}
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Card Type 1: Small Multi-Number Stat Cards (Top Row) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full min-w-0">
            {/* Stat Card 1: Total Tasks */}
            <div className="rounded-2xl border border-slate-800/80 bg-[#141419] p-4 sm:p-6 shadow-xl space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider min-w-0">Transportation Tasks</span>
                <div className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                  <ClipboardList className="h-4 w-4" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 min-w-0">
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-slate-100">{stats.activeTasks}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">Active</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-amber-400">{stats.pendingTasks}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">Pending</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-emerald-400">{stats.completedDeliveries}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">Completed</div>
                </div>
              </div>
            </div>

            {/* Stat Card 2: AGV Fleet Overview */}
            <div className="rounded-2xl border border-slate-800/80 bg-[#141419] p-4 sm:p-6 shadow-xl space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider min-w-0">AGV Fleet Status</span>
                <div className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shrink-0">
                  <Truck className="h-4 w-4" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 min-w-0">
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-emerald-400">{stats.availableVehicles}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">Available</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-blue-400">{stats.busyVehicles}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">Busy</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-purple-400">{stats.edgeAiActive}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">Edge-AI</div>
                </div>
              </div>
            </div>

            {/* Stat Card 3: Inventory & Safety Metrics */}
            <div className="rounded-2xl border border-slate-800/80 bg-[#141419] p-4 sm:p-6 shadow-xl space-y-4 sm:col-span-2 lg:col-span-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider min-w-0">Payloads & System Alerts</span>
                <div className="h-9 w-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                  <Boxes className="h-4 w-4" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 min-w-0">
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-slate-100">{stats.totalBoxes}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">Packets</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-red-400">{stats.activeAlerts}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">Alerts</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-black text-amber-400">{stats.obstaclesToday}</div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-0.5">Obstacles</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Live Map Panel & Ranked List */}
            <div className="lg:col-span-2 space-y-6">
              {/* Floor Switcher */}
              {(() => {
                const whFloors = floors.filter(
                  f => !selectedWarehouseId || f.warehouse_id === selectedWarehouseId
                );
                if (whFloors.length <= 1) return null;
                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141419] border border-slate-800/80 rounded-2xl p-3 px-4 shadow-lg">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Floor Level:</span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto">
                      {whFloors.map(f => (
                        <button
                          key={f.id}
                          onClick={() => setSelectedFloor(f.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            selectedFloor === f.id
                              ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {f.name || `Floor ${f.floor_number}`}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Card Type 5: Map / Availability Digital Twin Card */}
              {(() => {
                const curFloor = floors.find(f => f.id === selectedFloor);
                const curWarehouse = warehouses.find(w => w.id === curFloor?.warehouse_id);
                return <WarehouseMap floorId={selectedFloor} warehouseName={curWarehouse?.name} />;
              })()}
              
              {/* Active Tasks Dispatch Log Table */}
              <div className="rounded-2xl border border-slate-800/80 bg-[#141419] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Active Task Dispatch Pipeline</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-400">{activeTasksList.length} Tasks Live</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-extrabold">
                        <th className="pb-3">Task ID</th>
                        <th className="pb-3">Vehicle</th>
                        <th className="pb-3">Priority</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Est Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeTasksList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500 font-medium">No active transportation tasks currently executing.</td>
                        </tr>
                      ) : (
                        activeTasksList.map(task => (
                          <tr key={task.id} className="text-slate-300">
                            <td className="py-3.5 font-mono font-bold text-cyan-400">{task.task_code}</td>
                            <td className="py-3.5 font-bold">
                              {task.vehicle_id ? (
                                <span className="flex items-center gap-1.5 text-blue-400"><Truck className="h-3.5 w-3.5" /> {vehiclesList.find(v => v.id === task.vehicle_id)?.vehicle_code}</span>
                              ) : (
                                <span className="text-slate-500 font-normal">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3.5">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider ${
                                task.priority === 'URGENT' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : (task.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400')
                              }`}>{task.priority}</span>
                            </td>
                            <td className="py-3.5">
                              <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
                                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                                {task.status}
                              </span>
                            </td>
                            <td className="py-3.5 text-slate-400 font-mono">{task.estimated_duration}s</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Side Status Column & Ring Cards */}
            <div className="space-y-6">
              {/* Card Type 4: Circular Progress / Ring Card 1 (Task Success Rate) */}
              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-amber-950/40 via-[#141419] to-[#141419] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Task Completion Rate</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-extrabold border border-amber-500/30">{stats.taskCompletionRate}% ↗</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xl font-black text-slate-100">{stats.completedDeliveries}</div>
                      <div className="text-[10px] font-bold text-slate-400">Delivered</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-amber-400">{stats.pendingTasks}</div>
                      <div className="text-[10px] font-bold text-slate-400">In Pipeline</div>
                    </div>
                  </div>
                  
                  {/* Styled Ring Representation */}
                  <div className="relative h-24 w-24 flex items-center justify-center rounded-full bg-slate-900 border-4 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                    <div className="text-center">
                      <div className="text-lg font-black text-amber-400">{stats.taskCompletionRate}%</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase">Success</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Type 4: Circular Progress / Ring Card 2 (AGV Fleet Health) */}
              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-purple-950/40 via-[#141419] to-[#141419] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Fleet Uptime Health</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-extrabold border border-purple-500/30">{stats.fleetUptimeHealth}% ↗</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xl font-black text-purple-400">{stats.edgeAiActive} / {vehiclesList.length}</div>
                      <div className="text-[10px] font-bold text-slate-400">Edge-AI Bots</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-emerald-400">{stats.availableVehicles}</div>
                      <div className="text-[10px] font-bold text-slate-400">Ready Docks</div>
                    </div>
                  </div>
                  
                  {/* Styled Ring Representation */}
                  <div className="relative h-24 w-24 flex items-center justify-center rounded-full bg-slate-900 border-4 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                    <div className="text-center">
                      <div className="text-lg font-black text-purple-400">{stats.fleetUptimeHealth}%</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase">Uptime</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Type 3: Ranked Category List Card */}
              <div className="rounded-2xl border border-slate-800/80 bg-[#141419] p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">AGV Fleet Roster</span>
                  <span className="text-[10px] font-bold text-cyan-400">{vehiclesList.length} Units</span>
                </div>
                <div className="space-y-2.5">
                  {vehiclesList.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs font-medium">
                      No AGVs assigned to this facility.
                    </div>
                  ) : (
                    vehiclesList.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-800/60 bg-slate-900/60 hover:border-slate-700 transition-colors">
                        <div>
                          <div className="text-xs font-black text-slate-100">{v.vehicle_code}</div>
                          <div className="text-[10px] font-medium text-slate-400">{v.name}</div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            v.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : (v.status === 'BUSY' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30')
                          }`}>{v.status}</span>
                          <div className="text-[10px] font-bold text-slate-400 mt-1">
                            Battery: {v.battery_percentage}%
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
