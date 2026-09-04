'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import RoleGuard from '@/components/RoleGuard';
import { ScanQrCode, AlertTriangle, CheckCircle, HelpCircle, Flame } from 'lucide-react';
import { Task, Box, Vehicle, Location } from '@/lib/database.types';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { generateUUID } from '@/lib/uuid';
import { triggerGlobalAlert } from '@/lib/alertService';
import confetti from 'canvas-confetti';

import Link from 'next/link';

export default function ScannerPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Selection states
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [scanCodeInput, setScanCodeInput] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'URGENT' | 'HIGH' | 'NORMAL'>('ALL');
  
  // Verification states
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  const loadData = async () => {
    try {
      const [tRes, bRes, vRes, lRes] = await Promise.all([
        supabase.from('tasks').select(),
        supabase.from('boxes').select(),
        supabase.from('vehicles').select(),
        supabase.from('locations').select()
      ]);

      const t = (tRes.data || []) as Task[];
      setTasks(t);

      const b = (bRes.data || []) as Box[];
      setBoxes(b);

      const v = (vRes.data || []) as Vehicle[];
      setVehicles(v);

      const l = (lRes.data || []) as Location[];
      setLocations(l);

      // Auto-select highest urgency active/pending task if none is selected
      const sorted = t
        .filter(x => x.status !== 'COMPLETED' && x.status !== 'CANCELLED')
        .sort((a, b) => {
          const pRank = (p?: string) => (p === 'URGENT' ? 3 : p === 'HIGH' ? 2 : 1);
          const diff = pRank(b.priority) - pRank(a.priority);
          if (diff !== 0) return diff;
          const scoreA = a.priority_score ?? (pRank(a.priority) * 10);
          const scoreB = b.priority_score ?? (pRank(b.priority) * 10);
          if (scoreB !== scoreA) return scoreB - scoreA;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

      setSelectedTask(prev => {
        if (!prev) return sorted[0] || null;
        // Keep selected task updated with latest data, or fallback to first if completed
        return sorted.find(x => x.id === prev.id) || sorted[0] || null;
      });
    } catch (err) {
      console.error('Failed to load scanner data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const priorityWeight = (p?: string) => {
    if (p === 'URGENT') return 3;
    if (p === 'HIGH') return 2;
    return 1;
  };

  // Active tasks aligned strictly by urgency: URGENT -> HIGH -> NORMAL
  const activeTasks = tasks
    .filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
    .sort((a, b) => {
      const diff = priorityWeight(b.priority) - priorityWeight(a.priority);
      if (diff !== 0) return diff;
      const scoreA = a.priority_score ?? (priorityWeight(a.priority) * 10);
      const scoreB = b.priority_score ?? (priorityWeight(b.priority) * 10);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const filteredTasks = priorityFilter === 'ALL'
    ? activeTasks
    : activeTasks.filter(t => t.priority === priorityFilter);

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setScanCodeInput('');
    setStatusMessage('');
    setStatusType('IDLE');
  };

  // Verification QR scans scanner console logic
  const handleVerifyScan = async () => {
    if (!selectedTask) {
      triggerGlobalAlert({
        type: 'SYSTEM_ERROR',
        severity: 'WARNING',
        message: 'QR Scan Console Error: Please select an active transport task before verifying.'
      });
      return;
    }

    const box = boxes.find(bx => bx.id === selectedTask.box_id);
    if (!box) {
      triggerGlobalAlert({
        type: 'SYSTEM_ERROR',
        severity: 'WARNING',
        message: `QR Scan Console Error: Cargo payload record not found for Task ${selectedTask.task_code}.`
      });
      return;
    }

    const correctCode = box.qr_code_data || '';
    const enteredCode = scanCodeInput.trim();

    if (!enteredCode) {
      setStatusType('ERROR');
      setStatusMessage('ERROR: Empty scan code entered. Please type or scan the payload barcode.');
      triggerGlobalAlert({
        type: 'BOX_MISMATCH',
        severity: 'WARNING',
        message: `QR Scan Console Error: Empty barcode entered for Task ${selectedTask.task_code}. Expected payload "${correctCode}".`,
        task_id: selectedTask.id
      });
      return;
    }

    const isMatched = enteredCode === correctCode.trim();

    if (isMatched) {
      setStatusType('SUCCESS');
      
      const isPickup = ['ASSIGNED', 'IN_PROGRESS', 'PICKUP_PENDING'].includes(selectedTask.status);
      
      try {
        if (isPickup) {
          setStatusMessage(`PICKUP_CONFIRMED: Verified code ${enteredCode}. Cargo payload pickup complete.`);
          
          // Update Task status
          await supabase.from('tasks').update({
            status: 'PICKED_UP'
          }).eq('id', selectedTask.id);

          // Update Box status
          await supabase.from('boxes').update({
            status: 'PICKED_UP'
          }).eq('id', box.id);

          // Add Scan Event
          await supabase.from('scan_events').insert({
            id: generateUUID(),
            task_id: selectedTask.id,
            box_id: box.id,
            vehicle_id: selectedTask.vehicle_id || null,
            location_id: selectedTask.source_location_id,
            scanned_by: user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
            scan_type: 'PICKUP',
            is_verified: true,
            scanned_code: enteredCode,
            created_at: new Date().toISOString()
          });

          // Trigger haptic animation sound/confetti
          confetti();
        } else {
          setStatusMessage(`DELIVERY_CONFIRMED: Verified code ${enteredCode}. Parcel successfully checked into Destination.`);

          // Finalise Task complete
          await supabase.from('tasks').update({
            status: 'COMPLETED',
            completed_at: new Date().toISOString()
          }).eq('id', selectedTask.id);

          // Update Box status
          await supabase.from('boxes').update({
            status: 'DELIVERED',
            current_location_id: selectedTask.destination_location_id
          }).eq('id', box.id);

          // Update Vehicle status to standby available again
          if (selectedTask.vehicle_id) {
            const vehicleObj = vehicles.find(v => v.id === selectedTask.vehicle_id);
            const currentCharger = locations.find(l => l.floor_id === vehicleObj?.current_floor_id && l.type === 'CHARGING');
            
            await supabase.from('vehicles').update({
              status: 'AVAILABLE',
              current_task_id: null,
              current_location_id: currentCharger ? currentCharger.id : null
            }).eq('id', selectedTask.vehicle_id);
          }

          // Add Scan Event
          await supabase.from('scan_events').insert({
            id: generateUUID(),
            task_id: selectedTask.id,
            box_id: box.id,
            vehicle_id: selectedTask.vehicle_id || null,
            location_id: selectedTask.destination_location_id,
            scanned_by: user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
            scan_type: 'DELIVERY',
            is_verified: true,
            scanned_code: enteredCode,
            created_at: new Date().toISOString()
          });

          // Add Audit Log
          await supabase.from('audit_logs').insert({
            id: generateUUID(),
            user_email: user?.email || 'operator@demo.com',
            action: 'DELIVERY_CONFIRMED',
            object_type: 'TASK',
            object_id: selectedTask.id,
            previous_state: { status: selectedTask.status },
            new_state: { status: 'COMPLETED' },
            timestamp: new Date().toISOString()
          });

          confetti();
        }
      } catch (err: any) {
        console.error('Scan processing error:', err);
        triggerGlobalAlert({
          type: 'SYSTEM_ERROR',
          severity: 'CRITICAL',
          message: `Scanner Database Error: Failed to complete scan verification: ${err?.message || 'Unknown error'}.`,
          task_id: selectedTask.id
        });
      }
    } else {
      setStatusType('ERROR');
      setStatusMessage(`BOX MISMATCH: Verified scan code does not match transport order payloads. Alert dispatched.`);

      // Trigger Critical Pop-up Alert
      triggerGlobalAlert({
        type: 'BOX_MISMATCH',
        severity: 'CRITICAL',
        message: `Box Mismatch Alert: Scanned code "${enteredCode}" does not match expected payload "${correctCode}" on Task ${selectedTask.task_code}!`,
        vehicle_id: selectedTask.vehicle_id || undefined,
        task_id: selectedTask.id
      });
    }

    await loadData();
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'OPERATOR']}>
      <div className="flex h-screen w-full overflow-hidden bg-slate-950 relative">
        <AmbientBackground intensity="low" />
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
          <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">QR Scan Console & Verification</h1>
            <p className="text-xs sm:text-sm text-slate-400">Scan box identities at routing nodes to confirm pickups and finalise deliveries.</p>
          </div>

          {/* Step-by-step quick guide */}
          <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
              <div>
                <span className="font-bold text-slate-200 block">Select Task</span>
                <span className="text-[11px] text-slate-400">Pick an active dispatch order from queue.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
              <div>
                <span className="font-bold text-slate-200 block">Read Expected QR</span>
                <span className="text-[11px] text-slate-400">View payload QR identity & target floor.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
              <div>
                <span className="font-bold text-slate-200 block">Scan or Pre-fill</span>
                <span className="text-[11px] text-slate-400">Type or click test shortcut buttons.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0">4</span>
              <div>
                <span className="font-bold text-slate-200 block">Simulate Scan</span>
                <span className="text-[11px] text-slate-400">Confirms pickup or completes delivery.</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Verification Panel controls */}
            <div className="lg:col-span-2 space-y-6">
              {selectedTask ? (
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-6">
                  <div className="border-b border-slate-900 pb-4">
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block font-mono">Order Verification Panel</span>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                      <h3 className="text-base font-bold text-slate-200">Verifying Task: {selectedTask.task_code}</h3>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                        selectedTask.priority === 'URGENT'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                          : selectedTask.priority === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      }`}>
                        {selectedTask.priority === 'URGENT' && <Flame className="h-3 w-3 text-red-400 shrink-0" />}
                        {selectedTask.priority === 'HIGH' && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />}
                        {selectedTask.priority || 'NORMAL'} PRIORITY
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-1">Expected QR Code Payload:</span>
                      <span className="font-mono font-bold text-slate-100 bg-slate-900 px-2 py-1 rounded select-all">
                        {boxes.find(b => b.id === selectedTask.box_id)?.qr_code_data || 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block mb-1">Scanning Phase:</span>
                      <span className="font-bold text-blue-400">
                        {['ASSIGNED', 'IN_PROGRESS', 'PICKUP_PENDING'].includes(selectedTask.status) ? 'PICKUP DISPATCH' : 'DELIVERY DISPATCH'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block mb-1">Queue Urgency:</span>
                      <span className={`font-bold ${
                        selectedTask.priority === 'URGENT' ? 'text-red-400' : selectedTask.priority === 'HIGH' ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {selectedTask.priority || 'NORMAL'}
                      </span>
                    </div>
                  </div>

                  {/* Manual input simulation scanner */}
                  <div className="space-y-3.5 pt-4 border-t border-slate-900">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Scan Input Payload Code</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Scan or enter BX-XXXX payload..."
                        value={scanCodeInput}
                        onChange={e => setScanCodeInput(e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-sm font-mono text-slate-100 placeholder-slate-700 outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={handleVerifyScan}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-slate-50 transition"
                      >
                        Simulate Scan
                      </button>
                    </div>

                    {/* Pre-fill suggestion button for demonstration convenience */}
                    <div className="flex gap-2 text-[10px]">
                      <button
                        onClick={() => setScanCodeInput(boxes.find(b => b.id === selectedTask.box_id)?.qr_code_data || '')}
                        className="text-blue-500 hover:underline font-semibold"
                      >
                        [Pre-fill Expected Code]
                      </button>
                      <button
                        onClick={() => setScanCodeInput('BX-MISMATCH-999')}
                        className="text-red-500 hover:underline font-semibold"
                      >
                        [Pre-fill Mismatch Error Code]
                      </button>
                    </div>
                  </div>

                  {/* Verification Results Status Message box */}
                  {statusType !== 'IDLE' && (
                    <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                      statusType === 'SUCCESS' 
                        ? 'border-green-900/40 bg-green-950/15 text-green-400' 
                        : 'border-red-900/40 bg-red-950/15 text-red-400'
                    }`}>
                      {statusType === 'SUCCESS' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
                      <div className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider block">{statusType === 'SUCCESS' ? 'Verification Success' : 'Security Alert'}</span>
                        <p className="text-xs">{statusMessage}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-12 text-center text-slate-500 space-y-3">
                  <ScanQrCode className="h-12 w-12 text-slate-700 mx-auto" />
                  <h3 className="font-bold text-slate-300">No Active Tasks Available</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">Create a transportation task first or select an active task from the right queue to initiate QR verification.</p>
                  <div className="pt-2">
                    <Link href="/tasks" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-slate-50 rounded-xl transition">
                      Go to Transportation Tasks
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Right side active logs scheduler queue */}
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Operational Queue Backlog</span>
                  <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1 mt-0.5">
                    <Flame className="h-3 w-3 text-red-400" /> Aligned by Urgency (Urgent First)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                  {activeTasks.length} active
                </span>
              </div>

              {/* Urgency Filter Tabs */}
              <div className="flex gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[10px] font-semibold">
                {(['ALL', 'URGENT', 'HIGH', 'NORMAL'] as const).map(p => {
                  const count = p === 'ALL' ? activeTasks.length : activeTasks.filter(t => t.priority === p).length;
                  return (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={`flex-1 py-1 px-2 rounded-lg transition text-center ${
                        priorityFilter === p
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      {p} {count > 0 && <span className="opacity-75">({count})</span>}
                    </button>
                  );
                })}
              </div>

              {/* Task list aligned by urgency */}
              <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                {filteredTasks.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-900 rounded-xl">
                    No {priorityFilter !== 'ALL' ? priorityFilter.toLowerCase() : 'active'} tasks in queue.
                  </div>
                ) : (
                  filteredTasks.map((t, index) => {
                    const box = boxes.find(b => b.id === t.box_id);
                    const isUrgent = t.priority === 'URGENT';
                    const isHigh = t.priority === 'HIGH';
                    const isSelected = selectedTask?.id === t.id;

                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTask(t)}
                        className={`w-full text-left p-3.5 rounded-xl border transition duration-150 relative overflow-hidden ${
                          isSelected
                            ? 'border-blue-500 bg-blue-600/10 text-slate-100 shadow-md ring-1 ring-blue-500/30'
                            : isUrgent
                            ? 'border-red-900/50 bg-red-950/15 hover:border-red-600/60 hover:bg-red-950/25 text-slate-300'
                            : isHigh
                            ? 'border-amber-900/40 bg-amber-950/15 hover:border-amber-600/50 hover:bg-amber-950/25 text-slate-300'
                            : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                          isUrgent ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : (isHigh ? 'bg-amber-500' : 'bg-slate-700')
                        }`} />

                        <div className="pl-1.5">
                          <div className="flex justify-between items-center mb-1.5 font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-bold">#{index + 1}</span>
                              <span className="font-bold text-slate-100">{t.task_code}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                                isUrgent
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                                  : isHigh
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                              }`}>
                                {isUrgent && <Flame className="h-2.5 w-2.5 text-red-400 shrink-0" />}
                                {isHigh && <AlertTriangle className="h-2.5 w-2.5 text-amber-400 shrink-0" />}
                                {t.priority || 'NORMAL'}
                              </span>

                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                t.status === 'PICKED_UP'
                                  ? 'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                                  : t.status === 'PICKUP_PENDING'
                                  ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/50'
                                  : 'bg-slate-900 text-slate-400 border border-slate-800'
                              }`}>
                                {t.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Payload: <span className="font-mono font-semibold text-slate-200">{box?.box_code || 'N/A'}</span></span>
                            {box?.product_name && (
                              <span className="text-[10px] text-slate-500 truncate max-w-[140px]">{box.product_name}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
      </div>
    </RoleGuard>
  );
}
