'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { calculateRoute } from '@/lib/algorithms/astar';
import { 
  ClipboardList, 
  Search, 
  ArrowRight, 
  Truck, 
  Play, 
  Pause, 
  XSquare,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { usePreventScroll } from '@/lib/usePreventScroll';
import { Task, Vehicle, Box, Location } from '@/lib/database.types';

export default function TasksPage() {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Search & Recommendations
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendedTask, setRecommendedTask] = useState<Task | null>(null);
  const [recReason, setRecReason] = useState('');

  // Manual assignment state
  const [manualAssignTask, setManualAssignTask] = useState<Task | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  // Create Task Modal state
  const [showCreateTask, setShowCreateTask] = useState(false);

  usePreventScroll(Boolean(manualAssignTask || showCreateTask));

  const loadTasksData = () => {
    let t = supabase.from('tasks').select().data || [];
    let v = supabase.from('vehicles').select().data || [];
    let b = supabase.from('boxes').select().data || [];
    let l = supabase.from('locations').select().data || [];

    const pList = supabase.from('profiles').select().data || [];
    const currentUserProfile = pList.find((p: any) => p.id === user?.id);
    const assignedWarehouses = currentUserProfile?.assigned_warehouse_ids || [];
    const isRestricted = ['MANAGER'].includes(userRole);

    if (isRestricted && assignedWarehouses.length > 0) {
        const fls = (supabase.from('floors').select().data || []) as any[];
        const allowedF = fls.filter((f: any) => assignedWarehouses.includes(f.warehouse_id)).map((f: any) => f.id);
        const allowedL = l.filter((loc: any) => allowedF.includes(loc.floor_id)).map((loc: any) => loc.id);

        v = v.filter((vh: any) => allowedF.includes(vh.current_floor_id));
        b = b.filter((bx: any) => allowedL.includes(bx.current_location_id));
        t = t.filter((tsk: any) => allowedL.includes(tsk.source_location_id));
        l = l.filter((loc: any) => allowedL.includes(loc.id));
    } else if (isRestricted) {
        t = []; v = []; b = []; l = [];
    }

    setTasks(t as Task[]);
    setVehicles(v as Vehicle[]);
    setBoxes(b as Box[]);
    setLocations(l as Location[]);
  };

  useEffect(() => {
    loadTasksData();
    const interval = setInterval(loadTasksData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Intelligent Priority Scoring Engine
  useEffect(() => {
    const pending = tasks.filter(t => t.status === 'PENDING');
    if (pending.length === 0) {
      setRecommendedTask(null);
      setRecReason('');
      return;
    }

    // Score calculations
    let bestTask: Task | null = null;
    let maxScore = -1;
    let reasonStr = '';

    pending.forEach(t => {
      let base = t.priority === 'URGENT' ? 100 : (t.priority === 'HIGH' ? 50 : 10);
      
      // Calculate waiting time bonus (1 point per minute since creation)
      const waitMinutes = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 60000);
      const waitBonus = Math.max(0, waitMinutes);
      
      const totalScore = base + waitBonus;

      if (totalScore > maxScore) {
        maxScore = totalScore;
        bestTask = t;
        const boxCode = boxes.find(bx => bx.id === t.box_id)?.box_code || 'Cargo';
        reasonStr = `${boxCode} selected because priority is ${t.priority} and has been waiting in queue for ${waitMinutes} minutes.`;
      }
    });

    if (bestTask) {
      setRecommendedTask(bestTask);
      setRecReason(reasonStr);
    }
  }, [tasks, boxes]);

  // Vehicle Selection and Task Assignment Engine
  const handleAutoAssign = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Filter available vehicles (battery > 15)
    const candidates = vehicles.filter(v => v.status === 'AVAILABLE' && v.battery_percentage > 15);
    if (candidates.length === 0) {
      supabase.from('alerts').insert({
        id: `alert-${Date.now()}`,
        type: 'SYSTEM_ERROR',
        severity: 'CRITICAL',
        message: `Task ${task.task_code} failed auto-assignment: No available vehicles in database.`,
        task_id: taskId,
        is_acknowledged: false,
        resolved_at: null,
        created_at: new Date().toISOString()
      });
      return;
    }

    const srcLoc = locations.find(l => l.id === task.source_location_id);
    if (!srcLoc) return;

    // Selection criteria:
    // Distance score = math grid distance + floor penalty (5 units per floor change)
    let bestVehicle: Vehicle = candidates[0];
    let minDistanceScore = 99999;

    candidates.forEach(v => {
      // Find starting location or coordinates of candidate
      const dx = Math.abs(v.x_position - srcLoc.x);
      const dy = Math.abs(v.y_position - srcLoc.y);
      const gridDist = dx + dy;

      const isSameFloor = v.current_floor_id === srcLoc.floor_id;
      const floorPenalty = isSameFloor ? 0 : 10;
      const score = gridDist + floorPenalty;

      if (score < minDistanceScore) {
        minDistanceScore = score;
        bestVehicle = v;
      }
    });

    // Solve pathfinding route coordinates using A* algorithm
    const destLoc = locations.find(l => l.id === task.destination_location_id);
    if (!destLoc) return;

    const routePts = calculateRoute(
      bestVehicle.current_floor_id,
      bestVehicle.x_position,
      bestVehicle.y_position,
      destLoc.floor_id,
      destLoc.x,
      destLoc.y,
      locations
    );

    // Save assigned route coordinates in Routes table
    supabase.from('routes').insert({
      id: `route-${Date.now()}`,
      task_id: taskId,
      path_coordinates: routePts,
      created_at: new Date().toISOString()
    });

    // Update vehicle properties
    supabase.from('vehicles').update({
      status: 'BUSY',
      current_task_id: taskId
    }).eq('id', bestVehicle.id);

    // Update task to assigned status
    supabase.from('tasks').update({
      status: 'ASSIGNED',
      vehicle_id: bestVehicle.id,
      assigned_at: new Date().toISOString()
    }).eq('id', taskId);

    // Update box status to assigned
    supabase.from('boxes').update({
      status: 'ASSIGNED'
    }).eq('id', task.box_id);

    // Add Audit Log
    supabase.from('audit_logs').insert({
      id: `log-${Date.now()}`,
      user_email: 'system',
      action: 'TASK_ASSIGNED',
      object_type: 'TASK',
      object_id: taskId,
      previous_state: { status: 'PENDING' },
      new_state: { status: 'ASSIGNED', vehicle_id: bestVehicle.id },
      timestamp: new Date().toISOString()
    });

    loadTasksData();
  };

  const handleCancelTask = (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;

    if (t.vehicle_id) {
      supabase.from('vehicles').update({
        status: 'AVAILABLE',
        current_task_id: null
      }).eq('id', t.vehicle_id);
    }

    supabase.from('tasks').update({
      status: 'CANCELLED'
    }).eq('id', taskId);

    loadTasksData();
  };

  const [selectedBoxId, setSelectedBoxId] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');

  const handleManualAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAssignTask || !selectedVehicleId) return;
    const chosen = vehicles.find(v => v.id === selectedVehicleId);
    const destLoc = locations.find(l => l.id === manualAssignTask.destination_location_id);
    if (!chosen || !destLoc) return;

    const routePts = calculateRoute(
      chosen.current_floor_id,
      chosen.x_position,
      chosen.y_position,
      destLoc.floor_id,
      destLoc.x,
      destLoc.y,
      locations
    );

    supabase.from('routes').insert({
      id: `route-${Date.now()}`,
      task_id: manualAssignTask.id,
      path_coordinates: routePts,
      created_at: new Date().toISOString()
    });

    supabase.from('vehicles').update({
      status: 'BUSY',
      current_task_id: manualAssignTask.id
    }).eq('id', chosen.id);

    supabase.from('tasks').update({
      vehicle_id: chosen.id,
      status: 'ASSIGNED',
      assigned_at: new Date().toISOString()
    }).eq('id', manualAssignTask.id);

    supabase.from('boxes').update({
      status: 'ASSIGNED'
    }).eq('id', manualAssignTask.box_id);

    setManualAssignTask(null);
    setSelectedVehicleId('');
    loadTasksData();
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoxId) return;

    const targetBox = boxes.find(b => b.id === selectedBoxId);
    if (!targetBox) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      task_code: `TSK-${Date.now().toString().substring(7)}`,
      box_id: targetBox.id,
      vehicle_id: null,
      source_location_id: targetBox.current_location_id,
      destination_location_id: targetBox.destination_location_id,
      priority: taskPriority,
      status: 'PENDING',
      priority_score: taskPriority === 'URGENT' ? 100 : (taskPriority === 'HIGH' ? 50 : 10),
      estimated_distance: 15,
      estimated_duration: 120,
      actual_duration: null,
      created_by: 'operator@demo.com',
      assigned_at: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    supabase.from('tasks').insert(newTask);
    supabase.from('boxes').update({ status: 'WAITING', priority: taskPriority }).eq('id', targetBox.id);

    setShowCreateTask(false);
    setSelectedBoxId('');
    loadTasksData();
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
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Transportation Tasks Console</h1>
              <p className="text-xs sm:text-sm text-slate-400">View tasks backlog scheduler, trigger AI vehicle assignments, and track delivery lifecycles.</p>
            </div>
            {['ADMIN', 'MANAGER'].includes(userRole) && (
              <button
                onClick={() => setShowCreateTask(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-slate-50 transition shrink-0"
              >
                + Create New Task
              </button>
            )}
          </div>

          {/* Recommended AI task alert card */}
          {recommendedTask && (
            <div className="rounded-xl border border-blue-900/40 bg-blue-950/15 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-blue-950/5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest block font-mono">Priority Engine Recommendation</span>
                  <p className="text-xs text-slate-300 mt-1 font-medium">{recReason}</p>
                </div>
              </div>
              {['ADMIN', 'MANAGER', 'OPERATOR'].includes(userRole) && (
                <button
                  onClick={() => handleAutoAssign(recommendedTask.id)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-slate-50 transition shrink-0"
                >
                  Dispatch Recommended Vehicle
                </button>
              )}
            </div>
          )}

          {/* Tasks backlog list */}
          <div className="rounded-xl border border-slate-900 bg-slate-950 p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3">Task ID</th>
                    <th className="pb-3">Box Payload</th>
                    <th className="pb-3">Route Nodes</th>
                    <th className="pb-3">Priority</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-slate-300">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">No active transportation tasks. Register box payloads first.</td>
                    </tr>
                  ) : (
                    tasks.map(task => {
                      const box = boxes.find(b => b.id === task.box_id);
                      const src = locations.find(l => l.id === task.source_location_id)?.name || 'Pickup';
                      const dest = locations.find(l => l.id === task.destination_location_id)?.name || 'Destination';
                      const assignedCart = vehicles.find(v => v.id === task.vehicle_id);

                      return (
                        <tr key={task.id}>
                          <td className="py-4 font-mono font-bold text-blue-400">{task.task_code}</td>
                          <td className="py-4">
                            <span className="font-semibold text-slate-100 block">{box ? box.box_code : 'Payload'}</span>
                            <span className="text-[10px] text-slate-500">{box ? box.product_name : 'N/A'}</span>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-1 text-slate-300">
                              <span className="font-semibold">{src}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                              <span className="font-semibold text-blue-400">{dest}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              task.priority === 'URGENT' ? 'bg-red-950 text-red-400' : (task.priority === 'HIGH' ? 'bg-yellow-950 text-yellow-500' : 'bg-slate-900 text-slate-400')
                            }`}>{task.priority}</span>
                          </td>
                          <td className="py-4">
                            <div className="flex flex-col gap-1">
                              <span className={`font-bold text-[10px] uppercase ${
                                task.status === 'COMPLETED' ? 'text-green-400' : (task.status === 'PENDING' ? 'text-slate-500' : 'text-blue-400')
                              }`}>{task.status}</span>
                              {assignedCart && (
                                <span className="text-[9px] text-slate-500 font-mono">Cart: {assignedCart.vehicle_code}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 text-right space-x-2">
                            {task.status === 'PENDING' && ['ADMIN', 'MANAGER', 'OPERATOR'].includes(userRole) && (
                              <>
                                <button
                                  onClick={() => handleAutoAssign(task.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[10px] font-bold text-slate-50"
                                >
                                  <Truck className="h-3.5 w-3.5" /> Auto Assign
                                </button>
                                <button
                                  onClick={() => { setManualAssignTask(task); setSelectedVehicleId(vehicles.find(v => v.status === 'AVAILABLE')?.id || ''); }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-[10px] font-bold text-slate-300"
                                >
                                  Manual Pick
                                </button>
                              </>
                            )}

                            {['PENDING', 'ASSIGNED'].includes(task.status) && ['ADMIN', 'MANAGER'].includes(userRole) && (
                              <button
                                onClick={() => handleCancelTask(task.id)}
                                className="p-1.5 rounded bg-red-950/20 text-red-400 hover:bg-red-950/40"
                                title="Cancel Task"
                              >
                                <XSquare className="h-4 w-4" />
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
        </main>
      </div>

      {/* Manual Assignment Modal */}
      {manualAssignTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleManualAssignSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Manual Vehicle Assignment ({manualAssignTask.task_code})</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Select AGV/AMR Vehicle</label>
                <select
                  value={selectedVehicleId}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                >
                  {vehicles.filter(v => v.status === 'AVAILABLE').map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_code} - {v.name} (Battery: {v.battery_percentage}%, Floor {v.current_floor_id === 'f-01' ? '1' : v.current_floor_id === 'f-02' ? '2' : '3'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setManualAssignTask(null)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Assign Selected Cart</button>
            </div>
          </form>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateTaskSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Create Transportation Order</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Select Waiting Payload Box</label>
                <select
                  value={selectedBoxId}
                  onChange={e => setSelectedBoxId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                >
                  <option value="">-- Choose Box Payload --</option>
                  {boxes.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.box_code} - {b.product_name} ({b.priority})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Task Priority Level</label>
                <select
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowCreateTask(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" disabled={!selectedBoxId} className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg disabled:opacity-40">Dispatch Order</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
