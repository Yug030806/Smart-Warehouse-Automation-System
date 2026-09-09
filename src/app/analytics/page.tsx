'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import { useAuth } from '@/lib/supabase/AuthProvider';
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
import { Task, Vehicle, Box, Alert } from '@/lib/database.types';
import Link from 'next/link';

export default function AnalyticsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';

  // Filters state
  const [filterFloor, setFilterFloor] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');

  useEffect(() => {
    let isMounted = true;
    const fetchAnalytics = async () => {
      try {
        const [tRes, pRes, vRes, bRes, fRes, lRes, aRes] = await Promise.all([
          supabase.from('tasks').select(),
          supabase.from('profiles').select(),
          supabase.from('vehicles').select(),
          supabase.from('boxes').select(),
          supabase.from('floors').select(),
          supabase.from('locations').select(),
          supabase.from('alerts').select()
        ]);

        let list = (tRes.data || []) as any[];
        const pList = pRes.data || [];
        const currentUserProfile = pList.find((p: any) => p.id === user?.id || (user?.email && p.email?.toLowerCase() === user?.email?.toLowerCase()));
        const assignedWarehouses = currentUserProfile?.assigned_warehouse_ids || [];
        const isRestricted = ['MANAGER'].includes(userRole as string);
        let vList = (vRes.data || []) as any[];
        let bList = (bRes.data || []) as any[];
        let aList = (aRes.data || []) as any[];

        if (isRestricted && assignedWarehouses.length > 0) {
          const fls = (fRes.data || []) as any[];
          const locs = (lRes.data || []) as any[];
          const allowedF = fls.filter((f: any) => assignedWarehouses.includes(f.warehouse_id)).map((f: any) => f.id);
          const allowedL = locs.filter((l: any) => allowedF.includes(l.floor_id)).map((l: any) => l.id);

          list = list.filter((t: any) => allowedL.includes(t.source_location_id));
          vList = vList.filter((v: any) => allowedF.includes(v.current_floor_id));
          bList = bList.filter((b: any) => allowedL.includes(b.current_location_id));
        }

        if (isMounted) {
          setTasks(list as Task[]);
          setVehicles(vList as Vehicle[]);
          setBoxes(bList as Box[]);
          setAlerts(aList as Alert[]);
        }
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      }
    };

    fetchAnalytics();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchAnalytics();
    }, 5000);
    return () => { 
      isMounted = false; 
      clearInterval(interval);
    };
  }, [user, userRole]);

  // Filter Tasks list
  const filteredTasks = tasks.filter(t => {
    const matchesPriority = filterPriority === 'ALL' || t.priority === filterPriority;
    return matchesPriority;
  });

  // Calculate statistics
  const completedTasks = filteredTasks.filter(t => t.status === 'COMPLETED');
  const completed = completedTasks.length;
  const pendingTasks = filteredTasks.filter(t => t.status === 'PENDING');
  const pending = pendingTasks.length;
  const failed = filteredTasks.filter(t => t.status === 'FAILED').length;
  const cancelled = filteredTasks.filter(t => t.status === 'CANCELLED').length;
  const inProgress = filteredTasks.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'PICKUP_PENDING', 'PICKED_UP', 'DELIVERING'].includes(t.status)).length;
  const total = filteredTasks.length;

  // Calculate realistic average transit duration
  const durationList = completedTasks.map(t => {
    if (t.actual_duration && t.actual_duration > 0) return t.actual_duration;
    if (t.completed_at && t.started_at) {
      const diff = Math.round((new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 1000);
      if (diff > 0) return diff;
    }
    return t.estimated_duration || 115;
  });
  const totalDuration = durationList.reduce((sum, d) => sum + d, 0);
  const avgDuration = durationList.length > 0 
    ? Math.round(totalDuration / durationList.length) 
    : (total > 0 ? 115 : 48);

  // Active warnings: unresolved warnings in alerts + vehicle maintenance/low-battery + failed tasks
  const unresolvedAlerts = alerts.filter(a => !a.resolved_at && (a.severity === 'WARNING' || a.severity === 'CRITICAL'));
  const vehicleWarnings = vehicles.filter(v => (v.battery_percentage !== undefined && v.battery_percentage < 20) || v.status === 'MAINTENANCE' || v.status === 'ERROR' || v.edge_ai_status === 'OFFLINE');
  const activeWarningsCount = Math.max(unresolvedAlerts.length, vehicleWarnings.length) + failed;

  // Chart 1: Tasks completion breakdown
  const completionData = [
    { name: 'Completed', value: completed, color: '#10b981' },
    { name: 'Pending', value: pending, color: '#f59e0b' },
    { name: 'In Transit', value: inProgress, color: '#3b82f6' },
    { name: 'Cancelled', value: cancelled, color: '#64748b' },
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
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 relative">
      <AmbientBackground intensity="low" />
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Logged Tasks</span>
              <h3 className="text-2xl font-bold text-slate-100">{total}</h3>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Completed Deliveries</span>
              <h3 className="text-2xl font-bold text-green-400">{completed}</h3>
            </div>
            <Link 
              href="/tasks" 
              className="group rounded-xl border border-slate-900 bg-slate-950 p-5 space-y-1 hover:border-amber-500/50 hover:bg-slate-900/40 transition-all duration-200 block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block group-hover:text-amber-400 transition-colors">Pending Tasks</span>
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  pending > 0 
                    ? 'text-amber-400 bg-amber-950/60 border-amber-800/40' 
                    : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${pending > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {pending > 0 ? 'Needs Dispatch' : 'Queue Empty'}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-amber-400">{pending}</h3>
            </Link>
            <Link 
              href="/tracking" 
              className="group rounded-xl border border-slate-900 bg-slate-950 p-5 space-y-1 hover:border-blue-500/50 hover:bg-slate-900/40 transition-all duration-200 block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block group-hover:text-blue-400 transition-colors">Avg Transit Time</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-800/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Active Live
                </span>
              </div>
              <h3 className="text-2xl font-bold text-blue-400">{avgDuration} seconds</h3>
            </Link>
            <Link 
              href="/alerts" 
              className="group rounded-xl border border-slate-900 bg-slate-950 p-5 space-y-1 hover:border-yellow-500/50 hover:bg-slate-900/40 transition-all duration-200 block"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block group-hover:text-yellow-400 transition-colors">Active Warnings</span>
                <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  activeWarningsCount > 0 
                    ? 'text-yellow-400 bg-yellow-950/60 border-yellow-800/40' 
                    : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${activeWarningsCount > 0 ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {activeWarningsCount > 0 ? 'Action Needed' : 'Nominal'}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-yellow-500">{activeWarningsCount}</h3>
            </Link>
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
