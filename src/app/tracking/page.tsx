'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import WarehouseMap from '@/components/WarehouseMap';
import { SimulatorVehicleController } from '@/lib/simulator/vehicleController';
import mockDb from '@/lib/supabase/mockDb';
import { calculateRoute } from '@/lib/algorithms/astar';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Terminal,
  Zap,
} from 'lucide-react';
import { Vehicle, Task, Route, Location, Box } from '@/lib/database.types';

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARN';
}

const floorLabel = (fId: string) => fId === 'f-01' ? '1' : fId === 'f-02' ? '2' : '3';

export default function TrackingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);

  // Use refs for selected vehicle ID to avoid stale closure issues
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState('f-01');
  const hasAutoSelected = useRef(false);

  // Simulator state
  const [activeRoutePts, setActiveRoutePts] = useState<any[]>([]);
  const [simSpeed, setSimSpeed] = useState(1);
  const simControllerRef = useRef<SimulatorVehicleController | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepLabel, setCurrentStepLabel] = useState('Ready for drive simulation');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: 'INFO' | 'SUCCESS' | 'WARN' = 'INFO') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev.slice(-40),
      { id: `log-${Date.now()}-${Math.random()}`, time, message, type }
    ]);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Data loading — does NOT touch selectedVehicleId or selectedFloor
  const loadData = useCallback(() => {
    const v = (supabase.from('vehicles').select().data || []) as Vehicle[];
    setVehicles(v);
    const t = (supabase.from('tasks').select().data || []) as Task[];
    setTasks(t);
    const l = (supabase.from('locations').select().data || []) as Location[];
    setLocations(l);
    const b = (supabase.from('boxes').select().data || []) as Box[];
    setBoxes(b);

    // Read system settings and apply default speed if not currently simulating
    const sysSettings = mockDb.getSettings();
    if (!simControllerRef.current) {
      setSimSpeed(sysSettings.default_speed || 1);
    }

    // Auto-select first vehicle only on first load
    if (!hasAutoSelected.current && v.length > 0) {
      hasAutoSelected.current = true;
      setSelectedVehicleId(v[0].id);
      setSelectedFloor(v[0].current_floor_id);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Derive the selected vehicle object from the current vehicles list
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;

  const stopCurrentSimulation = useCallback(() => {
    if (simControllerRef.current) {
      simControllerRef.current.stop();
      simControllerRef.current = null;
    }
    setIsSimulating(false);
    setIsPaused(false);
    setActiveRoutePts([]);
  }, []);

  const handleSelectVehicle = useCallback((v: Vehicle) => {
    stopCurrentSimulation();
    setSelectedVehicleId(v.id);
    setSelectedFloor(v.current_floor_id);
    setCurrentStepLabel(`Selected ${v.vehicle_code}. Ready for simulation.`);
    addLog(`Selected ${v.vehicle_code} (${v.name}) on Floor ${floorLabel(v.current_floor_id)}.`, 'INFO');
  }, [stopCurrentSimulation, addLog]);

  // Ensure a task is assigned, picking destinations on the SAME floor as the vehicle
  const ensureAssignedTask = useCallback((veh: Vehicle): { task: Task; box: Box } | null => {
    if (veh.current_task_id) {
      const existingTask = tasks.find((t) => t.id === veh.current_task_id);
      const existingBox = existingTask ? boxes.find((b) => b.id === existingTask.box_id) : null;
      if (existingTask && existingBox) {
        return { task: existingTask, box: existingBox };
      }
    }

    // Pick a pending task that has a destination on the vehicle's floor first, then any
    const pending = tasks.filter((t) => t.status === 'PENDING');
    let targetTask: Task;

    const sameFloorPending = pending.find((t) => {
      const destLoc = locations.find((l) => l.id === t.destination_location_id);
      return destLoc && destLoc.floor_id === veh.current_floor_id;
    });

    if (sameFloorPending) {
      targetTask = sameFloorPending;
    } else if (pending.length > 0) {
      targetTask = pending[0];
    } else {
      // Create a test task — pick destination on the vehicle's current floor
      const availableBox = boxes.find((b) => b.status === 'WAITING') || boxes[0];
      if (!availableBox) return null;

      // Find a destination location on the SAME floor as the vehicle
      const sameFloorDest = locations.find(
        (l) => l.floor_id === veh.current_floor_id && (l.type === 'DELIVERY' || l.type === 'RACK') && !(l.x === veh.x_position && l.y === veh.y_position)
      );
      // Fallback: any location on same floor that isn't the vehicle's current position
      const fallbackDest = locations.find(
        (l) => l.floor_id === veh.current_floor_id && !(l.x === veh.x_position && l.y === veh.y_position)
      );
      const destLocation = sameFloorDest || fallbackDest;
      if (!destLocation) return null;

      targetTask = {
        id: `task-sim-${Date.now()}`,
        task_code: `TSK-SIM-${Date.now().toString().substring(8)}`,
        box_id: availableBox.id,
        vehicle_id: veh.id,
        source_location_id: veh.current_location_id || locations.find(l => l.floor_id === veh.current_floor_id)?.id || 'loc-f1-pickup',
        destination_location_id: destLocation.id,
        priority: 'HIGH',
        status: 'PENDING',
        priority_score: 50,
        estimated_distance: 15,
        estimated_duration: 120,
        actual_duration: null,
        created_by: 'system',
        assigned_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      supabase.from('tasks').insert(targetTask);
    }

    // Assign vehicle to task
    supabase.from('vehicles').update({
      status: 'BUSY',
      current_task_id: targetTask.id,
    }).eq('id', veh.id);

    supabase.from('tasks').update({
      status: 'ASSIGNED',
      vehicle_id: veh.id,
      assigned_at: new Date().toISOString(),
    }).eq('id', targetTask.id);

    const targetBox = boxes.find((b) => b.id === targetTask.box_id) || boxes[0];
    return { task: targetTask, box: targetBox };
  }, [tasks, boxes, locations]);

  const handleStartSimulation = useCallback(() => {
    if (!selectedVehicle) return;

    const assignment = ensureAssignedTask(selectedVehicle);
    if (!assignment) {
      addLog('Error: Unable to assign task or route for simulation.', 'WARN');
      return;
    }

    const { task, box } = assignment;
    addLog(`Dispatching ${selectedVehicle.vehicle_code} on Task ${task.task_code} (Box ${box.box_code})...`, 'INFO');

    const destLoc = locations.find((l) => l.id === task.destination_location_id);
    if (!destLoc) {
      addLog('Error: Destination location coordinates not found.', 'WARN');
      return;
    }

    const pts = calculateRoute(
      selectedVehicle.current_floor_id,
      selectedVehicle.x_position,
      selectedVehicle.y_position,
      destLoc.floor_id,
      destLoc.x,
      destLoc.y,
      locations
    );

    setActiveRoutePts(pts);
    addLog(`Calculated A* route: ${pts.length} steps. From Floor ${floorLabel(selectedVehicle.current_floor_id)} to ${destLoc.name} (Floor ${floorLabel(destLoc.floor_id)}).`, 'INFO');

    const controller = new SimulatorVehicleController(selectedVehicle.id);
    controller.connect();
    controller.setSpeed(simSpeed);
    simControllerRef.current = controller;
    setIsSimulating(true);
    setIsPaused(false);

    supabase.from('tasks').update({
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString(),
    }).eq('id', task.id);

    supabase.from('boxes').update({
      status: 'IN_TRANSIT',
    }).eq('id', box.id);

    const vCode = selectedVehicle.vehicle_code;
    controller.sendMoveCommand(
      pts,
      (x, y, floorId, index) => {
        // Only auto-switch floor during active simulation to follow the cart
        setSelectedFloor(floorId);
        const node = pts[index];
        let msg = '';
        if (node.action === 'ELEVATOR_ENTER') {
          msg = `Entering Elevator A (Floor transition)...`;
        } else if (node.action === 'ELEVATOR_EXIT') {
          msg = `Exited Elevator onto Floor ${floorLabel(floorId)}.`;
        } else {
          msg = `Step ${index + 1}/${pts.length}: [X:${x}, Y:${y}] Floor ${floorLabel(floorId)}`;
        }
        setCurrentStepLabel(msg);
        addLog(`${vCode} → ${msg}`, 'INFO');
      },
      () => {
        const arrivalMsg = `Arrived at ${destLoc.name}. Pending QR verification.`;
        setCurrentStepLabel(arrivalMsg);
        addLog(`✓ ${vCode}: ${arrivalMsg}`, 'SUCCESS');

        supabase.from('tasks').update({ status: 'PICKUP_PENDING' }).eq('id', task.id);
        supabase.from('boxes').update({ status: 'PICKUP_PENDING' }).eq('id', box.id);
        setIsSimulating(false);
      }
    );
  }, [selectedVehicle, ensureAssignedTask, locations, simSpeed, addLog]);

  const handleStartCharging = useCallback(() => {
    if (!selectedVehicle) return;

    const charger = locations.find((l) => l.floor_id === selectedVehicle.current_floor_id && l.type === 'CHARGING')
      || locations.find((l) => l.type === 'CHARGING');

    if (!charger) {
      addLog('Error: No charging station location found.', 'WARN');
      return;
    }

    addLog(`Routing ${selectedVehicle.vehicle_code} to ⚡ Charging Station (${charger.name})...`, 'INFO');

    const pts = calculateRoute(
      selectedVehicle.current_floor_id,
      selectedVehicle.x_position,
      selectedVehicle.y_position,
      charger.floor_id,
      charger.x,
      charger.y,
      locations
    );

    setActiveRoutePts(pts);
    const controller = new SimulatorVehicleController(selectedVehicle.id);
    controller.connect();
    controller.setSpeed(simSpeed);
    simControllerRef.current = controller;
    setIsSimulating(true);
    setIsPaused(false);

    const vCode = selectedVehicle.vehicle_code;
    controller.sendMoveCommand(
      pts,
      (x, y, floorId, index) => {
        setSelectedFloor(floorId);
        const msg = `Navigating to ⚡ Charger: Step ${index + 1}/${pts.length} [X:${x}, Y:${y}]`;
        setCurrentStepLabel(msg);
        addLog(`${vCode} → ${msg}`, 'INFO');
      },
      () => {
        const arrivalMsg = `Arrived at ⚡ Charging Station. Battery refueled to 100%.`;
        setCurrentStepLabel(arrivalMsg);
        addLog(`⚡ ${vCode}: ${arrivalMsg}`, 'SUCCESS');

        supabase.from('vehicles').update({
          status: 'CHARGING',
          battery_percentage: 100,
          current_location_id: charger.id,
          x_position: charger.x,
          y_position: charger.y,
        }).eq('id', selectedVehicle.id);

        loadData();
        setIsSimulating(false);
      }
    );
  }, [selectedVehicle, locations, simSpeed, addLog, loadData]);

  const handleDriveToOut = useCallback(() => {
    if (!selectedVehicle) return;

    const outLoc = locations.find((l) => l.floor_id === selectedVehicle.current_floor_id && l.type === 'DELIVERY')
      || locations.find((l) => l.type === 'DELIVERY');

    if (!outLoc) {
      addLog('Error: No Red Out location found.', 'WARN');
      return;
    }

    addLog(`Routing ${selectedVehicle.vehicle_code} to 🔴 Red Out Station (${outLoc.name})...`, 'INFO');

    const pts = calculateRoute(
      selectedVehicle.current_floor_id,
      selectedVehicle.x_position,
      selectedVehicle.y_position,
      outLoc.floor_id,
      outLoc.x,
      outLoc.y,
      locations
    );

    setActiveRoutePts(pts);
    const controller = new SimulatorVehicleController(selectedVehicle.id);
    controller.connect();
    controller.setSpeed(simSpeed);
    simControllerRef.current = controller;
    setIsSimulating(true);
    setIsPaused(false);

    const vCode = selectedVehicle.vehicle_code;
    controller.sendMoveCommand(
      pts,
      (x, y, floorId, index) => {
        setSelectedFloor(floorId);
        const msg = `Routing to Red Out: Step ${index + 1}/${pts.length} [X:${x}, Y:${y}]`;
        setCurrentStepLabel(msg);
        addLog(`${vCode} → ${msg}`, 'INFO');
      },
      () => {
        const arrivalMsg = `Arrived at 🔴 Red Out Station (${outLoc.name}). Ready for outbound dispatch.`;
        setCurrentStepLabel(arrivalMsg);
        addLog(`✓ ${vCode}: ${arrivalMsg}`, 'SUCCESS');

        supabase.from('vehicles').update({
          x_position: outLoc.x,
          y_position: outLoc.y,
          current_location_id: outLoc.id,
        }).eq('id', selectedVehicle.id);

        loadData();
        setIsSimulating(false);
      }
    );
  }, [selectedVehicle, locations, simSpeed, addLog, loadData]);

  const handlePauseResume = useCallback(() => {
    if (!simControllerRef.current) return;
    if (isPaused) {
      simControllerRef.current.resume();
      setIsPaused(false);
      addLog(`Resumed drive for ${selectedVehicle?.vehicle_code}.`, 'INFO');
    } else {
      simControllerRef.current.pause();
      setIsPaused(true);
      addLog(`Paused drive for ${selectedVehicle?.vehicle_code}.`, 'WARN');
    }
  }, [isPaused, selectedVehicle, addLog]);

  const handleResetSim = useCallback(() => {
    stopCurrentSimulation();
    setCurrentStepLabel('Simulation reset. Ready for new drive.');
    addLog('Simulation state reset.', 'WARN');
    loadData();
  }, [stopCurrentSimulation, addLog, loadData]);

  const handleSpeedChange = useCallback((mult: number) => {
    setSimSpeed(mult);
    if (simControllerRef.current) {
      simControllerRef.current.setSpeed(mult);
    }
    addLog(`Speed set to ${mult}x.`, 'INFO');
  }, [addLog]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeTask = selectedVehicle?.current_task_id
    ? tasks.find((t) => t.id === selectedVehicle.current_task_id)
    : null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Live Fleet Tracking & Simulation</h1>
              <p className="text-xs sm:text-sm text-slate-400">Select any cart, pick a floor, and run real-time drive simulations with adjustable speed.</p>
            </div>

            {/* Speed control */}
            <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-500" /> Speed:
              </span>
              {[1, 2, 5, 10].map((mult) => (
                <button
                  key={mult}
                  onClick={() => handleSpeedChange(mult)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 ${
                    simSpeed === mult
                      ? 'bg-blue-600 text-slate-50 shadow-md shadow-blue-600/30'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {mult}x
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Map and controls */}
            <div className="lg:col-span-3 space-y-6">
              {/* Floor tabs */}
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Floor View:</span>
                {['f-01', 'f-02', 'f-03'].map((fId, idx) => (
                  <button
                    key={fId}
                    onClick={() => setSelectedFloor(fId)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                      selectedFloor === fId
                        ? 'bg-blue-600 text-slate-50 shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Floor {idx + 1}
                  </button>
                ))}
              </div>

              <WarehouseMap
                floorId={selectedFloor}
                selectedVehicle={selectedVehicle}
                activeRoute={activeRoutePts}
              />

              {/* Drive Sim Console */}
              {selectedVehicle && (
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-6 shadow-xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-blue-400 font-mono tracking-widest">
                          Drive Console — {selectedVehicle.vehicle_code}
                        </span>
                        <span className="text-[10px] font-mono bg-blue-950 text-blue-400 px-2 py-0.5 rounded font-bold">
                          {simSpeed}x
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          isSimulating ? (isPaused ? 'bg-amber-950 text-amber-400' : 'bg-green-950 text-green-400') : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isSimulating ? (isPaused ? 'PAUSED' : 'RUNNING') : 'IDLE'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 font-bold mt-1">{currentStepLabel}</p>
                      {activeTask && (
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          Task: <span className="text-blue-400 font-bold">{activeTask.task_code}</span> ({activeTask.status})
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isSimulating && !isPaused ? (
                        <>
                          <button
                            onClick={handleStartSimulation}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-extrabold text-slate-50 shadow-lg shadow-blue-600/30 transition-all duration-200 active:scale-95"
                          >
                            <Play className="h-4 w-4" /> Start Drive
                          </button>
                          <button
                            onClick={handleStartCharging}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-950/40 border border-yellow-700/60 hover:bg-yellow-900/50 text-xs font-bold text-yellow-400 transition duration-150 active:scale-95"
                            title="Route cart to ⚡ Charging Station"
                          >
                            <Zap className="h-4 w-4 text-yellow-400" /> ⚡ Charge
                          </button>
                          <button
                            onClick={handleDriveToOut}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-950/40 border border-red-800/60 hover:bg-red-900/50 text-xs font-bold text-red-400 transition duration-150 active:scale-95"
                            title="Route cart to 🔴 Red Out Station"
                          >
                            <span className="h-2 w-2 rounded-full bg-red-500"></span> Red Out
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handlePauseResume}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
                          >
                            <Pause className="h-4 w-4" /> {isPaused ? 'Resume' : 'Pause'}
                          </button>
                          <button
                            onClick={handleResetSim}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-950/20 border border-red-900/40 text-xs font-bold text-red-400 hover:bg-red-950/40 transition"
                          >
                            <RotateCcw className="h-4 w-4" /> Reset
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Console Activity Log */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-blue-400" /> Console Log
                      </span>
                      <button
                        onClick={() => setLogs([])}
                        className="text-[10px] text-slate-500 hover:text-slate-300 font-mono"
                      >
                        Clear
                      </button>
                    </div>

                    <div
                      ref={logContainerRef}
                      className="h-36 overflow-y-auto rounded-xl border border-slate-900 bg-slate-950/90 p-3.5 font-mono text-[11px] space-y-1 text-slate-300"
                    >
                      {logs.length === 0 ? (
                        <p className="text-slate-600 italic">No activity yet. Click &apos;Start Drive&apos; to begin simulation.</p>
                      ) : (
                        logs.map((log) => (
                          <div key={log.id} className="flex items-start gap-2">
                            <span className="text-slate-600 shrink-0">[{log.time}]</span>
                            <span className={log.type === 'SUCCESS' ? 'text-green-400 font-bold' : log.type === 'WARN' ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                              {log.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle roster */}
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Select Cart</span>
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVehicle(v)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                      selectedVehicleId === v.id
                        ? 'border-blue-500 bg-blue-600/10 text-slate-100 shadow-lg ring-1 ring-blue-500/50'
                        : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs font-mono">{v.vehicle_code}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                          v.status === 'AVAILABLE'
                            ? 'bg-green-950 text-green-400'
                            : v.status === 'BUSY'
                            ? 'bg-blue-950 text-blue-400'
                            : v.status === 'MAINTENANCE'
                            ? 'bg-orange-950 text-orange-400'
                            : 'bg-yellow-950 text-yellow-500'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-semibold">{v.name}</p>
                    <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500 font-mono">
                      <span>Floor {floorLabel(v.current_floor_id)}</span>
                      <span>🔋 {v.battery_percentage}%</span>
                    </div>
                    {v.current_task_id && (
                      <span className="text-[9px] text-blue-400 font-semibold block mt-1.5 font-mono">
                        Task: {tasks.find((t) => t.id === v.current_task_id)?.task_code || 'Active'}
                      </span>
                    )}
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
