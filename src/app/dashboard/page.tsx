'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/AuthProvider';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
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
  Navigation
} from 'lucide-react';
import { Box, Vehicle, Task, Alert } from '@/lib/database.types';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalBoxes: 0,
    pendingTasks: 0,
    activeTasks: 0,
    completedDeliveries: 0,
    availableVehicles: 0,
    busyVehicles: 0,
    urgentTasks: 0,
    activeAlerts: 0
  });

  const [activeTasksList, setActiveTasksList] = useState<Task[]>([]);
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>([]);
  const [alertsList, setAlertsList] = useState<Alert[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('f-01');

  useEffect(() => {
    const fetchDashboardData = () => {
      const boxes = supabase.from('boxes').select().data || [];
      const vehicles = supabase.from('vehicles').select().data || [];
      const tasks = supabase.from('tasks').select().data || [];
      const alerts = supabase.from('alerts').select().eq('is_acknowledged', false).data || [];

      const totalBoxes = boxes.length;
      const pendingTasks = tasks.filter(t => t.status === 'PENDING').length;
      const activeTasks = tasks.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'PICKUP_PENDING', 'PICKED_UP', 'DELIVERING'].includes(t.status)).length;
      const completedDeliveries = tasks.filter(t => t.status === 'COMPLETED').length;
      const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE').length;
      const busyVehicles = vehicles.filter(v => v.status === 'BUSY').length;
      const urgentTasks = tasks.filter(t => t.priority === 'URGENT' && t.status !== 'COMPLETED').length;
      const activeAlerts = alerts.length;

      setStats({
        totalBoxes,
        pendingTasks,
        activeTasks,
        completedDeliveries,
        availableVehicles,
        busyVehicles,
        urgentTasks,
        activeAlerts
      });

      setActiveTasksList(tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').slice(0, 5) as Task[]);
      setVehiclesList(vehicles as Vehicle[]);
      setAlertsList(alerts.slice(0, 5) as Alert[]);
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        
        <main className="flex-grow p-8 overflow-y-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Logistics Master Console</h1>
              <p className="text-sm text-slate-400">Real-time status overview of vehicles, tasks, and system payloads.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedFloor('f-01')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition duration-150 ${selectedFloor === 'f-01' ? 'bg-blue-600 border-blue-500 text-slate-100' : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'}`}
              >
                Floor 1
              </button>
              <button 
                onClick={() => setSelectedFloor('f-02')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition duration-150 ${selectedFloor === 'f-02' ? 'bg-blue-600 border-blue-500 text-slate-100' : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'}`}
              >
                Floor 2
              </button>
              <button 
                onClick={() => setSelectedFloor('f-03')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition duration-150 ${selectedFloor === 'f-03' ? 'bg-blue-600 border-blue-500 text-slate-100' : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'}`}
              >
                Floor 3
              </button>
            </div>
          </div>

          {/* KPI Dashboard Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard title="Total Packets" value={stats.totalBoxes} icon={Boxes} colorClass="text-blue-400" />
            <KpiCard title="Pending Tasks" value={stats.pendingTasks} icon={Clock} colorClass="text-yellow-500" />
            <KpiCard title="Active Transport" value={stats.activeTasks} icon={Activity} colorClass="text-emerald-400" />
            <KpiCard title="Active Warnings" value={stats.activeAlerts} icon={AlertTriangle} colorClass={stats.activeAlerts > 0 ? 'text-red-500' : 'text-slate-600'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Live Map Panel */}
            <div className="lg:col-span-2 space-y-6">
              <WarehouseMap floorId={selectedFloor} />
              
              {/* Active Tasks list */}
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 shadow-xl space-y-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Active Dispatch Log</span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-900 text-slate-500 uppercase tracking-wider font-bold">
                        <th className="pb-3">Task ID</th>
                        <th className="pb-3">Vehicle</th>
                        <th className="pb-3">Priority</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Est Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60">
                      {activeTasksList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-500">No active transportation tasks.</td>
                        </tr>
                      ) : (
                        activeTasksList.map(task => (
                          <tr key={task.id} className="text-slate-300">
                            <td className="py-3 font-mono font-bold text-blue-400">{task.task_code}</td>
                            <td className="py-3 font-medium">
                              {task.vehicle_id ? (
                                <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-blue-500" /> {vehiclesList.find(v => v.id === task.vehicle_id)?.vehicle_code}</span>
                              ) : (
                                <span className="text-slate-600">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                task.priority === 'URGENT' ? 'bg-red-950 text-red-400' : (task.priority === 'HIGH' ? 'bg-yellow-950 text-yellow-500' : 'bg-slate-900 text-slate-400')
                              }`}>{task.priority}</span>
                            </td>
                            <td className="py-3">
                              <span className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping"></span>
                                {task.status}
                              </span>
                            </td>
                            <td className="py-3 text-slate-400">{task.estimated_duration}s</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Side status panel list */}
            <div className="space-y-8">
              {/* Vehicles status board */}
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 shadow-xl space-y-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-bold">Vehicle Fleet Roster</span>
                <div className="space-y-3">
                  {vehiclesList.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-900 bg-slate-950/40">
                      <div>
                        <span className="text-xs font-bold text-slate-200">{v.vehicle_code}</span>
                        <p className="text-[10px] text-slate-500">{v.name}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          v.status === 'AVAILABLE' ? 'bg-green-950 text-green-400' : (v.status === 'BUSY' ? 'bg-blue-950 text-blue-400' : 'bg-red-950 text-red-400')
                        }`}>{v.status}</span>
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-400 font-bold">
                          <span>Battery: {v.battery_percentage}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent warnings alerts board */}
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 shadow-xl space-y-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-bold">Recent Alerts Log</span>
                <div className="space-y-3">
                  {alertsList.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-4">No active system warnings.</p>
                  ) : (
                    alertsList.map(alert => (
                      <div key={alert.id} className="p-3 rounded-lg border border-slate-900 bg-slate-950/40 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            alert.severity === 'CRITICAL' ? 'bg-red-950 text-red-400' : 'bg-yellow-950 text-yellow-500'
                          }`}>{alert.severity}</span>
                          <span className="text-[9px] text-slate-600">{new Date(alert.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium">{alert.message}</p>
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
