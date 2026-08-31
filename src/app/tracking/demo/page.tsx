'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import WarehouseMap from '@/components/WarehouseMap';
import { calculateRoute } from '@/lib/algorithms/astar';
import { SimulatorVehicleController } from '@/lib/simulator/vehicleController';
import { 
  Play, 
  Sparkles, 
  MapPin, 
  Layers, 
  CheckSquare, 
  QrCode, 
  Settings, 
  Navigation,
  Compass,
  ArrowRight,
  TrendingUp,
  History
} from 'lucide-react';
import { Box, Vehicle, Task, Location, Route, AuditLog } from '@/lib/database.types';
import mockDb from '@/lib/supabase/mockDb';
import confetti from 'canvas-confetti';

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatus, setStepStatus] = useState<string>('Select start to trigger SIH Demo workflow.');
  const [selectedFloor, setSelectedFloor] = useState('f-01');

  // Logs and telemetry data
  const [box, setBox] = useState<Box | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [routePts, setRoutePts] = useState<any[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);

  // Simulation controls
  const [simController, setSimController] = useState<SimulatorVehicleController | null>(null);

  const stepsList = [
    { label: 'Step 1: Select Box Payload', desc: 'Identify packet BX-1001 on Floor 1, Rack A3.' },
    { label: 'Step 2: Assign Destination target', desc: 'Assign destination Floor 3, Rack C5.' },
    { label: 'Step 3: Create Urgent Dispatch task', desc: 'Generate task order with URGENT priority.' },
    { label: 'Step 4: Auto-select available AMR', desc: 'Assign available vehicle close to Floor 1.' },
    { label: 'Step 5: Pathfinding Route', desc: 'Calculate shortest path grid coordinates using A*.' },
    { label: 'Step 6: AMR Transit & Elevators', desc: 'Animate vehicle coordinates including elevator shifts.' },
    { label: 'Step 7: Pickup QR scanning', desc: 'Operator scans box code to verify expected payload.' },
    { label: 'Step 8: Delivery QR scanning', desc: 'Operator scans box code to confirm final delivery.' },
    { label: 'Step 9: Complete Dispatch Order', desc: 'Finalise task completed status and release vehicle.' }
  ];

  const initDemo = () => {
    // Reset db state to ensure BX-1001 is pending WAITING
    mockDb.resetToSeeds();
    const locs = supabase.from('locations').select().data || [];
    setLocations(locs as Location[]);

    const b = mockDb.getBoxes().find(x => x.box_code === 'BX-1001');
    setBox(b || null);
    
    const t = mockDb.getTasks().find(x => x.task_code === 'TSK-1001');
    setTask(t || null);

    setRecentLogs(mockDb.getAuditLogs().slice(0, 5) as AuditLog[]);

    setCurrentStep(0);
    setStepStatus('SIH Demo setup completed. Click Step 1 to begin sequence.');
  };

  useEffect(() => {
    initDemo();
  }, []);

  const triggerNextStep = async () => {
    const nextIdx = currentStep + 1;
    setCurrentStep(nextIdx);

    if (nextIdx === 1) {
      // Step 1: Select Box Payload
      if (box) {
        setStepStatus(`Target payload ${box.box_code} (${box.product_name}) identified at Floor 1, Rack A3.`);
      }
    } else if (nextIdx === 2) {
      // Step 2: Assign Destination target
      if (box) {
        setStepStatus(`Destination coordinates assigned to Floor 3, Rack C5.`);
      }
    } else if (nextIdx === 3) {
      // Step 3: Create Urgent Dispatch task
      if (task) {
        setStepStatus(`Urgent dispatch task ${task.task_code} scheduled with high priority recommendation score.`);
      }
    } else if (nextIdx === 4) {
      // Step 4: Auto-select available AMR
      const candidates = mockDb.getVehicles().filter(v => v.status === 'AVAILABLE' && v.battery_percentage > 15);
      const chosen = candidates[0]; // AMR-01
      if (chosen && task) {
        setVehicle(chosen);
        mockDb.saveVehicle({ ...chosen, status: 'BUSY', current_task_id: task.id });
        mockDb.saveTask({ ...task, vehicle_id: chosen.id, status: 'ASSIGNED' });
        setStepStatus(`Vehicle auto-assigned: ${chosen.vehicle_code} (${chosen.name}).`);
      }
    } else if (nextIdx === 5) {
      // Step 5: Pathfinding Route
      if (vehicle && task) {
        const destLoc = locations.find(l => l.id === task.destination_location_id);
        if (destLoc) {
          const pts = calculateRoute(
            vehicle.current_floor_id,
            vehicle.x_position,
            vehicle.y_position,
            destLoc.floor_id,
            destLoc.x,
            destLoc.y,
            locations
          );
          setRoutePts(pts);
          mockDb.saveRoute({
            id: `route-${Date.now()}`,
            task_id: task.id,
            path_coordinates: pts,
            created_at: new Date().toISOString()
          });
          setStepStatus(`A* Route calculated: ${pts.length} grid coordinates segments, including elevator transitions.`);
        }
      }
    } else if (nextIdx === 6) {
      // Step 6: AMR Transit & Elevators
      if (vehicle && routePts.length > 0) {
        setStepStatus('Vehicle traveling across grid coordinates. Moving floors...');
        const controller = new SimulatorVehicleController(vehicle.id);
        controller.connect();
        controller.setSpeed(5); // fast speed for demo
        setSimController(controller);

        controller.sendMoveCommand(
          routePts,
          (x, y, floorId) => {
            setSelectedFloor(floorId);
          },
          () => {
            setStepStatus('AMR arrived at Floor 3 Rack C5 target. Pending operator QR scanning.');
            controller.stop();
          }
        );
      }
    } else if (nextIdx === 7) {
      // Step 7: Pickup QR scanning
      if (task && box && vehicle) {
        // Confirm pickup verification
        mockDb.saveTask({ ...task, status: 'PICKED_UP' });
        mockDb.saveBox({ ...box, status: 'PICKED_UP' });
        
        mockDb.addScanEvent({
          id: `scan-${Date.now()}`,
          task_id: task.id,
          box_id: box.id,
          vehicle_id: vehicle.id,
          location_id: task.source_location_id,
          scanned_by: 'u-operator',
          scan_type: 'PICKUP',
          is_verified: true,
          scanned_code: box.qr_code_data,
          created_at: new Date().toISOString()
        });

        setStepStatus(`QR Scan verified code ${box.qr_code_data} at source pickup Rack A3.`);
        confetti();
      }
    } else if (nextIdx === 8) {
      // Step 8: Delivery QR scanning
      if (task && box && vehicle) {
        mockDb.saveTask({ ...task, status: 'DELIVERING' });
        mockDb.saveBox({ ...box, status: 'IN_TRANSIT' });

        mockDb.addScanEvent({
          id: `scan-${Date.now()}`,
          task_id: task.id,
          box_id: box.id,
          vehicle_id: vehicle.id,
          location_id: task.destination_location_id,
          scanned_by: 'u-operator',
          scan_type: 'DELIVERY',
          is_verified: true,
          scanned_code: box.qr_code_data,
          created_at: new Date().toISOString()
        });

        setStepStatus(`QR Scan verified code ${box.qr_code_data} at target destination Rack C5.`);
        confetti();
      }
    } else if (nextIdx === 9) {
      // Step 9: Complete Dispatch Order
      if (task && box && vehicle) {
        const completedTask = {
          ...task,
          status: 'COMPLETED' as const,
          completed_at: new Date().toISOString()
        };
        const deliveredBox = {
          ...box,
          status: 'DELIVERED' as const,
          current_location_id: task.destination_location_id
        };

        mockDb.saveTask(completedTask);
        mockDb.saveBox(deliveredBox);

        // Release vehicle to standby charging
        const charger = locations.find(l => l.floor_id === 'f-03' && l.type === 'CHARGING');
        mockDb.saveVehicle({
          ...vehicle,
          status: 'AVAILABLE',
          current_task_id: null,
          current_location_id: charger ? charger.id : null,
          x_position: charger ? charger.x : 5,
          y_position: charger ? charger.y : 1
        });

        mockDb.addAuditLog({
          id: `log-${Date.now()}`,
          user_email: 'operator@demo.com',
          action: 'DEMO_COMPLETED',
          object_type: 'TASK',
          object_id: task.id,
          previous_state: { status: 'DELIVERING' },
          new_state: { status: 'COMPLETED' },
          timestamp: new Date().toISOString()
        });

        setStepStatus('Transport Task Completed. Cargo marked DELIVERED, AMR released to charging base.');
        setRecentLogs(mockDb.getAuditLogs().slice(0, 5) as AuditLog[]);
        confetti({ particleCount: 150, spread: 80 });
      }
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar />

        <main className="p-8 space-y-8 overflow-y-auto flex-1 overscroll-contain">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-blue-500 animate-pulse" />
                SIH DEMO MODE
              </h1>
              <p className="text-sm text-slate-400">Step-by-step interactive test verification of autonomous transport logistics workflow.</p>
            </div>
            <button
              onClick={initDemo}
              className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 transition"
            >
              Reset Demo Seeds
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Live Twin Map Layout */}
            <div className="lg:col-span-2 space-y-6">
              <WarehouseMap floorId={selectedFloor} selectedVehicle={vehicle} activeRoute={routePts} />
              
              {/* Telemetry Log */}
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block flex items-center gap-1.5">
                  <Compass className="h-4 w-4" /> Telemetry & Status Status
                </span>
                <p className="text-sm font-semibold text-blue-400 font-mono bg-slate-900/60 p-3 rounded-lg border border-slate-900">
                  {stepStatus}
                </p>
              </div>
            </div>

            {/* Steps sequences navigation */}
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Automation Sequence Flow</span>
                
                <div className="space-y-2">
                  {stepsList.map((step, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-xl border text-xs transition duration-150 ${
                        currentStep === idx + 1
                          ? 'border-blue-500 bg-blue-600/10 text-slate-100 shadow-md'
                          : (currentStep > idx + 1 ? 'border-slate-900 bg-slate-950 text-slate-500 opacity-60' : 'border-slate-900 bg-slate-950/40 text-slate-400')
                      }`}
                    >
                      <h4 className="font-bold">{step.label}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{step.desc}</p>
                    </div>
                  ))}
                </div>

                {currentStep < stepsList.length && (
                  <button
                    onClick={triggerNextStep}
                    className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-slate-50 transition mt-4"
                  >
                    Execute Next Step
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
