'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Location, Vehicle, RouteSegment, EdgeAIDecision, FleetMessage } from '@/lib/database.types';
import { ObstacleCell } from '@/lib/simulator/edgeAIEngine';
import { Bot, Zap, ArrowUpRight, AlertTriangle } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface WarehouseMapProps {
  floorId: string;
  selectedVehicle?: Vehicle | null;
  activeRoute?: RouteSegment[] | null;
  onGridClick?: (x: number, y: number) => void;
  obstacles?: ObstacleCell[];
  showSensorRange?: boolean;
  edgeDecisions?: EdgeAIDecision[];
  fleetMessages?: FleetMessage[];
}

export default function WarehouseMap({ floorId, selectedVehicle, activeRoute, onGridClick, obstacles = [], showSensorRange = false, edgeDecisions = [], fleetMessages = [] }: WarehouseMapProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadMapElements = async () => {
      try {
        let activeFloorId = floorId;

        // If floorId is not provided or set to mock fallback, find the first real floor
        if (!activeFloorId || activeFloorId === 'f-01') {
          const fRes = await supabase.from('floors').select();
          const fls = fRes.data || [];
          if (fls.length > 0) {
            activeFloorId = fls[0].id;
          }
        }

        if (!activeFloorId) return;

        const locRes = await supabase.from('locations').select().eq('floor_id', activeFloorId);
        if (isMounted && locRes.data) {
          setLocations(locRes.data as Location[]);
        }

        const vehRes = await supabase.from('vehicles').select();
        if (isMounted && vehRes.data) {
          const vehs = (vehRes.data || []) as Vehicle[];
          setVehicles(vehs.filter((v: any) => v.current_floor_id === activeFloorId));
        }
      } catch (err) {
        console.error('Failed to load map coordinates and vehicles:', err);
      }
    };

    loadMapElements();
    const interval = setInterval(loadMapElements, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [floorId]);

  const gridWidth = 12;
  const gridHeight = 8;

  // Build 2D grid matrix representation
  const grid: any[][] = Array.from({ length: gridHeight }, () =>
    Array.from({ length: gridWidth }, () => null)
  );

  // Map items to coordinates
  locations.forEach(loc => {
    if (loc.x >= 0 && loc.x < gridWidth && loc.y >= 0 && loc.y < gridHeight) {
      grid[loc.y][loc.x] = { type: 'location', data: loc };
    }
  });

  vehicles.forEach(veh => {
    if (veh.x_position >= 0 && veh.x_position < gridWidth && veh.y_position >= 0 && veh.y_position < gridHeight) {
      const existing = grid[veh.y_position][veh.x_position];
      const existingLoc = existing?.type === 'location' ? (existing.data as Location) : undefined;
      grid[veh.y_position][veh.x_position] = { type: 'vehicle', data: veh, location: existingLoc };
    }
  });

  const getRouteIndex = (x: number, y: number) => {
    if (!activeRoute) return -1;
    return activeRoute.findIndex(pt => pt.x === x && pt.y === y && pt.floor_id === floorId);
  };

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-4 sm:p-6 shadow-2xl space-y-4 overflow-hidden">
        {/* Cyber Blueprint Grid Background Effect */}
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Warehouse Digital Twin Layout</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs">
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-500/20 border border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]"></span><span className="text-slate-400 font-medium">Rack</span></div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500/20 border border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></span><span className="text-slate-400 font-medium">Pickup</span></div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-orange-500/20 border border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]"></span><span className="text-slate-400 font-medium">Out</span></div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-purple-500/20 border border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]"></span><span className="text-slate-400 font-medium">Elevator</span></div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-500/20 border border-amber-500 text-[9px] flex items-center justify-center text-amber-400">⚡</span><span className="text-slate-400 font-medium">Charging</span></div>
            <div className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-lg bg-cyan-600 border border-slate-400 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.4)]"><Bot size={10} className="text-slate-100" /></span><span className="text-slate-400 font-medium">AMR</span></div>
            <div className="flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-800"><span className="h-3 w-3 rounded bg-red-950 border border-red-500 text-red-500 text-[8px] flex items-center justify-center font-bold">⚠</span><span className="text-slate-400 font-medium">Obstacle</span></div>
          </div>
        </div>

        <div className="overflow-x-auto relative z-10">
          <div className="grid grid-cols-12 gap-2 min-w-[640px] p-1">
            {grid.map((row, y) =>
              row.map((cell, x) => {
                const routeIdx = getRouteIndex(x, y);
                const hasRoute = routeIdx !== -1;
                const isSelectedVehicleCoord = selectedVehicle && selectedVehicle.x_position === x && selectedVehicle.y_position === y && selectedVehicle.current_floor_id === floorId;

                let cellColor = 'bg-slate-900/40 border border-slate-800/60 hover:border-cyan-500/40 hover:bg-slate-800/40';
                let text = '';
                let cellLabel = `Coordinate [${x}, ${y}]`;
                
                const isObstacle = obstacles.find(o => o.x === x && o.y === y && o.floor_id === floorId);
                
                let isSensorRange = false;
                if (showSensorRange) {
                  for (const veh of vehicles) {
                    const dist = Math.max(Math.abs(veh.x_position - x), Math.abs(veh.y_position - y));
                    if (dist > 0 && dist <= 2) { isSensorRange = true; break; }
                  }
                }

                let vehicleBadge = null;

                if (cell) {
                  if (cell.type === 'location') {
                    const loc = cell.data as Location;
                    cellLabel = `${loc.name} (${loc.type})`;
                    if (loc.type === 'RACK') {
                      cellColor = 'bg-blue-950/30 border border-blue-800/60 text-blue-300 hover:bg-blue-900/40 shadow-inner';
                      text = 'R';
                    } else if (loc.type === 'PICKUP') {
                      cellColor = 'bg-emerald-950/30 border border-emerald-800/60 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.1)]';
                      text = 'IN';
                    } else if (loc.type === 'DELIVERY') {
                      cellColor = 'bg-orange-950/30 border border-orange-800/60 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.1)]';
                      text = 'OUT';
                    } else if (loc.type === 'ELEVATOR') {
                      cellColor = 'bg-purple-900/40 border-2 border-purple-500/80 text-purple-300 font-extrabold shadow-[0_0_15px_rgba(168,85,247,0.25)]';
                      text = 'EL';
                    } else if (loc.type === 'CHARGING') {
                      cellColor = 'bg-amber-950/30 border border-amber-800/60 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.1)]';
                      text = '⚡';
                    }
                  } else if (cell.type === 'vehicle') {
                    const veh = cell.data as Vehicle;
                    const underLoc = cell.location as Location | undefined;
                    cellLabel = underLoc
                      ? `AMR: ${veh.vehicle_code} at ${underLoc.name} (${underLoc.type}) | Battery: ${veh.battery_percentage}% | Status: ${veh.status}`
                      : `AMR: ${veh.vehicle_code} | Battery: ${veh.battery_percentage}% | Status: ${veh.status}`;
                    
                    const recentDecision = [...edgeDecisions].reverse().find(d => d.vehicle_id === veh.id);
                    const isStopped = recentDecision?.decision_type === 'STOP' || recentDecision?.decision_type === 'EMERGENCY_STOP';
                    const isSlow = recentDecision?.decision_type === 'SLOW_DOWN';
                    
                    if (isSelectedVehicleCoord) {
                      cellColor = isStopped 
                        ? 'bg-red-500 border-2 border-white text-slate-950 font-bold scale-105 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                        : (isSlow ? 'bg-amber-500 border-2 border-white text-slate-950 font-bold scale-105 shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'bg-cyan-500 border-2 border-white text-slate-950 font-bold scale-105 shadow-[0_0_20px_rgba(6,182,212,0.5)]');
                    } else {
                      cellColor = isStopped 
                        ? 'bg-red-600 border border-red-400 text-slate-100 font-semibold shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                        : (isSlow ? 'bg-amber-600 border border-amber-400 text-slate-100 font-semibold shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-cyan-600 border border-cyan-400 text-slate-100 font-semibold shadow-[0_0_10px_rgba(6,182,212,0.3)]');
                    }
                    
                    text = '' as any;
                    vehicleBadge = (
                      <>
                        <Bot size={13} className={isStopped ? 'text-slate-900' : 'text-slate-100'} />
                        <span className={`text-[7px] font-black leading-none ${isStopped ? 'text-slate-900' : 'text-slate-100'}`}>
                          {veh.vehicle_code.substring(4)}
                        </span>
                        {underLoc && (
                          <span className="text-[6px] px-0.5 mt-0.5 rounded bg-slate-950/80 font-mono text-cyan-300">
                            {underLoc.type === 'PICKUP' ? 'IN' : (underLoc.type === 'DELIVERY' ? 'OUT' : (underLoc.type === 'RACK' ? 'RK' : '⚡'))}
                          </span>
                        )}
                        {recentDecision && (
                          <div className={`absolute -top-2.5 -right-2 px-1 rounded text-[8px] font-black z-20 shadow-md ${
                            isStopped ? 'bg-red-500 text-black animate-pulse' : (isSlow ? 'bg-amber-500 text-black' : 'bg-emerald-400 text-black')
                          }`}>
                            {isStopped ? 'STOP' : (isSlow ? 'SLOW' : 'OK')}
                          </div>
                        )}
                      </>
                    );
                  }
                }

                return (
                  <Tooltip.Root key={`${x}-${y}`}>
                    <Tooltip.Trigger asChild>
                      <button
                        onClick={() => onGridClick?.(x, y)}
                        className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-[10px] font-bold transition-all duration-200 active:scale-90 ${cellColor}`}
                      >
                        {/* Sensor range visualization layer */}
                        {isSensorRange && !cell && !isObstacle && (
                          <div className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/30 rounded-xl pointer-events-none animate-pulse" />
                        )}

                        {/* Obstacle overlay */}
                        {isObstacle && (
                          <div className="absolute inset-0 bg-red-950/90 border border-red-500 rounded-xl flex items-center justify-center z-10 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]">
                            <span className="text-red-400 font-bold text-xs">⚠</span>
                          </div>
                        )}

                        {vehicleBadge}

                        <span className="z-10">{text || <span className="text-[8px] text-slate-600 font-medium">{x},{y}</span>}</span>
                        
                        {/* Route marker overlay */}
                        {hasRoute && cell?.type !== 'vehicle' && (
                          <span className="absolute inset-0 flex items-center justify-center bg-cyan-500/25 border-2 border-cyan-400 rounded-xl animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                            <span className="text-[9px] text-cyan-200 font-mono font-extrabold">{routeIdx}</span>
                          </span>
                        )}
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="top"
                        sideOffset={5}
                        className="z-[100] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                      >
                        {cellLabel}
                        <Tooltip.Arrow className="fill-slate-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

