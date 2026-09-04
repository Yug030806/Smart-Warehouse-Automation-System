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
  Brain,
  AlertTriangle,
  ShieldAlert,
  Radio,
  Target,
  Gauge,
  ArrowUpRight
} from 'lucide-react';
import { Vehicle, Task, Location, Box, EdgeAIDecision, Floor, Warehouse, RouteSegment } from '@/lib/database.types';
import { ObstacleCell } from '@/lib/simulator/edgeAIEngine';
import { generateUUID } from '@/lib/uuid';
import { useAuth } from '@/lib/supabase/AuthProvider';

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
}

const formatFloorName = (fId: string, floorsList: Floor[] = []) => {
  const found = floorsList.find(f => f.id === fId);
  if (found) return found.name || `Floor ${found.floor_number}`;
  if (fId === 'f-01') return 'Floor 1';
  if (fId === 'f-02') return 'Floor 2';
  if (fId === 'f-03') return 'Floor 3';
  return 'Floor 1';
};

type SimMode = 'SINGLE' | 'FLEET';

export default function TrackingPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  // View & Mode State
  const [simMode, setSimMode] = useState<SimMode>('SINGLE');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSensorRanges, setShowSensorRanges] = useState(true);

  // --- Single AMR State ---
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const selectedVehicleIdRef = useRef<string | null>(null);
  const hasAutoSelected = useRef(false);
  const [activeRoutePts, setActiveRoutePts] = useState<any[]>([]);
  const [simSpeed, setSimSpeed] = useState(1);
  const simControllerRef = useRef<SimulatorVehicleController | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const isSimulatingRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepLabel, setCurrentStepLabel] = useState('Ready for drive simulation');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);

  const floorLabel = useCallback((fId: string) => formatFloorName(fId, floors), [floors]);

  // Keep isSimulatingRef in sync
  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  // --- Fleet Mode State ---
  const [isSimulatingAll, setIsSimulatingAll] = useState(false);
  const isSimulatingAllRef = useRef(false);
  const fleetControllersRef = useRef<{ [vehicleId: string]: SimulatorVehicleController }>({});
  const [fleetRoutes, setFleetRoutes] = useState<Record<string, { pts: RouteSegment[]; stepIndex: number }>>({});
  const [fleetMetrics, setFleetMetrics] = useState<FleetMetrics | null>(null);

  useEffect(() => {
    isSimulatingAllRef.current = isSimulatingAll;
  }, [isSimulatingAll]);

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
      const [vRes, tRes, lRes, bRes, fRes, wRes] = await Promise.all([
        supabase.from('vehicles').select(),
        supabase.from('tasks').select(),
        supabase.from('locations').select(),
        supabase.from('boxes').select(),
        supabase.from('floors').select(),
        supabase.from('warehouses').select()
      ]);

      const v = (vRes.data || []) as Vehicle[];
      const activeFleetIds = new Set(Object.keys(fleetControllersRef.current));
      v.forEach(veh => {
        if (isSimulatingRef.current && selectedVehicleIdRef.current === veh.id) {
          return;
        }
        if (activeFleetIds.has(veh.id)) {
          return;
        }
        mockDb.saveVehicle(veh);
      });

      setVehicles(prev => {
        const activeVehId = selectedVehicleIdRef.current;
        let result = v;
        if (isSimulatingRef.current && activeVehId) {
          const moving = prev.find(veh => veh.id === activeVehId);
          if (moving) {
            result = result.map(veh => veh.id === activeVehId ? moving : veh);
          }
        }
        if (activeFleetIds.size > 0) {
          result = result.map(veh => {
            if (activeFleetIds.has(veh.id)) {
              const moving = prev.find(p => p.id === veh.id);
              return moving || veh;
            }
            return veh;
          });
        }
        return result;
      });
      const t = (tRes.data || []) as Task[];
      setTasks(t);
      const l = (lRes.data || []) as Location[];
      setLocations(l);
      const b = (bRes.data || []) as Box[];
      setBoxes(b);
      const fls = (fRes.data || []) as Floor[];
      setFloors(fls);
      const whs = (wRes.data || []) as Warehouse[];
      setWarehouses(whs);

      if (whs.length > 0) {
        setSelectedWarehouseId(prev => {
          if (prev && whs.some(w => w.id === prev)) return prev;
          return whs[0].id;
        });
      }

      if (fls.length > 0) {
        setSelectedFloor(prev => {
          if (prev && fls.some(f => f.id === prev)) return prev;
          return prev;
        });
      }

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
        selectedVehicleIdRef.current = v[0].id;
        if (v[0].current_floor_id) {
          setSelectedFloor(v[0].current_floor_id);
        }
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

  useEffect(() => {
    if (selectedWarehouseId) {
      const whFloors = floors.filter(f => f.warehouse_id === selectedWarehouseId);
      if (whFloors.length > 0) {
        if (!whFloors.some(f => f.id === selectedFloor)) {
          setSelectedFloor(whFloors[0].id);
        }
      } else {
        setSelectedFloor('');
      }
    }
  }, [selectedWarehouseId, floors]);

  const handleMapClick = (x: number, y: number) => {
    // Check if obstacle already exists here
    const existingIndex = obstacles.findIndex(o => o.x === x && o.y === y && o.floor_id === selectedFloor);
    
    if (existingIndex !== -1) {
      // Remove obstacle
      fleetCoordinator.removeGlobalObstacle(x, y, selectedFloor);
      if (simMode === 'FLEET') {
        Object.values(fleetControllersRef.current).forEach(c => {
          (c as any).getEdgeAIEngine?.().removeManualObstacle(x, y, selectedFloor);
          c.notifyObstacleChanged();
        });
      } else if (simControllerRef.current) {
        (simControllerRef.current as any).getEdgeAIEngine?.().removeManualObstacle(x, y, selectedFloor);
        simControllerRef.current.notifyObstacleChanged();
      }
      const updated = fleetCoordinator.getGlobalObstacles();
      setObstacles(updated);
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
        Object.values(fleetControllersRef.current).forEach(c => {
          (c as any).getEdgeAIEngine?.().addManualObstacle(x, y, selectedFloor);
          c.notifyObstacleChanged();
        });
      } else if (simControllerRef.current) {
        (simControllerRef.current as any).getEdgeAIEngine?.().addManualObstacle(x, y, selectedFloor);
        simControllerRef.current.notifyObstacleChanged();
      }
      const updated = fleetCoordinator.getGlobalObstacles();
      setObstacles(updated);
      addLog(`Dropped manual obstacle at [${x},${y}]. AMR will halt and wait 3s before rerouting.`, 'WARN');
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;

  // --- SINGLE AMR LOGIC ---
  const stopCurrentSimulation = useCallback(() => {
    isSimulatingRef.current = false;
    if (simControllerRef.current) {
      simControllerRef.current.stop();
      simControllerRef.current = null;
    }
    setIsSimulating(false);
    setIsPaused(false);
    setActiveRoutePts([]);
    setActiveStepIndex(-1);
    setCurrentStepLabel('Simulation stopped.');
    if (selectedVehicleId) {
      const cur = vehicles.find(v => v.id === selectedVehicleId);
      if (cur) {
        supabase.from('vehicles').update({ 
          status: 'AVAILABLE',
          x_position: cur.x_position,
          y_position: cur.y_position,
          current_floor_id: cur.current_floor_id
        }).eq('id', selectedVehicleId).then(() => {});
        mockDb.saveVehicle({ ...cur, status: 'AVAILABLE' });
      } else {
        supabase.from('vehicles').update({ status: 'AVAILABLE' }).eq('id', selectedVehicleId).then(() => {});
      }
      setVehicles(prev => prev.map(v => v.id === selectedVehicleId ? { ...v, status: 'AVAILABLE' } : v));
    }
    loadData();
  }, [selectedVehicleId, vehicles, loadData]);

  const handleSelectVehicle = useCallback((v: Vehicle) => {
    if (isSimulatingAll) {
      // In Fleet Mode, clicking a vehicle focuses inspection on it without stopping simulation
      setSelectedVehicleId(v.id);
      selectedVehicleIdRef.current = v.id;
      setSelectedFloor(v.current_floor_id);
      const fr = fleetRoutes[v.id];
      if (fr) {
        setActiveRoutePts(fr.pts);
        setActiveStepIndex(fr.stepIndex);
        setCurrentStepLabel(`[${v.vehicle_code}] Following vehicle: Step ${fr.stepIndex + 1}/${fr.pts.length} on ${floorLabel(v.current_floor_id)}`);
      } else {
        setActiveRoutePts([]);
        setActiveStepIndex(-1);
        setCurrentStepLabel(`[${v.vehicle_code}] Focused on ${floorLabel(v.current_floor_id)}.`);
      }
      return;
    }
    stopCurrentSimulation();
    setSelectedVehicleId(v.id);
    selectedVehicleIdRef.current = v.id;
    setSelectedFloor(v.current_floor_id);
    setCurrentStepLabel(`Selected ${v.vehicle_code}. Ready for simulation.`);
    addLog(`Selected ${v.vehicle_code} (${v.name}) on ${floorLabel(v.current_floor_id)}.`, 'INFO');
  }, [stopCurrentSimulation, addLog, isSimulatingAll, fleetRoutes, floorLabel]);

  const ensureAssignedTask = useCallback((veh: Vehicle, excludedTaskIds: string[] = [], excludedBoxIds: string[] = []): { task: Task; box: Box } | null => {
    if (veh.current_task_id && !excludedTaskIds.includes(veh.current_task_id)) {
      const existingTask = tasks.find((t) => t.id === veh.current_task_id);
      const existingBox = existingTask ? boxes.find((b) => b.id === existingTask.box_id) : null;
      if (existingTask && existingBox && existingTask.status !== 'COMPLETED' && existingTask.status !== 'PICKUP_PENDING') {
        const destLoc = locations.find(l => l.id === existingTask.destination_location_id);
        if (destLoc && !(destLoc.x === veh.x_position && destLoc.y === veh.y_position && destLoc.floor_id === veh.current_floor_id)) {
          return { task: existingTask, box: existingBox };
        }
      }
    }
    const pending = tasks.filter((t) => t.status === 'PENDING' && !excludedTaskIds.includes(t.id));
    let targetTask: Task;
    const sameFloorPending = pending.find((t) => {
      const destLoc = locations.find((l) => l.id === t.destination_location_id);
      return destLoc && destLoc.floor_id === veh.current_floor_id && !(destLoc.x === veh.x_position && destLoc.y === veh.y_position);
    });

    if (sameFloorPending) {
      targetTask = sameFloorPending;
    } else {
      const otherFloorPending = pending.find((t) => {
        const destLoc = locations.find((l) => l.id === t.destination_location_id);
        return destLoc && !(destLoc.x === veh.x_position && destLoc.y === veh.y_position && destLoc.floor_id === veh.current_floor_id);
      });
      if (otherFloorPending) {
        targetTask = otherFloorPending;
      } else {
        const availableBox = boxes.find((b) => b.status === 'WAITING' && !excludedBoxIds.includes(b.id)) || 
                             boxes.find((b) => !excludedBoxIds.includes(b.id)) || 
                             boxes[0];
        if (!availableBox) return null;
        
        const availableDestinations = locations.filter(l => 
          l.floor_id === veh.current_floor_id && 
          (l.type === 'DELIVERY' || l.type === 'RACK') && 
          !(l.x === veh.x_position && l.y === veh.y_position)
        );
        
        const destIndex = Math.abs(veh.vehicle_code.charCodeAt(veh.vehicle_code.length - 1)) % Math.max(1, availableDestinations.length);
        const destLocation = availableDestinations[destIndex] || locations.find(l => l.floor_id === veh.current_floor_id && !(l.x === veh.x_position && l.y === veh.y_position));
        if (!destLocation) return null;

        targetTask = {
          id: generateUUID(),
          task_code: `TSK-SIM-${Date.now().toString().substring(8)}-${veh.vehicle_code.substring(4)}`,
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
          created_by: user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          assigned_at: new Date().toISOString(),
          started_at: null,
          completed_at: null,
          created_at: new Date().toISOString(),
        };
        supabase.from('tasks').insert(targetTask);
      }
    }
    supabase.from('vehicles').update({ status: 'BUSY', current_task_id: targetTask.id }).eq('id', veh.id);
    supabase.from('tasks').update({ status: 'ASSIGNED', vehicle_id: veh.id, assigned_at: new Date().toISOString() }).eq('id', targetTask.id);
    const targetBox = boxes.find((b) => b.id === targetTask.box_id) || boxes[0];
    return { task: targetTask, box: targetBox };
  }, [tasks, boxes, locations, user]);

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

    const otherVehs = vehicles.filter(v => v.id !== selectedVehicle.id);
    const pts = calculateRoute(
      selectedVehicle.current_floor_id, 
      selectedVehicle.x_position, 
      selectedVehicle.y_position, 
      destLoc.floor_id, 
      destLoc.x, 
      destLoc.y, 
      locations,
      12,
      8,
      obstacles,
      otherVehs
    );
    if (!pts || pts.length === 0) {
      addLog(`No valid route found to ${destLoc.name}. Route blocked.`, 'WARN');
      return;
    }

    setActiveRoutePts(pts);
    setActiveStepIndex(0);
    addLog(`Calculated route: ${pts.length} steps to ${destLoc.name}.`, 'INFO');

    // For single AMR mode, obstacleProbability is 0 (runs cleanly without artificial halts)
    const controller = new SimulatorVehicleController(selectedVehicle.id, 0);
    controller.setInitialVehicle(selectedVehicle);
    controller.setLocations(locations);
    controller.setOtherVehicles(otherVehs);
    controller.connect();
    controller.setSpeed(simSpeed);
    simControllerRef.current = controller;
    isSimulatingRef.current = true;
    selectedVehicleIdRef.current = selectedVehicle.id;
    setIsSimulating(true);
    setIsPaused(false);

    supabase.from('tasks').update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() }).eq('id', task.id);
    supabase.from('boxes').update({ status: 'IN_TRANSIT' }).eq('id', box.id);

    const vCode = selectedVehicle.vehicle_code;
    const vId = selectedVehicle.id;

    controller.sendMoveCommand(
      pts,
      (x, y, floorId, index, totalSteps) => {
        const total = totalSteps || pts.length;
        // Step-by-step updates for Single AMR mode
        setSelectedFloor(floorId);
        setActiveStepIndex(index);
        setCurrentStepLabel(`Step ${index + 1}/${total}: [X:${x}, Y:${y}] ${floorLabel(floorId)}`);

        // Real-time React state update so map immediately moves AMR
        setVehicles(prev => prev.map(v => 
          v.id === vId 
            ? { ...v, x_position: x, y_position: y, current_floor_id: floorId, status: 'BUSY' } 
            : v
        ));

        // Persist real-time position
        supabase.from('vehicles').update({
          x_position: x,
          y_position: y,
          current_floor_id: floorId,
          status: 'BUSY'
        }).eq('id', vId).then(() => {});

        // Activity log display on each step
        addLog(`[${vCode}] Step ${index + 1}/${total}: Moving to [X:${x}, Y:${y}] on ${floorLabel(floorId)}`, 'INFO');
      },
      async () => {
        setCurrentStepLabel(`Arrived at destination (${destLoc.name}).`);
        addLog(`✓ ${vCode} arrived at destination (${destLoc.name}).`, 'SUCCESS');

        setVehicles(prev => prev.map(v => 
          v.id === vId 
            ? { ...v, status: 'AVAILABLE', current_task_id: null, current_location_id: destLoc.id, x_position: destLoc.x, y_position: destLoc.y, current_floor_id: destLoc.floor_id } 
            : v
        ));

        await Promise.all([
          supabase.from('tasks').update({ status: 'PICKUP_PENDING' }).eq('id', task.id),
          supabase.from('boxes').update({ status: 'PICKUP_PENDING' }).eq('id', box.id),
          supabase.from('vehicles').update({ 
            status: 'AVAILABLE',
            current_task_id: null,
            current_location_id: destLoc.id,
            x_position: destLoc.x,
            y_position: destLoc.y,
            current_floor_id: destLoc.floor_id
          }).eq('id', vId)
        ]);

        const curV = mockDb.getVehicles().find(x => x.id === vId);
        if (curV) {
          mockDb.saveVehicle({
            ...curV,
            status: 'AVAILABLE',
            current_task_id: null,
            current_location_id: destLoc.id,
            x_position: destLoc.x,
            y_position: destLoc.y,
            current_floor_id: destLoc.floor_id
          });
        }

        await loadData();
        setActiveStepIndex(-1);
        setIsSimulating(false);
      },
      {
        onObstacleWait: (obsX, obsY, obsFloor, waitSec) => {
          setCurrentStepLabel(`Obstacle detected at [${obsX}, ${obsY}]. Halting and waiting ${waitSec}s...`);
          addLog(`[${vCode}] Obstacle detected at [${obsX}, ${obsY}]. Halting vehicle. Waiting ${waitSec} seconds for clearance...`, 'WARN');
        },
        onObstacleCleared: (obsX, obsY, obsFloor) => {
          setCurrentStepLabel(`Obstacle cleared at [${obsX}, ${obsY}]. Resuming drive...`);
          addLog(`[${vCode}] Obstacle at [${obsX}, ${obsY}] cleared within 3s. Resuming original route.`, 'SUCCESS');
        },
        onObstaclePersisted: (obsX, obsY, obsFloor) => {
          setCurrentStepLabel(`Obstacle still present at [${obsX}, ${obsY}]. Recalculating route...`);
          addLog(`[${vCode}] Obstacle still present at [${obsX}, ${obsY}] after 3 seconds. Rerouting around obstacle...`, 'WARN');
        },
        onReroute: (newRoute) => {
          setActiveRoutePts(newRoute);
          setActiveStepIndex(0);
          setCurrentStepLabel(`Rerouted: Step 1/${newRoute.length}`);
          addLog(`[${vCode}] Recalculated new route (${newRoute.length} steps). Resuming drive.`, 'INFO');
        },
        onRerouteFailed: (obsX, obsY, obsFloor) => {
          setCurrentStepLabel(`Path completely blocked at [${obsX}, ${obsY}]. Halting safely.`);
          addLog(`[${vCode}] Path completely blocked at [${obsX}, ${obsY}]. No alternative route found. AMR halted safely.`, 'ERROR');
        },
        onElevatorEnter: (fromFloor, x, y) => {
          addLog(`[${vCode}] Arrived at Elevator at [${x}, ${y}] on ${floorLabel(fromFloor)}. Boarding elevator...`, 'INFO');
        },
        onElevatorExit: (toFloor, x, y) => {
          setSelectedFloor(toFloor);
          addLog(`[${vCode}] Exited elevator on ${floorLabel(toFloor)} at [${x}, ${y}]. Continuing drive...`, 'INFO');
        }
      }
    );
  }, [selectedVehicle, ensureAssignedTask, locations, vehicles, obstacles, simSpeed, addLog, loadData, floorLabel]);

  const handleStartOut = useCallback(() => {
    if (!selectedVehicle) return;
    const outLoc = locations.find((l) => l.floor_id === selectedVehicle.current_floor_id && l.type === 'DELIVERY') || 
                   locations.find((l) => l.type === 'DELIVERY') ||
                   locations.find((l) => l.name.toUpperCase().includes('OUT'));
    if (!outLoc) {
      addLog('No Outbound / Delivery dock location found in warehouse map.', 'WARN');
      return;
    }
    if (outLoc.x === selectedVehicle.x_position && outLoc.y === selectedVehicle.y_position && outLoc.floor_id === selectedVehicle.current_floor_id) {
      addLog(`Vehicle is already at Outbound Dock (${outLoc.name}).`, 'INFO');
      return;
    }

    addLog(`Dispatching ${selectedVehicle.vehicle_code} to Outbound Dock (${outLoc.name})...`, 'INFO');

    const otherVehs = vehicles.filter(v => v.id !== selectedVehicle.id);
    const pts = calculateRoute(
      selectedVehicle.current_floor_id, 
      selectedVehicle.x_position, 
      selectedVehicle.y_position, 
      outLoc.floor_id, 
      outLoc.x, 
      outLoc.y, 
      locations,
      12,
      8,
      obstacles,
      otherVehs
    );
    if (!pts || pts.length === 0) {
      addLog(`No valid route found to Outbound Dock (${outLoc.name}). Route blocked.`, 'WARN');
      return;
    }

    setActiveRoutePts(pts);
    setActiveStepIndex(0);
    addLog(`Calculated route to Out dock: ${pts.length} steps.`, 'INFO');

    // Single AMR mode: 0 obstacle probability
    const controller = new SimulatorVehicleController(selectedVehicle.id, 0);
    controller.setInitialVehicle(selectedVehicle);
    controller.setLocations(locations);
    controller.setOtherVehicles(otherVehs);
    controller.connect();
    controller.setSpeed(simSpeed);
    simControllerRef.current = controller;
    isSimulatingRef.current = true;
    selectedVehicleIdRef.current = selectedVehicle.id;
    setIsSimulating(true);
    setIsPaused(false);

    const vCode = selectedVehicle.vehicle_code;
    const vId = selectedVehicle.id;

    controller.sendMoveCommand(
      pts,
      (x, y, floorId, index, totalSteps) => {
        const total = totalSteps || pts.length;
        // Step-by-step updates for Single AMR mode
        setSelectedFloor(floorId);
        setActiveStepIndex(index);
        setCurrentStepLabel(`Navigating to Outbound Dock: Step ${index + 1}/${total} [X:${x}, Y:${y}]`);

        // Real-time React state update so map immediately moves AMR
        setVehicles(prev => prev.map(v => 
          v.id === vId 
            ? { ...v, x_position: x, y_position: y, current_floor_id: floorId, status: 'BUSY' } 
            : v
        ));

        // Persist real-time position
        supabase.from('vehicles').update({
          x_position: x,
          y_position: y,
          current_floor_id: floorId,
          status: 'BUSY'
        }).eq('id', vId).then(() => {});

        // Activity log display on each step
        addLog(`[${vCode}] Step ${index + 1}/${total}: Moving to [X:${x}, Y:${y}] on ${floorLabel(floorId)}`, 'INFO');
      },
      async () => {
        setCurrentStepLabel(`Arrived at Outbound Dock (${outLoc.name}).`);
        addLog(`✓ ${vCode} arrived at Outbound Dock (${outLoc.name}).`, 'SUCCESS');

        setVehicles(prev => prev.map(v => 
          v.id === vId 
            ? { ...v, status: 'AVAILABLE', current_task_id: null, current_location_id: outLoc.id, x_position: outLoc.x, y_position: outLoc.y, current_floor_id: outLoc.floor_id } 
            : v
        ));

        await supabase.from('vehicles').update({ 
          status: 'AVAILABLE', 
          current_task_id: null,
          current_location_id: outLoc.id, 
          x_position: outLoc.x, 
          y_position: outLoc.y, 
          current_floor_id: outLoc.floor_id 
        }).eq('id', vId);

        const curV = mockDb.getVehicles().find(x => x.id === vId);
        if (curV) {
          mockDb.saveVehicle({
            ...curV,
            status: 'AVAILABLE',
            current_task_id: null,
            current_location_id: outLoc.id,
            x_position: outLoc.x,
            y_position: outLoc.y,
            current_floor_id: outLoc.floor_id
          });
        }

        await loadData();
        setActiveStepIndex(-1);
        setIsSimulating(false);
      },
      {
        onObstacleWait: (obsX, obsY, obsFloor, waitSec) => {
          setCurrentStepLabel(`Obstacle detected at [${obsX}, ${obsY}]. Halting and waiting ${waitSec}s...`);
          addLog(`[${vCode}] Obstacle detected at [${obsX}, ${obsY}]. Halting vehicle. Waiting ${waitSec} seconds for clearance...`, 'WARN');
        },
        onObstacleCleared: (obsX, obsY, obsFloor) => {
          setCurrentStepLabel(`Obstacle cleared at [${obsX}, ${obsY}]. Resuming drive...`);
          addLog(`[${vCode}] Obstacle at [${obsX}, ${obsY}] cleared within 3s. Resuming original route.`, 'SUCCESS');
        },
        onObstaclePersisted: (obsX, obsY, obsFloor) => {
          setCurrentStepLabel(`Obstacle still present at [${obsX}, ${obsY}]. Recalculating route...`);
          addLog(`[${vCode}] Obstacle still present at [${obsX}, ${obsY}] after 3 seconds. Rerouting around obstacle...`, 'WARN');
        },
        onReroute: (newRoute) => {
          setActiveRoutePts(newRoute);
          setActiveStepIndex(0);
          setCurrentStepLabel(`Rerouted: Step 1/${newRoute.length}`);
          addLog(`[${vCode}] Recalculated new route (${newRoute.length} steps). Resuming drive.`, 'INFO');
        },
        onRerouteFailed: (obsX, obsY, obsFloor) => {
          setCurrentStepLabel(`Path completely blocked at [${obsX}, ${obsY}]. Halting safely.`);
          addLog(`[${vCode}] Path completely blocked at [${obsX}, ${obsY}]. No alternative route found. AMR halted safely.`, 'ERROR');
        },
        onElevatorEnter: (fromFloor, x, y) => {
          addLog(`[${vCode}] Arrived at Elevator at [${x}, ${y}] on ${floorLabel(fromFloor)}. Boarding elevator...`, 'INFO');
        },
        onElevatorExit: (toFloor, x, y) => {
          setSelectedFloor(toFloor);
          addLog(`[${vCode}] Exited elevator on ${floorLabel(toFloor)} at [${x}, ${y}]. Continuing drive...`, 'INFO');
        }
      }
    );
  }, [selectedVehicle, locations, vehicles, obstacles, simSpeed, addLog, loadData, floorLabel]);

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
      allOnFloor = vehicles.filter(v => v.status !== 'OFFLINE');
    }
    if (allOnFloor.length === 0) {
      addLog('No vehicles available for fleet simulation.', 'WARN');
      return;
    }

    let fleetVehicles: Vehicle[] = [];

    // Prioritize the user's selected vehicle if available
    if (selectedVehicleId) {
      const selectedV = allOnFloor.find(v => v.id === selectedVehicleId);
      if (selectedV) {
        fleetVehicles.push(selectedV);
        allOnFloor = allOnFloor.filter(v => v.id !== selectedVehicleId);
      }
    }

    // Fill with up to 3 total vehicles for the fleet
    const availableOthers = allOnFloor.filter(v => v.status === 'AVAILABLE');
    fleetVehicles = [...fleetVehicles, ...availableOthers].slice(0, 3);

    if (fleetVehicles.length === 0) {
      fleetVehicles = allOnFloor.slice(0, 3);
      if (fleetVehicles.length === 0) return;
    }

    const claimedTaskIds: string[] = [];
    const claimedBoxIds: string[] = [];
    const newFleetRoutes: Record<string, { pts: RouteSegment[]; stepIndex: number }> = {};
    let startedCount = 0;

    fleetVehicles.forEach(v => {
      const assignment = ensureAssignedTask(v, claimedTaskIds, claimedBoxIds);
      if (!assignment) {
        addLog(`Could not assign task to ${v.vehicle_code}.`, 'WARN');
        return;
      }

      const { task, box } = assignment;
      claimedTaskIds.push(task.id);
      claimedBoxIds.push(box.id);

      const destLoc = locations.find((l) => l.id === task.destination_location_id);
      if (!destLoc) return;

      const otherVehs = vehicles.filter(ov => ov.id !== v.id);
      const pts = calculateRoute(
        v.current_floor_id, 
        v.x_position, 
        v.y_position, 
        destLoc.floor_id, 
        destLoc.x, 
        destLoc.y, 
        locations,
        12,
        8,
        obstacles,
        otherVehs
      );

      if (!pts || pts.length === 0) {
        addLog(`[${v.vehicle_code}] No route found to destination (${destLoc.name}).`, 'WARN');
        return;
      }

      newFleetRoutes[v.id] = { pts, stepIndex: 0 };
      addLog(`[${v.vehicle_code}] Dispatched on Task ${task.task_code} (Box ${box.box_code}) to ${destLoc.name} (${pts.length} steps).`, 'INFO');

      // 0 artificial obstacle probability (runs smoothly, stops only for real obstacles)
      const controller = new SimulatorVehicleController(v.id, 0);
      controller.setInitialVehicle(v);
      controller.setLocations(locations);
      controller.setOtherVehicles(otherVehs);
      controller.connect();
      controller.setSpeed(simSpeed);
      fleetControllersRef.current[v.id] = controller;
      
      supabase.from('vehicles').update({ status: 'BUSY' }).eq('id', v.id).then(() => {});
      supabase.from('tasks').update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() }).eq('id', task.id).then(() => {});
      supabase.from('boxes').update({ status: 'IN_TRANSIT' }).eq('id', box.id).then(() => {});

      const vCode = v.vehicle_code;
      const vId = v.id;

      controller.sendMoveCommand(
        pts,
        (x, y, floorId, index, totalSteps) => {
          const total = totalSteps || pts.length;
          // Step-by-step position update in real-time React state
          setVehicles(prev => prev.map(veh => 
            veh.id === vId 
              ? { ...veh, x_position: x, y_position: y, current_floor_id: floorId, status: 'BUSY' } 
              : veh
          ));

          // Real-time route step update for map visualization
          setFleetRoutes(prev => ({
            ...prev,
            [vId]: { pts: prev[vId]?.pts || pts, stepIndex: index }
          }));

          // If focused on this vehicle
          if (selectedVehicleIdRef.current === vId) {
            setSelectedFloor(floorId);
            setActiveStepIndex(index);
            setCurrentStepLabel(`[${vCode}] Step ${index + 1}/${total}: [X:${x}, Y:${y}] ${floorLabel(floorId)}`);
          }

          // Persist position
          supabase.from('vehicles').update({
            x_position: x,
            y_position: y,
            current_floor_id: floorId,
            status: 'BUSY'
          }).eq('id', vId).then(() => {});

          const curV = mockDb.getVehicles().find(item => item.id === vId);
          if (curV) {
            mockDb.saveVehicle({
              ...curV,
              x_position: x,
              y_position: y,
              current_floor_id: floorId,
              status: 'BUSY'
            });
          }

          // Step-by-step activity log
          addLog(`[${vCode}] Step ${index + 1}/${total}: Moving to [X:${x}, Y:${y}] on ${floorLabel(floorId)}`, 'INFO');
        },
        async () => {
          addLog(`✓ ${vCode} arrived at destination (${destLoc.name}).`, 'SUCCESS');

          setVehicles(prev => prev.map(veh => 
            veh.id === vId 
              ? { ...veh, status: 'AVAILABLE', current_task_id: null, current_location_id: destLoc.id, x_position: destLoc.x, y_position: destLoc.y, current_floor_id: destLoc.floor_id } 
              : veh
          ));

          await Promise.all([
            supabase.from('tasks').update({ status: 'PICKUP_PENDING' }).eq('id', task.id),
            supabase.from('boxes').update({ status: 'PICKUP_PENDING', current_location_id: destLoc.id }).eq('id', box.id),
            supabase.from('vehicles').update({ 
              status: 'AVAILABLE', 
              current_task_id: null, 
              current_location_id: destLoc.id, 
              x_position: destLoc.x, 
              y_position: destLoc.y, 
              current_floor_id: destLoc.floor_id 
            }).eq('id', vId)
          ]);

          const curV = mockDb.getVehicles().find(x => x.id === vId);
          if (curV) {
            mockDb.saveVehicle({
              ...curV,
              status: 'AVAILABLE',
              current_task_id: null,
              current_location_id: destLoc.id,
              x_position: destLoc.x,
              y_position: destLoc.y,
              current_floor_id: destLoc.floor_id
            });
          }

          delete fleetControllersRef.current[vId];
          if (Object.keys(fleetControllersRef.current).length === 0) {
            setIsSimulatingAll(false);
            setCurrentStepLabel('All fleet vehicles reached destinations.');
            addLog('All fleet vehicles completed their delivery cycles.', 'SUCCESS');
            await loadData();
          }
        },
        {
          onObstacleWait: (obsX, obsY, obsFloor, waitSec) => {
            if (selectedVehicleIdRef.current === vId) {
              setCurrentStepLabel(`[${vCode}] Obstacle detected at [${obsX}, ${obsY}]. Halting and waiting ${waitSec}s...`);
            }
            addLog(`[${vCode}] Obstacle detected at [${obsX}, ${obsY}]. Halting vehicle. Waiting ${waitSec} seconds for clearance...`, 'WARN');

            // Fleet Inter-Vehicle Sensor Coordination:
            // Warn other AMRs in sensor range of this AMR or whose path intersects the obstacle!
            const curVeh = mockDb.getVehicles().find(veh => veh.id === vId);
            const curX = curVeh ? curVeh.x_position : v.x_position;
            const curY = curVeh ? curVeh.y_position : v.y_position;

            Object.entries(fleetControllersRef.current).forEach(([otherId, otherCtrl]) => {
              if (otherId === vId) return;
              const otherVeh = mockDb.getVehicles().find(veh => veh.id === otherId);
              if (!otherVeh || otherVeh.current_floor_id !== obsFloor) return;

              const dist = Math.max(Math.abs(otherVeh.x_position - curX), Math.abs(otherVeh.y_position - curY));
              const otherCode = otherVeh.vehicle_code;
              const inSensorRange = dist <= 3;

              const alertResult = otherCtrl.handleFleetObstacleAlert(obsX, obsY, obsFloor, vCode, curX, curY);

              if (alertResult.action === 'REROUTED') {
                addLog(`[COORDINATION] 📡 ${otherCode} (in sensor range of ${vCode}, dist: ${dist} cells) detected obstacle at [${obsX}, ${obsY}] on its path! Preemptively rerouting...`, 'WARN');
                if (alertResult.newRoute) {
                  setFleetRoutes(prev => ({
                    ...prev,
                    [otherId]: { pts: alertResult.newRoute!, stepIndex: 0 }
                  }));
                }
              } else if (alertResult.action === 'HALTED_YIELD') {
                addLog(`[COORDINATION] 🛑 ${otherCode} (in sensor range of ${vCode}, dist: ${dist} cells) halted safely to yield and maintain safety distance.`, 'WARN');
              } else if (inSensorRange) {
                addLog(`[COORDINATION] 📡 ${otherCode} received sensor proximity alert of obstacle at [${obsX}, ${obsY}] from ${vCode} (dist: ${dist} cells — path clear).`, 'INFO');
              }
            });

            setObstacles(fleetCoordinator.getGlobalObstacles());
            setFleetMetrics(fleetCoordinator.getMetrics());
          },
          onObstacleCleared: (obsX, obsY, obsFloor) => {
            if (selectedVehicleIdRef.current === vId) {
              setCurrentStepLabel(`[${vCode}] Obstacle cleared at [${obsX}, ${obsY}]. Resuming drive...`);
            }
            addLog(`[${vCode}] Obstacle at [${obsX}, ${obsY}] cleared within 3s. Resuming original route.`, 'SUCCESS');

            // Notify yielding AMRs that obstacle is cleared so they can resume
            Object.entries(fleetControllersRef.current).forEach(([otherId, otherCtrl]) => {
              if (otherId === vId) return;
              otherCtrl.notifyObstacleChanged();
            });
            setObstacles(fleetCoordinator.getGlobalObstacles());
            setFleetMetrics(fleetCoordinator.getMetrics());
          },
          onObstaclePersisted: (obsX, obsY, obsFloor) => {
            if (selectedVehicleIdRef.current === vId) {
              setCurrentStepLabel(`[${vCode}] Obstacle still present at [${obsX}, ${obsY}]. Recalculating route...`);
            }
            addLog(`[${vCode}] Obstacle still present at [${obsX}, ${obsY}] after 3 seconds. Rerouting around obstacle...`, 'WARN');
          },
          onReroute: (newRoute) => {
            setFleetRoutes(prev => ({
              ...prev,
              [vId]: { pts: newRoute, stepIndex: 0 }
            }));
            if (selectedVehicleIdRef.current === vId) {
              setActiveRoutePts(newRoute);
              setActiveStepIndex(0);
              setCurrentStepLabel(`[${vCode}] Rerouted: Step 1/${newRoute.length}`);
            }
            addLog(`[${vCode}] Recalculated new route (${newRoute.length} steps). Resuming drive.`, 'INFO');

            // Resume any yielding vehicle
            Object.entries(fleetControllersRef.current).forEach(([otherId, otherCtrl]) => {
              if (otherId === vId) return;
              otherCtrl.notifyObstacleChanged();
            });
            setObstacles(fleetCoordinator.getGlobalObstacles());
            setFleetMetrics(fleetCoordinator.getMetrics());
          },
          onRerouteFailed: (obsX, obsY, obsFloor) => {
            if (selectedVehicleIdRef.current === vId) {
              setCurrentStepLabel(`[${vCode}] Path completely blocked at [${obsX}, ${obsY}]. Halting safely.`);
            }
            addLog(`[${vCode}] Path completely blocked at [${obsX}, ${obsY}]. No alternative route found. AMR halted safely.`, 'ERROR');
          },
          onElevatorEnter: (fromFloor, x, y) => {
            addLog(`[${vCode}] Arrived at Elevator at [${x}, ${y}] on ${floorLabel(fromFloor)}. Boarding elevator...`, 'INFO');
          },
          onElevatorExit: (toFloor, x, y) => {
            if (selectedVehicleIdRef.current === vId) {
              setSelectedFloor(toFloor);
            }
            addLog(`[${vCode}] Exited elevator on ${floorLabel(toFloor)} at [${x}, ${y}]. Continuing drive...`, 'INFO');
          }
        }
      );
      startedCount++;
    });

    if (startedCount > 0) {
      setFleetRoutes(newFleetRoutes);
      setIsSimulatingAll(true);
      setCurrentStepLabel(`Fleet simulation running: ${startedCount} AMRs actively driving.`);
    }
  };

  const startFleetOutAll = () => {
    if (isSimulatingAll) return;
    if (isSimulating) {
      addLog('Stop single vehicle simulation before starting fleet mode.', 'WARN');
      return;
    }

    const outLoc = locations.find((l) => l.floor_id === selectedFloor && l.type === 'DELIVERY') || 
                   locations.find((l) => l.type === 'DELIVERY') ||
                   locations.find((l) => l.name.toUpperCase().includes('OUT'));
    if (!outLoc) {
      addLog('No Outbound / Delivery dock location found in warehouse map.', 'WARN');
      return;
    }

    addLog(`Dispatching fleet to Outbound Dock (${outLoc.name})...`, 'INFO');

    let allOnFloor = vehicles.filter(v => v.current_floor_id === selectedFloor && v.status !== 'OFFLINE');
    if (allOnFloor.length === 0) allOnFloor = vehicles.filter(v => v.status !== 'OFFLINE');
    const available = allOnFloor.filter(v => !(v.x_position === outLoc.x && v.y_position === outLoc.y && v.current_floor_id === outLoc.floor_id)).slice(0, 3);

    if (available.length === 0) {
      addLog('All available vehicles are already at Outbound Dock.', 'INFO');
      return;
    }

    const newFleetRoutes: Record<string, { pts: RouteSegment[]; stepIndex: number }> = {};
    let startedCount = 0;

    available.forEach((v) => {
      const otherVehs = vehicles.filter(ov => ov.id !== v.id);
      const pts = calculateRoute(
        v.current_floor_id,
        v.x_position,
        v.y_position,
        outLoc.floor_id,
        outLoc.x,
        outLoc.y,
        locations,
        12,
        8,
        obstacles,
        otherVehs
      );

      if (!pts || pts.length === 0) {
        addLog(`[${v.vehicle_code}] No route found to Outbound Dock.`, 'WARN');
        return;
      }

      newFleetRoutes[v.id] = { pts, stepIndex: 0 };
      addLog(`[${v.vehicle_code}] Dispatched to Outbound Dock (${pts.length} steps).`, 'INFO');

      const controller = new SimulatorVehicleController(v.id, 0);
      controller.setInitialVehicle(v);
      controller.setLocations(locations);
      controller.setOtherVehicles(otherVehs);
      controller.connect();
      controller.setSpeed(simSpeed);
      fleetControllersRef.current[v.id] = controller;

      supabase.from('vehicles').update({ status: 'BUSY' }).eq('id', v.id).then(() => {});

      const vCode = v.vehicle_code;
      const vId = v.id;

      controller.sendMoveCommand(
        pts,
        (x, y, floorId, index, totalSteps) => {
          const total = totalSteps || pts.length;
          setVehicles(prev => prev.map(veh => 
            veh.id === vId 
              ? { ...veh, x_position: x, y_position: y, current_floor_id: floorId, status: 'BUSY' } 
              : veh
          ));

          setFleetRoutes(prev => ({
            ...prev,
            [vId]: { pts: prev[vId]?.pts || pts, stepIndex: index }
          }));

          if (selectedVehicleIdRef.current === vId) {
            setSelectedFloor(floorId);
            setActiveStepIndex(index);
            setCurrentStepLabel(`[${vCode}] Navigating to Out: Step ${index + 1}/${total} [X:${x}, Y:${y}]`);
          }

          supabase.from('vehicles').update({
            x_position: x,
            y_position: y,
            current_floor_id: floorId,
            status: 'BUSY'
          }).eq('id', vId).then(() => {});

          const curV = mockDb.getVehicles().find(item => item.id === vId);
          if (curV) {
            mockDb.saveVehicle({
              ...curV,
              x_position: x,
              y_position: y,
              current_floor_id: floorId,
              status: 'BUSY'
            });
          }

          addLog(`[${vCode}] Step ${index + 1}/${total}: Moving to [X:${x}, Y:${y}] on ${floorLabel(floorId)}`, 'INFO');
        },
        async () => {
          addLog(`✓ ${vCode} arrived at Outbound Dock (${outLoc.name}).`, 'SUCCESS');

          setVehicles(prev => prev.map(veh => 
            veh.id === vId 
              ? { ...veh, status: 'AVAILABLE', current_task_id: null, current_location_id: outLoc.id, x_position: outLoc.x, y_position: outLoc.y, current_floor_id: outLoc.floor_id } 
              : veh
          ));

          await supabase.from('vehicles').update({ 
            status: 'AVAILABLE', 
            current_task_id: null, 
            current_location_id: outLoc.id, 
            x_position: outLoc.x, 
            y_position: outLoc.y, 
            current_floor_id: outLoc.floor_id 
          }).eq('id', vId);

          const curV = mockDb.getVehicles().find(x => x.id === vId);
          if (curV) {
            mockDb.saveVehicle({
              ...curV,
              status: 'AVAILABLE',
              current_task_id: null,
              current_location_id: outLoc.id,
              x_position: outLoc.x,
              y_position: outLoc.y,
              current_floor_id: outLoc.floor_id
            });
          }

          delete fleetControllersRef.current[vId];
          if (Object.keys(fleetControllersRef.current).length === 0) {
            setIsSimulatingAll(false);
            setCurrentStepLabel('All fleet vehicles reached Outbound Dock.');
            addLog('All fleet vehicles reached Outbound Dock successfully.', 'SUCCESS');
            await loadData();
          }
        },
        {
          onObstacleWait: (obsX, obsY, obsFloor, waitSec) => {
            if (selectedVehicleIdRef.current === vId) {
              setCurrentStepLabel(`[${vCode}] Obstacle detected at [${obsX}, ${obsY}]. Halting and waiting ${waitSec}s...`);
            }
            addLog(`[${vCode}] Obstacle detected at [${obsX}, ${obsY}]. Halting vehicle. Waiting ${waitSec} seconds for clearance...`, 'WARN');

            // Fleet Inter-Vehicle Sensor Coordination:
            // Warn other AMRs in sensor range of this AMR or whose path intersects the obstacle!
            const curVeh = mockDb.getVehicles().find(veh => veh.id === vId);
            const curX = curVeh ? curVeh.x_position : v.x_position;
            const curY = curVeh ? curVeh.y_position : v.y_position;

            Object.entries(fleetControllersRef.current).forEach(([otherId, otherCtrl]) => {
              if (otherId === vId) return;
              const otherVeh = mockDb.getVehicles().find(veh => veh.id === otherId);
              if (!otherVeh || otherVeh.current_floor_id !== obsFloor) return;

              const dist = Math.max(Math.abs(otherVeh.x_position - curX), Math.abs(otherVeh.y_position - curY));
              const otherCode = otherVeh.vehicle_code;
              const inSensorRange = dist <= 3;

              const alertResult = otherCtrl.handleFleetObstacleAlert(obsX, obsY, obsFloor, vCode, curX, curY);

              if (alertResult.action === 'REROUTED') {
                addLog(`[COORDINATION] 📡 ${otherCode} (in sensor range of ${vCode}, dist: ${dist} cells) detected obstacle at [${obsX}, ${obsY}] on its path! Preemptively rerouting...`, 'WARN');
                if (alertResult.newRoute) {
                  setFleetRoutes(prev => ({
                    ...prev,
                    [otherId]: { pts: alertResult.newRoute!, stepIndex: 0 }
                  }));
                }
              } else if (alertResult.action === 'HALTED_YIELD') {
                addLog(`[COORDINATION] 🛑 ${otherCode} (in sensor range of ${vCode}, dist: ${dist} cells) halted safely to yield and maintain safety distance.`, 'WARN');
              } else if (inSensorRange) {
                addLog(`[COORDINATION] 📡 ${otherCode} received sensor proximity alert of obstacle at [${obsX}, ${obsY}] from ${vCode} (dist: ${dist} cells — path clear).`, 'INFO');
              }
            });

            setObstacles(fleetCoordinator.getGlobalObstacles());
            setFleetMetrics(fleetCoordinator.getMetrics());
          },
          onObstacleCleared: (obsX, obsY, obsFloor) => {
            if (selectedVehicleIdRef.current === vId) {
              setCurrentStepLabel(`[${vCode}] Obstacle cleared at [${obsX}, ${obsY}]. Resuming drive...`);
            }
            addLog(`[${vCode}] Obstacle at [${obsX}, ${obsY}] cleared within 3s. Resuming original route.`, 'SUCCESS');

            // Notify yielding AMRs that obstacle is cleared so they can resume
            Object.entries(fleetControllersRef.current).forEach(([otherId, otherCtrl]) => {
              if (otherId === vId) return;
              otherCtrl.notifyObstacleChanged();
            });
            setObstacles(fleetCoordinator.getGlobalObstacles());
            setFleetMetrics(fleetCoordinator.getMetrics());
          },
          onObstaclePersisted: (obsX, obsY, obsFloor) => {
            if (selectedVehicleIdRef.current === vId) {
              setCurrentStepLabel(`[${vCode}] Obstacle still present at [${obsX}, ${obsY}]. Recalculating route...`);
            }
            addLog(`[${vCode}] Obstacle still present at [${obsX}, ${obsY}] after 3 seconds. Rerouting around obstacle...`, 'WARN');
          },
          onReroute: (newRoute) => {
            setFleetRoutes(prev => ({
              ...prev,
              [vId]: { pts: newRoute, stepIndex: 0 }
            }));
            if (selectedVehicleIdRef.current === vId) {
              setActiveRoutePts(newRoute);
              setActiveStepIndex(0);
              setCurrentStepLabel(`[${vCode}] Rerouted: Step 1/${newRoute.length}`);
            }
            addLog(`[${vCode}] Recalculated new route (${newRoute.length} steps). Resuming drive.`, 'INFO');

            // Resume any yielding vehicle
            Object.entries(fleetControllersRef.current).forEach(([otherId, otherCtrl]) => {
              if (otherId === vId) return;
              otherCtrl.notifyObstacleChanged();
            });
            setObstacles(fleetCoordinator.getGlobalObstacles());
            setFleetMetrics(fleetCoordinator.getMetrics());
          },
          onRerouteFailed: (obsX, obsY, obsFloor) => {
            if (selectedVehicleIdRef.current === vId) {
              setCurrentStepLabel(`[${vCode}] Path completely blocked at [${obsX}, ${obsY}]. Halting safely.`);
            }
            addLog(`[${vCode}] Path completely blocked at [${obsX}, ${obsY}]. No alternative route found. AMR halted safely.`, 'ERROR');
          },
          onElevatorEnter: (fromFloor, x, y) => {
            addLog(`[${vCode}] Arrived at Elevator at [${x}, ${y}] on ${floorLabel(fromFloor)}. Boarding elevator...`, 'INFO');
          },
          onElevatorExit: (toFloor, x, y) => {
            if (selectedVehicleIdRef.current === vId) {
              setSelectedFloor(toFloor);
            }
            addLog(`[${vCode}] Exited elevator on ${floorLabel(toFloor)} at [${x}, ${y}]. Continuing drive...`, 'INFO');
          }
        }
      );
      startedCount++;
    });

    if (startedCount > 0) {
      setFleetRoutes(newFleetRoutes);
      setIsSimulatingAll(true);
      setCurrentStepLabel(`Dispatching ${startedCount} fleet AMRs to Outbound Dock.`);
    }
  };

  const stopFleetAll = () => {
    Object.values(fleetControllersRef.current).forEach(c => c.stop());
    fleetControllersRef.current = {};
    setFleetRoutes({});
    setIsSimulatingAll(false);
    setCurrentStepLabel('Fleet simulation stopped.');
    vehicles.forEach(v => {
      if (v.status === 'BUSY') {
        supabase.from('vehicles').update({ 
          status: 'AVAILABLE',
          x_position: v.x_position,
          y_position: v.y_position,
          current_floor_id: v.current_floor_id
        }).eq('id', v.id).then(() => {});
        mockDb.saveVehicle({ ...v, status: 'AVAILABLE' });
      }
    });
    setVehicles(prev => prev.map(v => v.status === 'BUSY' ? { ...v, status: 'AVAILABLE' } : v));
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
              
              <div className="flex flex-wrap items-center justify-between border-b border-slate-900 pb-3 gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {warehouses.length > 1 && (
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => {
                        const newWid = e.target.value;
                        setSelectedWarehouseId(newWid);
                        const whF = floors.filter(f => f.warehouse_id === newWid);
                        setSelectedFloor(whF.length > 0 ? whF[0].id : '');
                      }}
                      className="bg-slate-900 text-xs font-bold text-slate-200 px-3 py-1.5 rounded-xl border border-slate-800 outline-none cursor-pointer mr-2"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id} className="bg-slate-900 text-slate-200">
                          {w.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Floor View:</span>
                  {(() => {
                    const whFloors = floors.filter(
                      f => !selectedWarehouseId || f.warehouse_id === selectedWarehouseId
                    );
                    if (whFloors.length === 0) {
                      return <span className="text-xs text-slate-500 italic">No levels configured</span>;
                    }
                    return whFloors.map((f, idx) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFloor(f.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                          selectedFloor === f.id ? 'bg-blue-600 text-slate-50 shadow-md' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {f.name || `Floor ${f.floor_number || idx + 1}`}
                      </button>
                    ));
                  })()}
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
                  warehouseName={warehouses.find(w => w.id === (floors.find(f => f.id === selectedFloor)?.warehouse_id || selectedWarehouseId))?.name}
                  selectedVehicle={selectedVehicle}
                  activeRoute={
                    simMode === 'SINGLE'
                      ? activeRoutePts
                      : (selectedVehicleId && fleetRoutes[selectedVehicleId]
                          ? fleetRoutes[selectedVehicleId].pts
                          : null)
                  }
                  activeStepIndex={
                    simMode === 'SINGLE'
                      ? activeStepIndex
                      : (selectedVehicleId && fleetRoutes[selectedVehicleId]
                          ? fleetRoutes[selectedVehicleId].stepIndex
                          : undefined)
                  }
                  vehicles={vehicles}
                  locations={locations}
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
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-900">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-purple-400 font-mono tracking-widest">
                          Fleet Drive Console
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${isSimulatingAll ? 'bg-green-950 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                          {isSimulatingAll ? `RUNNING (${Object.keys(fleetControllersRef.current).length} ACTIVE)` : 'IDLE'}
                        </span>
                        {selectedVehicle && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-purple-950 text-purple-400">
                            FOCUSED: {selectedVehicle.vehicle_code}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 font-bold mt-1">{currentStepLabel}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Live Speed Multiplier Selector for Fleet */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                        <Gauge className="h-3 w-3 text-purple-400 ml-1.5 mr-0.5" />
                        {[1, 2, 5, 10].map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setSimSpeed(s);
                              Object.values(fleetControllersRef.current).forEach(c => c.setSpeed(s));
                            }}
                            title={`Set Fleet AMR Speed to ${s}x`}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                              simSpeed === s
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>

                      {!isSimulatingAll ? (
                        <button onClick={startFleetAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition shadow-md shadow-purple-600/20">
                          <Play className="h-3.5 w-3.5" /> Start Fleet Drive
                        </button>
                      ) : (
                        <button onClick={stopFleetAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/40 border border-red-900/40 text-red-400 text-xs font-bold hover:bg-red-900/60 transition">
                          <RotateCcw className="h-3.5 w-3.5" /> Stop Fleet
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
                      {/* Live Speed Multiplier Selector */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                        <Gauge className="h-3 w-3 text-blue-400 ml-1.5 mr-0.5" />
                        {[1, 2, 5, 10].map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setSimSpeed(s);
                              if (simControllerRef.current) {
                                simControllerRef.current.setSpeed(s);
                              }
                              Object.values(fleetControllersRef.current).forEach(c => c.setSpeed(s));
                            }}
                            title={`Set AMR Speed to ${s}x`}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                              simSpeed === s
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>

                      {!isSimulating && !isPaused ? (
                        <>
                          <button onClick={handleStartSimulation} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-slate-50 transition-all">
                            <Play className="h-3.5 w-3.5" /> Start Drive
                          </button>
                          <button onClick={handleStartOut} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-950/40 border border-orange-700/60 text-orange-400 text-xs font-bold hover:bg-orange-900/50 transition shadow-sm">
                            <ArrowUpRight className="h-3.5 w-3.5" /> Out
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
                  {(() => {
                    const isFirstWarehouse = warehouses.length > 0 && selectedWarehouseId === warehouses[0].id;
                    const whFloors = floors.filter(f => f.warehouse_id === selectedWarehouseId);
                    const whFloorIds = new Set(whFloors.map(f => f.id));
                    const facilityVehicles = vehicles.filter(v => 
                      !selectedWarehouseId ||
                      (v.current_floor_id && whFloorIds.has(v.current_floor_id)) || 
                      (!v.current_floor_id && isFirstWarehouse)
                    );

                    if (facilityVehicles.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 italic p-3 text-center">
                          No AMRs found in this facility.
                        </p>
                      );
                    }

                    return facilityVehicles.map((v) => (
                      <button
                        key={v.id}
                        disabled={v.status === 'OFFLINE'}
                        onClick={() => handleSelectVehicle(v)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                          v.status === 'OFFLINE' ? 'opacity-30 cursor-not-allowed' : ''
                        } ${
                          selectedVehicleId === v.id
                            ? (simMode === 'FLEET'
                                ? 'border-purple-500 bg-purple-600/10 text-slate-100 shadow-lg ring-1 ring-purple-500/50'
                                : 'border-blue-500 bg-blue-600/10 text-slate-100 shadow-lg ring-1 ring-blue-500/50')
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
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
