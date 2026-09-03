'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import WarehouseMap from '@/components/WarehouseMap';
import { SimulatorVehicleController } from '@/lib/simulator/vehicleController';
import mockDb from '@/lib/supabase/mockDb';
import { calculateRoute } from '@/lib/algorithms/astar';
import { fleetCoordinator, FleetMetrics, FleetConflict } from '@/lib/simulator/fleetCoordinator';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Terminal,
  Zap,
  Brain,
  AlertTriangle,
  ShieldAlert,
  Radio,
  Target
} from 'lucide-react';
import { Vehicle, Task, Location, Box, EdgeAIDecision } from '@/lib/database.types';
import { ObstacleCell } from '@/lib/simulator/edgeAIEngine';

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
}

const floorLabel = (fId: string) => fId === 'f-01' ? '1' : fId === 'f-02' ? '2' : '3';

type SimMode = 'SINGLE' | 'FLEET';

export default function TrackingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);

  // View & Mode State
  const [simMode, setSimMode] = useState<SimMode>('SINGLE');
  const [selectedFloor, setSelectedFloor] = useState('f-01');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSensorRanges, setShowSensorRanges] = useState(true);

  // --- Single AMR State ---
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const hasAutoSelected = useRef(false);
  const [activeRoutePts, setActiveRoutePts] = useState<any[]>([]);
  const [simSpeed, setSimSpeed] = useState(1);
  const simControllerRef = useRef<SimulatorVehicleController | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepLabel, setCurrentStepLabel] = useState('Ready for drive simulation');

  // --- Fleet Mode State ---
  const [isSimulatingAll, setIsSimulatingAll] = useState(false);
  const fleetControllersRef = useRef<{ [vehicleId: string]: SimulatorVehicleController }>({});
  const [fleetMetrics, setFleetMetrics] = useState<FleetMetrics | null>(null);

  // --- Shared Edge-AI State ---
  const [obstacles, setObstacles] = useState<ObstacleCell[]>([]);
  const [edgeDecisions, setEdgeDecisions] = useState<EdgeAIDecision[]>([]);
  
  // Console
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev.slice(-49),
      { id: `log-${Date.now()}-${Math.random()}`, time, message, type }
    ]);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Handle fleet events
  useEffect(() => {
    const unsubscribe = fleetCoordinator.onEvent((event) => {
      let type: LogEntry['type'] = 'INFO';
      if (event.type === 'CONFLICT_RESOLVED') type = 'WARN';
      if (event.type === 'OBSTACLE_BROADCAST') type = 'ERROR';
      if (event.type === 'LANE_GRANTED') type = 'SUCCESS';
      
      addLog(`[FLEET] ${event.message}`, type);
    });
    return () => unsubscribe();
  }, [addLog]);

  const loadData = useCallback(async () => {
    try {
      const [vRes, tRes, lRes, bRes] = await Promise.all([
        supabase.from('vehicles').select(),
        supabase.from('tasks').select(),
        supabase.from('locations').select(),
        supabase.from('boxes').select()
      ]);

      const v = (vRes.data || []) as Vehicle[];
      setVehicles(v);
      const t = (tRes.data || []) as Task[];
      setTasks(t);
      const l = (lRes.data || []) as Location[];
      setLocations(l);
      const b = (bRes.data || []) as Box[];
      setBoxes(b);

      setObstacles(fleetCoordinator.getGlobalObstacles());
      setEdgeDecisions(mockDb.getEdgeAIDecisions());
      setFleetMetrics(fleetCoordinator.getMetrics());

      const sysSettings = mockDb.getSettings();
      if (!simControllerRef.current) {
        setSimSpeed(sysSettings.default_speed || 1);
      }

      if (!hasAutoSelected.current && v.length > 0) {
        hasAutoSelected.current = true;
        setSelectedVehicleId(v[0].id);
        setSelectedFloor(v[0].current_floor_id);
      }
    } catch (err) {
      console.error('Failed to load tracking data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleMapClick = (x: number, y: number) => {
    // Check if obstacle already exists here
    const existingIndex = obstacles.findIndex(o => o.x === x && o.y === y && o.floor_id === selectedFloor);
    
    if (existingIndex !== -1) {
      // Remove obstacle
      fleetCoordinator.removeGlobalObstacle(x, y, selectedFloor);
      if (simMode === 'FLEET') {
        Object.values(fleetControllersRef.current).forEach(c => (c as any).getEdgeAIEngine?.().removeManualObstacle(x, y, selectedFloor));
      } else if (simControllerRef.current) {
        (simControllerRef.current as any).getEdgeAIEngine?.().removeManualObstacle(x, y, selectedFloor);
      }
      addLog(`Removed obstacle at [${x},${y}].`, 'INFO');
    } else {
      // Add obstacle globally so it appears immediately
      const obstacle: ObstacleCell = {
        x, y, floor_id: selectedFloor,
        detected_by: 'USER', timestamp: Date.now(), ttl: 30000
      };
      fleetCoordinator.addGlobalObstacle(obstacle);
      
      // Also notify active edge engines so they react instantly
      if (simMode === 'FLEET') {
        Object.values(fleetControllersRef.current).forEach(c => (c as any).getEdgeAIEngine?.().addManualObstacle(x, y, selectedFloor));
      } else if (simControllerRef.current) {
        (simControllerRef.current as any).getEdgeAIEngine?.().addManualObstacle(x, y, selectedFloor);
      }
      
      addLog(`Dropped manual obstacle at [${x},${y}]. AMRs will reroute if they encounter it.`, 'WARN');
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;

  // --- SINGLE AMR LOGIC ---
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
    if (isSimulatingAll) {
      addLog('Cannot select individual vehicles while Fleet Mode is running.', 'WARN');
      return;
    }
    stopCurrentSimulation();
    setSelectedVehicleId(v.id);
    setSelectedFloor(v.current_floor_id);
    setCurrentStepLabel(`Selected ${v.vehicle_code}. Ready for simulation.`);
    addLog(`Selected ${v.vehicle_code} (${v.name}) on Floor ${floorLabel(v.current_floor_id)}.`, 'INFO');
  }, [stopCurrentSimulation, addLog, isSimulatingAll]);

  const ensureAssignedTask = useCallback((veh: Vehicle): { task: Task; box: Box } | null => {
    if (veh.current_task_id) {
      const existingTask = tasks.find((t) => t.id === veh.current_task_id);
      const existingBox = existingTask ? boxes.find((b) => b.id === existingTask.box_id) : null;
      if (existingTask && existingBox) return { task: existingTask, box: existingBox };
    }
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
      const availableBox = boxes.find((b) => b.status === 'WAITING') || boxes[0];
      if (!availableBox) return null;
      const sameFloorDest = locations.find(l => l.floor_id === veh.current_floor_id && (l.type === 'DELIVERY' || l.type === 'RACK') && !(l.x === veh.x_position && l.y === veh.y_position));
      const fallbackDest = locations.find(l => l.floor_id === veh.current_floor_id && !(l.x === veh.x_position && l.y === veh.y_position));
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
    supabase.from('vehicles').update({ status: 'BUSY', current_task_id: targetTask.id }).eq('id', veh.id);
    supabase.from('tasks').update({ status: 'ASSIGNED', vehicle_id: veh.id, assigned_at: new Date().toISOString() }).eq('id', targetTask.id);
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
    if (!destLoc) return;

    const pts = calculateRoute(selectedVehicle.current_floor_id, selectedVehicle.x_position, selectedVehicle.y_position, destLoc.floor_id, destLoc.x, destLoc.y, locations);
    setActiveRoutePts(pts);
    addLog(`Calculated route: ${pts.length} steps to ${destLoc.name}.`, 'INFO');

    const controller = new SimulatorVehicleController(selectedVehicle.id);
    controller.connect();
    controller.setSpeed(simSpeed);
    simControllerRef.current = controller;
    setIsSimulating(true);
    setIsPaused(false);

    supabase.from('tasks').update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() }).eq('id', task.id);
    supabase.from('boxes').update({ status: 'IN_TRANSIT' }).eq('id', box.id);

    const vCode = selectedVehicle.vehicle_code;
    controller.sendMoveCommand(
      pts,
      (x, y, floorId, index) => {
        setSelectedFloor(floorId);
        setCurrentStepLabel(`Step ${index + 1}/${pts.length}: [X:${x}, Y:${y}] Floor ${floorLabel(floorId)}`);
      },
      () => {
        setCurrentStepLabel(`Arrived at ${destLoc.name}.`);
        addLog(`✓ ${vCode} Arrived at destination.`, 'SUCCESS');
        supabase.from('tasks').update({ status: 'PICKUP_PENDING' }).eq('id', task.id);
        supabase.from('boxes').update({ status: 'PICKUP_PENDING' }).eq('id', box.id);
        setIsSimulating(false);
      }
    );
  }, [selectedVehicle, ensureAssignedTask, locations, simSpeed, addLog]);

  const handleStartCharging = useCallback(() => {
    if (!selectedVehicle) return;
    const charger = locations.find((l) => l.floor_id === selectedVehicle.current_floor_id && l.type === 'CHARGING') || locations.find((l) => l.type === 'CHARGING');
    if (!charger) return;
    const pts = calculateRoute(selectedVehicle.current_floor_id, selectedVehicle.x_position, selectedVehicle.y_position, charger.floor_id, charger.x, charger.y, locations);
    setActiveRoutePts(pts);
    const controller = new SimulatorVehicleController(selectedVehicle.id);
    controller.connect();
    controller.setSpeed(simSpeed);
    simControllerRef.current = controller;
    setIsSimulating(true);
    setIsPaused(false);

    controller.sendMoveCommand(
      pts,
      (x, y, floorId, index) => {
        setSelectedFloor(floorId);
        setCurrentStepLabel(`Navigating to ⚡ Charger: Step ${index + 1}/${pts.length}`);
      },
      () => {
        setCurrentStepLabel(`Battery refueled to 100%.`);
        supabase.from('vehicles').update({ status: 'CHARGING', battery_percentage: 100, current_location_id: charger.id, x_position: charger.x, y_position: charger.y }).eq('id', selectedVehicle.id);
        loadData();
        setIsSimulating(false);
      }
    );
  }, [selectedVehicle, locations, simSpeed, addLog, loadData]);

  // --- FLEET MODE LOGIC ---
  const startFleetAll = () => {
    if (isSimulatingAll) return;
    if (isSimulating) {
      addLog('Stop single vehicle simulation before starting fleet mode.', 'WARN');
      return;
    }
    
    addLog('Starting multi-vehicle fleet simulation...', 'SUCCESS');
    
    let allOnFloor = vehicles.filter(v => v.current_floor_id === selectedFloor && v.status !== 'OFFLINE');
    if (allOnFloor.length === 0) {
      addLog('No vehicles found on this floor.', 'WARN');
      return;
    }

    let available: Vehicle[] = [];

    // Prioritize the user's selected vehicle if it's on this floor
    if (selectedVehicleId) {
      const selectedV = allOnFloor.find(v => v.id === selectedVehicleId);
      if (selectedV) {
        available.push(selectedV);
        allOnFloor = allOnFloor.filter(v => v.id !== selectedVehicleId);
      }
    }

    // Fill the rest with AVAILABLE vehicles, up to 3 total for the fleet sim
    const availableOthers = allOnFloor.filter(v => v.status === 'AVAILABLE');
    available = [...available, ...availableOthers].slice(0, 3);

    if (available.length === 0) {
      // Fallback: forcefully use busy vehicles if absolutely no one is available
      const busy = allOnFloor.filter(v => v.status === 'BUSY').slice(0, 3);
      if (busy.length === 0) return;
      available = busy;
      addLog('Forced reset of BUSY vehicles to start simulation.', 'WARN');
    }

    available.forEach(v => {
      const assignment = ensureAssignedTask(v);
      if (!assignment) return;

      const { task, box } = assignment;
      const destLoc = locations.find((l) => l.id === task.destination_location_id);
      
      if (destLoc) {
        const pts = calculateRoute(v.current_floor_id, v.x_position, v.y_position, destLoc.floor_id, destLoc.x, destLoc.y, locations);
        if (pts.length > 0) {
          const controller = new SimulatorVehicleController(v.id, 0.30);
          controller.connect();
          controller.setSpeed(3);
          fleetControllersRef.current[v.id] = controller;
          
          supabase.from('vehicles').update({ status: 'BUSY' }).eq('id', v.id);
          supabase.from('tasks').update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() }).eq('id', task.id);
          supabase.from('boxes').update({ status: 'IN_TRANSIT' }).eq('id', box.id);
          
          controller.sendMoveCommand(
            pts,
            () => {},
            () => {
              addLog(`✓ ${v.vehicle_code} reached destination.`, 'SUCCESS');
              supabase.from('tasks').update({ status: 'PICKUP_PENDING' }).eq('id', task.id);
              supabase.from('boxes').update({ status: 'PICKUP_PENDING' }).eq('id', box.id);
              supabase.from('vehicles').update({ status: 'AVAILABLE' }).eq('id', v.id);
              delete fleetControllersRef.current[v.id];
              if (Object.keys(fleetControllersRef.current).length === 0) setIsSimulatingAll(false);
            }
          );
        }
      }
    });
    setIsSimulatingAll(true);
  };

  const stopFleetAll = () => {
    Object.values(fleetControllersRef.current).forEach(c => c.stop());
    fleetControllersRef.current = {};
    setIsSimulatingAll(false);
    vehicles.forEach(v => {
      if (v.status === 'BUSY') supabase.from('vehicles').update({ status: 'AVAILABLE' }).eq('id', v.id);
    });
    addLog('Stopped fleet simulation.', 'WARN');
    loadData();
  };

  const resetEdgeAI = () => {
    fleetCoordinator.reset();
    if (simMode === 'FLEET') {
      Object.values(fleetControllersRef.current).forEach(c => (c as any).getEdgeAIEngine?.().reset());
    } else if (simControllerRef.current) {
      (simControllerRef.current as any).getEdgeAIEngine?.().reset();
    }
    addLog('Edge-AI state and obstacles reset.', 'WARN');
    loadData();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 relative">
      <AmbientBackground intensity="low" />
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
          
          {/* Header & Modes */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-3">
                Live Tracking & Coordination
                {simMode === 'FLEET' && (
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/40 border border-purple-500/50">
                    <Brain className="h-4 w-4 text-purple-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Distributed AI</span>
                  </div>
                )}
              </h1>
              <p className="text-[10px] sm:text-xs text-blue-400 font-bold mt-2 bg-blue-950/30 p-2 rounded-lg border border-blue-900/50 inline-block">
                💡 Tip: Click anywhere on the map grid below to manually drop an obstacle and watch the AMRs react!
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setSimMode('SINGLE')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition duration-150 ${
                  simMode === 'SINGLE' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Single AMR
              </button>
              <button
                onClick={() => setSimMode('FLEET')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition duration-150 ${
                  simMode === 'FLEET' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Fleet Mode
              </button>
            </div>
          </div>

          {/* Fleet Metrics (Only shown in FLEET mode) */}
          {simMode === 'FLEET' && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Obstacles</span>
                <span className="text-2xl font-black text-amber-500 mt-1">{fleetMetrics?.totalObstaclesReported || 0}</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Conflicts Resolved</span>
                <span className="text-2xl font-black text-red-400 mt-1">{fleetMetrics?.totalConflictsResolved || 0}</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><Radio className="h-3 w-3" /> Broadcasts</span>
                <span className="text-2xl font-black text-blue-400 mt-1">{fleetMetrics?.totalBroadcasts || 0}</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><Target className="h-3 w-3" /> Yields</span>
                <span className="text-2xl font-black text-green-400 mt-1">{fleetMetrics?.totalYields || 0}</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"><Brain className="h-3 w-3" /> AI Agents</span>
                <span className="text-2xl font-black text-purple-400 mt-1">{fleetMetrics?.vehiclesWithSensors || 0}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Map and controls */}
            <div className="lg:col-span-3 space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Floor View:</span>
                  {['f-01', 'f-02', 'f-03'].map((fId, idx) => (
                    <button
                      key={fId}
                      onClick={() => setSelectedFloor(fId)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                        selectedFloor === fId ? 'bg-blue-600 text-slate-50 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Floor {idx + 1}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setShowSensorRanges(!showSensorRanges)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${showSensorRanges ? 'bg-blue-900/40 text-blue-400 border-blue-500/50' : 'bg-slate-900 text-slate-400 border-slate-800'}`} title="Show edge-AI detection radius around each AMR">
                    <Radio className="h-3.5 w-3.5" /> 
                    {showSensorRanges ? 'Sensors Active' : 'Show Sensors'}
                  </button>
                  <button onClick={resetEdgeAI} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 transition" title="Clear Obstacles & AI Data">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-2">
                <WarehouseMap
                  floorId={selectedFloor}
                  selectedVehicle={simMode === 'SINGLE' ? selectedVehicle : null}
                  activeRoute={simMode === 'SINGLE' ? activeRoutePts : []}
                  obstacles={obstacles}
                  showSensorRange={showSensorRanges}
                  edgeDecisions={edgeDecisions}
                  onGridClick={handleMapClick}
                />
              </div>

              {/* Console & Controls Container */}
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 shadow-xl space-y-4">
                
                {/* Fleet Controls (If in FLEET mode) */}
                {simMode === 'FLEET' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-900">
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">Fleet Chaos Testing</h3>
                      <p className="text-xs text-slate-400 mt-1">Start multiple vehicles to observe their Edge-AI communication.</p>
                    </div>
                    <div>
                      {!isSimulatingAll ? (
                        <button onClick={startFleetAll} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-extrabold text-white transition shadow-lg shadow-emerald-600/20">
                          <Play className="h-4 w-4" /> Start Fleet Sim
                        </button>
                      ) : (
                        <button onClick={stopFleetAll} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-extrabold text-white transition shadow-lg shadow-red-600/20">
                          <Pause className="h-4 w-4" /> Stop Sim
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Single Drive Console (If in SINGLE mode) */}
                {simMode === 'SINGLE' && selectedVehicle && (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-blue-400 font-mono tracking-widest">
                          Drive Console — {selectedVehicle.vehicle_code}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${isSimulating ? (isPaused ? 'bg-amber-950 text-amber-400' : 'bg-green-950 text-green-400') : 'bg-slate-800 text-slate-400'}`}>
                          {isSimulating ? (isPaused ? 'PAUSED' : 'RUNNING') : 'IDLE'}
                        </span>
                        {selectedVehicle?.sensor_suite_active && (
                           <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1 bg-purple-950 text-purple-400">
                             <Brain className="h-3 w-3" /> EDGE AI {selectedVehicle.edge_ai_status}
                           </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 font-bold mt-1">{currentStepLabel}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isSimulating && !isPaused ? (
                        <>
                          <button onClick={handleStartSimulation} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-slate-50 transition-all">
                            <Play className="h-3.5 w-3.5" /> Start Drive
                          </button>
                          <button onClick={handleStartCharging} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-yellow-950/40 border border-yellow-700/60 text-yellow-400 text-xs font-bold hover:bg-yellow-900/50 transition">
                            <Zap className="h-3.5 w-3.5" /> Charge
                          </button>
                        </>
                      ) : (
                        <button onClick={stopCurrentSimulation} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/40 border border-red-900/40 text-red-400 text-xs font-bold hover:bg-red-900/60 transition">
                          <RotateCcw className="h-3.5 w-3.5" /> Stop
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Shared Activity Log */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-blue-400" /> Activity Log
                    </span>
                    <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-slate-300 font-mono">
                      Clear
                    </button>
                  </div>
                  <div ref={logContainerRef} className="h-36 overflow-y-auto rounded-xl border border-slate-900 bg-slate-950/90 p-3.5 font-mono text-[11px] space-y-1 text-slate-300">
                    {logs.length === 0 ? (
                      <p className="text-slate-600 italic">No activity yet.</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2">
                          <span className="text-slate-600 shrink-0">[{log.time}]</span>
                          <span className={log.type === 'SUCCESS' ? 'text-green-400 font-bold' : log.type === 'WARN' ? 'text-amber-400 font-bold' : log.type === 'ERROR' ? 'text-red-400 font-bold' : 'text-slate-300'}>
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel */}
            <div className="space-y-6">
              
              {simMode === 'FLEET' && (
                // Fleet How It Works
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 shadow-xl space-y-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">How Fleet Coordination Works</span>
                  <div className="text-sm text-slate-300 leading-relaxed space-y-3">
                    <p>
                      <strong>Fleet Coordination</strong> simply means the robots talk to each other.
                    </p>
                    <p className="text-slate-400 text-xs">
                      When one robot detects an obstacle and stops, it instantly broadcasts the location to the rest of the fleet so they can recalculate their paths and avoid a traffic jam.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-900 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Map Legend</span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-300">
                      <span className="bg-red-500 text-black px-1.5 py-0.5 rounded font-bold text-[8px]">STOP</span>
                      <span>Edge AI detected obstacle (Halt)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-300">
                      <div className="w-4 h-4 border border-red-500 bg-red-950/80 rounded animate-pulse flex items-center justify-center"><span className="text-[8px]">⚠</span></div>
                      <span>Obstacle Broadcasted to Fleet</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Vehicle Roster (Always visible) */}
              <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                  {simMode === 'FLEET' ? 'Active Fleet' : 'Select AMR'}
                </span>
                <div className="space-y-3">
                  {vehicles.map((v) => (
                    <button
                      key={v.id}
                      disabled={v.status === 'OFFLINE' || isSimulatingAll}
                      onClick={() => handleSelectVehicle(v)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                        v.status === 'OFFLINE' ? 'opacity-30 cursor-not-allowed' : ''
                      } ${
                        selectedVehicleId === v.id
                          ? 'border-blue-500 bg-blue-600/10 text-slate-100 shadow-lg ring-1 ring-blue-500/50'
                          : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900/30'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-xs font-mono">{v.vehicle_code}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${v.status === 'AVAILABLE' ? 'bg-green-950 text-green-400' : 'bg-blue-950 text-blue-400'}`}>
                          {v.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-semibold">{v.name}</p>
                      <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500 font-mono">
                        <span>Floor {floorLabel(v.current_floor_id)}</span>
                        <span>🔋 {v.battery_percentage}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
