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
import { Task, Vehicle, Box, Location } from '@/lib/database.types';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Search & Recommendations
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendedTask, setRecommendedTask] = useState<Task | null>(null);
  const [recReason, setRecReason] = useState('');

  const loadTasksData = () => {
    const t = supabase.from('tasks').select().data || [];
    setTasks(t as Task[]);

    const v = supabase.from('vehicles').select().data || [];
    setVehicles(v as Vehicle[]);

    const b = supabase.from('boxes').select().data || [];
    setBoxes(b as Box[]);

    const l = supabase.from('locations').select().data || [];
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

    supabase.from('boxes').update({
      status: 'WAITING'
    }).eq('id', t.box_id);

    loadTasksData();
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Transportation Tasks Console</h1>
              <p className="text-xs sm:text-sm text-slate-400">View tasks backlog scheduler, trigger AI vehicle assignments, and track delivery lifecycles.</p>
            </div>
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
              <button
                onClick={() => handleAutoAssign(recommendedTask.id)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-slate-50 transition shrink-0"
              >
                Dispatch Recommended Vehicle
              </button>
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
                            {task.status === 'PENDING' && (
                              <button
                                onClick={() => handleAutoAssign(task.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[10px] font-bold text-slate-50"
                              >
                                <Truck className="h-3.5 w-3.5" /> Auto Assign Cart
                              </button>
                            )}

                            {['PENDING', 'ASSIGNED'].includes(task.status) && (
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
    </div>
  );
}
