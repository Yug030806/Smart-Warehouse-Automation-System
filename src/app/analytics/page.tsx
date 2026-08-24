'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie
} from 'recharts';
import { Task, Vehicle, Box } from '@/lib/database.types';

export default function AnalyticsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);

  // Filters state
  const [filterFloor, setFilterFloor] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');

  useEffect(() => {
    const list = supabase.from('tasks').select().data || [];
    setTasks(list as Task[]);

    const vList = supabase.from('vehicles').select().data || [];
    setVehicles(vList as Vehicle[]);

    const bList = supabase.from('boxes').select().data || [];
    setBoxes(bList as Box[]);
  }, []);

  // Filter Tasks list
  const filteredTasks = tasks.filter(t => {
    const matchesPriority = filterPriority === 'ALL' || t.priority === filterPriority;
    return matchesPriority;
  });

  // Calculate statistics
  const completed = filteredTasks.filter(t => t.status === 'COMPLETED').length;
  const failed = filteredTasks.filter(t => t.status === 'FAILED').length;
  const cancelled = filteredTasks.filter(t => t.status === 'CANCELLED').length;
  const inProgress = filteredTasks.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'PICKUP_PENDING', 'PICKED_UP', 'DELIVERING'].includes(t.status)).length;
  const total = filteredTasks.length;

  const totalDuration = filteredTasks.reduce((sum, t) => sum + (t.actual_duration || 0), 0);
  const avgDuration = completed > 0 ? Math.round(totalDuration / completed) : 0;

  // Chart 1: Tasks completion breakdown
  const completionData = [
    { name: 'Completed', value: completed, color: '#10b981' },
    { name: 'In Progress', value: inProgress, color: '#3b82f6' },
    { name: 'Cancelled', value: cancelled, color: '#f59e0b' },
    { name: 'Failed', value: failed, color: '#ef4444' }
  ].filter(x => x.value > 0);

  // Chart 2: Task Urgency priority distribution
  const urgentCount = filteredTasks.filter(t => t.priority === 'URGENT').length;
  const highCount = filteredTasks.filter(t => t.priority === 'HIGH').length;
  const normalCount = filteredTasks.filter(t => t.priority === 'NORMAL').length;

  const priorityData = [
    { name: 'URGENT', count: urgentCount },
    { name: 'HIGH', count: highCount },
    { name: 'NORMAL', count: normalCount }
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">System Performance Analytics</h1>
              <p className="text-xs sm:text-sm text-slate-400">Review fleet logistics efficiency, delivery times, and payload priority statistics.</p>
            </div>

            {/* Filter controls panel */}
            <div className="flex gap-3">
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400 font-semibold"
              >
                <option value="ALL">All Priorities</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          {/* Key Metrics cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Logged Tasks</span>
              <h3 className="text-2xl font-bold text-slate-100">{total}</h3>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Completed Deliveries</span>
              <h3 className="text-2xl font-bold text-green-400">{completed}</h3>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Avg Transit Time</span>
              <h3 className="text-2xl font-bold text-blue-400">{avgDuration} seconds</h3>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Active Warning Warnings</span>
              <h3 className="text-2xl font-bold text-yellow-500">{failed}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pie Chart: Completion breakdowns */}
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4 shadow-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-bold block">Delivery Status Breakdowns</span>
              <div className="h-64 flex items-center justify-center">
                {completionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={completionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {completionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-slate-600">No data logged.</p>
                )}
              </div>
              <div className="flex justify-center gap-4 text-[10px] font-semibold">
                {completionData.map(item => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="text-slate-400">{item.name} ({item.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar Chart: Priority Distribution */}
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4 shadow-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-bold block">Transport Priority Statistics</span>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '10px' }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
                    <Tooltip cursor={{ fill: '#111827' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {priorityData.map((entry, index) => {
                        const colors = ['#ef4444', '#f59e0b', '#3b82f6'];
                        return <Cell key={`cell-${index}`} fill={colors[index]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
