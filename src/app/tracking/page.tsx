'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import WarehouseMap from '@/components/WarehouseMap';
import { SimulatorVehicleController } from '@/lib/simulator/vehicleController';
import { calculateRoute } from '@/lib/algorithms/astar';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Truck, 
  Map, 
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { Vehicle, Task, Route, Location, Box } from '@/lib/database.types';

export default function TrackingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('f-01');

  // Simulator state variables
  const [activeRoutePts, setActiveRoutePts] = useState<any[]>([]);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simController, setSimController] = useState<SimulatorVehicleController | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepLabel, setCurrentStepLabel] = useState('Idle');

  const loadData = () => {
    const v = supabase.from('vehicles').select().data || [];
    setVehicles(v as Vehicle[]);

    const t = supabase.from('tasks').select().data || [];
    setTasks(t as Task[]);

    const l = supabase.from('locations').select().data || [];
    setLocations(l as Location[]);

    const b = supabase.from('boxes').select().data || [];
    setBoxes(b as Box[]);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectVehicle = (v: Vehicle) => {
    setSelectedVehicle(v);
    setSelectedFloor(v.current_floor_id);

    // Stop current simulation if any
    if (simController) {
      simController.stop();
      setSimController(null);
    }
    setIsSimulating(false);
    setIsPaused(false);
    setActiveRoutePts([]);
    setCurrentStepLabel('Idle');
  };

  // Run virtual navigation along computed coordinates
  const handleStartSimulation = () => {
    if (!selectedVehicle || !selectedVehicle.current_task_id) return;
    
    const task = tasks.find(t => t.id === selectedVehicle.current_task_id);
    if (!task) return;

    // Check if route coordinates already calculated
    const routesList = supabase.from('routes').select().eq('task_id', task.id).data || [];
    let pts: any[] = [];
    if (routesList.length > 0) {
      pts = (routesList[0] as Route).path_coordinates;
    } else {
      // Recalculate route coordinates
      const destLoc = locations.find(l => l.id === task.destination_location_id);
      if (!destLoc) return;
      pts = calculateRoute(
        selectedVehicle.current_floor_id,
        selectedVehicle.x_position,
        selectedVehicle.y_position,
        destLoc.floor_id,
        destLoc.x,
        destLoc.y,
        locations
      );
      
      // Save it
      supabase.from('routes').insert({
        id: `route-${Date.now()}`,
        task_id: task.id,
        path_coordinates: pts,
        created_at: new Date().toISOString()
      });
    }

    setActiveRoutePts(pts);

    // Instantiate vehicle simulator controller
    const controller = new SimulatorVehicleController(selectedVehicle.id);
    controller.connect();
    controller.setSpeed(simSpeed);
    setSimController(controller);
    setIsSimulating(true);
    setIsPaused(false);

    // Update task to in progress state
    supabase.from('tasks').update({
      status: 'IN_PROGRESS',
      started_at: new Date().toISOString()
    }).eq('id', task.id);

    // Update box status to transit
    supabase.from('boxes').update({
      status: 'IN_TRANSIT'
    }).eq('id', task.box_id);

    controller.sendMoveCommand(
      pts,
      (x, y, floorId, index) => {
        // Callback updates labels
        setSelectedFloor(floorId);
        const node = pts[index];
        if (node.action === 'ELEVATOR_ENTER') {
          setCurrentStepLabel('Entering Elevator A transition...');
        } else if (node.action === 'ELEVATOR_EXIT') {
          setCurrentStepLabel('Exited Elevator A, proceeding coordinates...');
        } else {
          setCurrentStepLabel(`Navigating coordinates grid [${x}, ${y}]`);
        }
      },
      () => {
        // Complete triggers scanner verification prompt
        setCurrentStepLabel('Arrived at Destination target. Pending scanner verification.');
        
        // Update task state to destination arrived pickup pending or delivery pending
        supabase.from('tasks').update({
          status: 'PICKUP_PENDING'
        }).eq('id', task.id);

        supabase.from('boxes').update({
          status: 'PICKUP_PENDING'
        }).eq('id', task.box_id);

        setIsSimulating(false);
      }
    );
  };

  const handlePauseResume = () => {
    if (!simController) return;
    if (isPaused) {
      simController.resume();
      setIsPaused(false);
    } else {
      simController.pause();
      setIsPaused(true);
    }
  };

  const handleResetSim = () => {
    if (simController) {
      simController.stop();
      setSimController(null);
    }
    setIsSimulating(false);
    setIsPaused(false);
    setActiveRoutePts([]);
    setCurrentStepLabel('Idle');
    loadData();
  };

  const handleSpeedChange = (mult: number) => {
    setSimSpeed(mult);
    if (simController) {
      simController.setSpeed(mult);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-grow flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-8 overflow-y-auto flex-1">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Live Fleet Tracking & Simulation</h1>
              <p className="text-sm text-slate-400">Track active paths coordinates, trigger simulator drives, and control playback speeds.</p>
            </div>
            {/* Speed control buttons */}
            <div className="flex gap-2.5">
              {[1, 2, 5, 10].map(mult => (
                <button
                  key={mult}
                  onClick={() => handleSpeedChange(mult)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    simSpeed === mult 
                      ? 'bg-blue-600 border-blue-500 text-slate-100 shadow-md shadow-blue-600/20' 
                      : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mult}x Speed
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Map and Sim Console */}
            <div className="lg:col-span-3 space-y-6">
              <WarehouseMap 
                floorId={selectedFloor} 
                selectedVehicle={selectedVehicle}
                activeRoute={activeRoutePts}
              />

              {/* Sim Controllers Board */}
              {selectedVehicle && selectedVehicle.current_task_id && (
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-blue-400 font-mono tracking-widest block">Drive Sim Console - {selectedVehicle.vehicle_code}</span>
                    <p className="text-sm text-slate-200 font-semibold">{currentStepLabel}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {!isSimulating && !isPaused ? (
                      <button
                        onClick={handleStartSimulation}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-505 text-xs font-bold text-slate-50 transition"
                      >
                        <Play className="h-4 w-4" /> Start Drive
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handlePauseResume}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 transition"
                        >
                          <Pause className="h-4 w-4" /> {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          onClick={handleResetSim}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-950/20 border border-red-900/30 text-xs font-bold text-red-400 transition"
                        >
                          <RotateCcw className="h-4 w-4" /> Reset
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Vehicle Panel Roster */}
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Operational Vehicle Status</span>
              <div className="space-y-3.5">
                {vehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVehicle(v)}
                    className={`w-full text-left p-3.5 rounded-xl border transition duration-150 ${
                      selectedVehicle?.id === v.id
                        ? 'border-blue-500 bg-blue-600/10 text-slate-100 shadow-md'
                        : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs">{v.vehicle_code}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        v.status === 'AVAILABLE' ? 'bg-green-950 text-green-400' : 'bg-blue-950 text-blue-400'
                      }`}>{v.status}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{v.name}</p>
                    {v.current_task_id && (
                      <span className="text-[9px] text-blue-400 font-semibold block mt-1.5">Task Assigned: {tasks.find(x => x.id === v.current_task_id)?.task_code}</span>
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
