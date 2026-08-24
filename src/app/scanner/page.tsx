'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { ScanQrCode, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { Task, Box, Vehicle, Location } from '@/lib/database.types';
import confetti from 'canvas-confetti';

export default function ScannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Selection states
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [scanCodeInput, setScanCodeInput] = useState('');
  
  // Verification states
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  const loadData = () => {
    const t = supabase.from('tasks').select().data || [];
    setTasks(t as Task[]);

    const b = supabase.from('boxes').select().data || [];
    setBoxes(b as Box[]);

    const v = supabase.from('vehicles').select().data || [];
    setVehicles(v as Vehicle[]);

    const l = supabase.from('locations').select().data || [];
    setLocations(l as Location[]);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTask = (task: Task) => {
    setSelectedTask(task);
    setScanCodeInput('');
    setStatusMessage('');
    setStatusType('IDLE');
  };

  // Verification QR scans scanner console logic
  const handleVerifyScan = () => {
    if (!selectedTask) return;
    const box = boxes.find(bx => bx.id === selectedTask.box_id);
    if (!box) return;

    const correctCode = box.qr_code_data;
    const isMatched = scanCodeInput.trim() === correctCode.trim();

    if (isMatched) {
      setStatusType('SUCCESS');
      
      const isPickup = ['ASSIGNED', 'IN_PROGRESS', 'PICKUP_PENDING'].includes(selectedTask.status);
      
      if (isPickup) {
        setStatusMessage(`PICKUP_CONFIRMED: Verified code ${scanCodeInput}. Cargo payload pickup complete.`);
        
        // Update Task status
        supabase.from('tasks').update({
          status: 'PICKED_UP'
        }).eq('id', selectedTask.id);

        // Update Box status
        supabase.from('boxes').update({
          status: 'PICKED_UP'
        }).eq('id', box.id);

        // Add Scan Event
        supabase.from('scan_events').insert({
          id: `scan-${Date.now()}`,
          task_id: selectedTask.id,
          box_id: box.id,
          vehicle_id: selectedTask.vehicle_id || '',
          location_id: selectedTask.source_location_id,
          scanned_by: 'u-operator',
          scan_type: 'PICKUP',
          is_verified: true,
          scanned_code: scanCodeInput,
          created_at: new Date().toISOString()
        });

        // Trigger haptic animation sound/confetti
        confetti();
      } else {
        setStatusMessage(`DELIVERY_CONFIRMED: Verified code ${scanCodeInput}. Parcel successfully checked into Destination.`);

        // Finalise Task complete
        supabase.from('tasks').update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        }).eq('id', selectedTask.id);

        // Update Box status
        supabase.from('boxes').update({
          status: 'DELIVERED',
          current_location_id: selectedTask.destination_location_id
        }).eq('id', box.id);

        // Update Vehicle status to standby available again
        if (selectedTask.vehicle_id) {
          const vehicleObj = vehicles.find(v => v.id === selectedTask.vehicle_id);
          const currentCharger = locations.find(l => l.floor_id === vehicleObj?.current_floor_id && l.type === 'CHARGING');
          
          supabase.from('vehicles').update({
            status: 'AVAILABLE',
            current_task_id: null,
            current_location_id: currentCharger ? currentCharger.id : null
          }).eq('id', selectedTask.vehicle_id);
        }

        // Add Scan Event
        supabase.from('scan_events').insert({
          id: `scan-${Date.now()}`,
          task_id: selectedTask.id,
          box_id: box.id,
          vehicle_id: selectedTask.vehicle_id || '',
          location_id: selectedTask.destination_location_id,
          scanned_by: 'u-operator',
          scan_type: 'DELIVERY',
          is_verified: true,
          scanned_code: scanCodeInput,
          created_at: new Date().toISOString()
        });

        // Add Audit Log
        supabase.from('audit_logs').insert({
          id: `log-${Date.now()}`,
          user_email: 'operator@demo.com',
          action: 'DELIVERY_CONFIRMED',
          object_type: 'TASK',
          object_id: selectedTask.id,
          previous_state: { status: selectedTask.status },
          new_state: { status: 'COMPLETED' },
          timestamp: new Date().toISOString()
        });

        confetti();
      }
    } else {
      setStatusType('ERROR');
      setStatusMessage('BOX MISMATCH: Verified scan code does not match transport order payloads. Alert dispatched.');

      // Insert Critical System warnings alerts
      supabase.from('alerts').insert({
        id: `alert-${Date.now()}`,
        type: 'BOX_MISMATCH',
        severity: 'CRITICAL',
        message: `Box Mismatch alert: Scanned code ${scanCodeInput} instead of expected payload ${correctCode}.`,
        vehicle_id: selectedTask.vehicle_id || undefined,
        task_id: selectedTask.id,
        is_acknowledged: false,
        resolved_at: null,
        created_at: new Date().toISOString()
      });
    }

    loadData();
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-grow flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-8 overflow-y-auto flex-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">QR Scan Console & Verification</h1>
            <p className="text-sm text-slate-400">Scan box identities at routing nodes to confirm pickups and finalise deliveries.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Verification Panel controls */}
            <div className="lg:col-span-2 space-y-6">
              {selectedTask ? (
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-6">
                  <div className="border-b border-slate-900 pb-4">
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block font-mono">Order Verification Panel</span>
                    <h3 className="text-base font-bold text-slate-200 mt-1">Verifying Task: {selectedTask.task_code}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-1">Expected QR Code Payload:</span>
                      <span className="font-mono font-bold text-slate-100 bg-slate-900 px-2 py-1 rounded select-all">
                        {boxes.find(b => b.id === selectedTask.box_id)?.qr_code_data}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block mb-1">Scanning Phase:</span>
                      <span className="font-bold text-blue-400">
                        {['ASSIGNED', 'IN_PROGRESS', 'PICKUP_PENDING'].includes(selectedTask.status) ? 'PICKUP DISPATCH' : 'DELIVERY DISPATCH'}
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
                        className="text-blue-500 hover:underline"
                      >
                        [Pre-fill Expected Code]
                      </button>
                      <button
                        onClick={() => setScanCodeInput('BX-MISMATCH-999')}
                        className="text-red-500 hover:underline"
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
                        <span className="text-xs font-bold uppercase tracking-wider block">{statusType === 'SUCCESS' ? 'Verification Success' : 'Security Alert Alert'}</span>
                        <p className="text-xs">{statusMessage}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-12 text-center text-slate-500">
                  <ScanQrCode className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-300">Select Active Dispatch task</h3>
                  <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">Select any active or pending task from the scheduler roster board on the right side to initiate QR scanning.</p>
                </div>
              )}
            </div>

            {/* Right side active logs scheduler queue */}
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Operational Queue Backlog</span>
              <div className="space-y-3">
                {tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTask(t)}
                    className={`w-full text-left p-3.5 rounded-xl border transition duration-150 ${
                      selectedTask?.id === t.id
                        ? 'border-blue-500 bg-blue-600/10 text-slate-100 shadow-md'
                        : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1 font-mono text-xs">
                      <span className="font-bold">{t.task_code}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">{t.status}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Payload: {boxes.find(b => b.id === t.box_id)?.box_code}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
