'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Location, Vehicle, RouteSegment } from '@/lib/database.types';

interface WarehouseMapProps {
  floorId: string;
  selectedVehicle?: Vehicle | null;
  activeRoute?: RouteSegment[] | null;
  onGridClick?: (x: number, y: number) => void;
}

export default function WarehouseMap({ floorId, selectedVehicle, activeRoute, onGridClick }: WarehouseMapProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    const loadMapElements = () => {
      const locs = supabase.from('locations').select().eq('floor_id', floorId).data || [];
      setLocations(locs as Location[]);

      const vehs = supabase.from('vehicles').select().data || [];
      setVehicles(vehs.filter(v => v.current_floor_id === floorId) as Vehicle[]);
    };

    loadMapElements();
    const interval = setInterval(loadMapElements, 1000);
    return () => clearInterval(interval);
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
      // Vehicle takes precedence visually
      grid[veh.y_position][veh.x_position] = { type: 'vehicle', data: veh };
    }
  });

  // Check if coordinate is in the active route
  const getRouteIndex = (x: number, y: number) => {
    if (!activeRoute) return -1;
    return activeRoute.findIndex(pt => pt.x === x && pt.y === y && pt.floor_id === floorId);
  };

  return (
    <div className="rounded-xl border border-slate-900 bg-slate-950 p-4 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Warehouse Digital Twin Layout</span>
        <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-500/20 border border-blue-500"></span><span className="text-slate-400">Rack</span></div>
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-500/20 border border-green-500"></span><span className="text-slate-400">Pickup</span></div>
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-purple-500/20 border border-purple-500"></span><span className="text-slate-400">Elevator</span></div>
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-600 border border-slate-500"></span><span className="text-slate-400">Cart</span></div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-12 gap-1.5 min-w-[640px]">
          {grid.map((row, y) =>
            row.map((cell, x) => {
              const routeIdx = getRouteIndex(x, y);
              const hasRoute = routeIdx !== -1;
              const isSelectedVehicleCoord = selectedVehicle && selectedVehicle.x_position === x && selectedVehicle.y_position === y && selectedVehicle.current_floor_id === floorId;

              let cellColor = 'bg-slate-900/30 border border-slate-900 hover:border-slate-800';
              let text = '';
              let cellLabel = `${x},${y}`;

              if (cell) {
                if (cell.type === 'location') {
                  const loc = cell.data as Location;
                  cellLabel = loc.name;
                  if (loc.type === 'RACK') {
                    cellColor = 'bg-blue-900/10 border border-blue-900/50 hover:bg-blue-900/25';
                    text = 'R';
                  } else if (loc.type === 'PICKUP') {
                    cellColor = 'bg-green-950/20 border border-green-900/60 text-green-400';
                    text = 'IN';
                  } else if (loc.type === 'DELIVERY') {
                    cellColor = 'bg-red-950/20 border border-red-900/60 text-red-400';
                    text = 'OUT';
                  } else if (loc.type === 'ELEVATOR') {
                    cellColor = 'bg-purple-950/20 border border-purple-900/60 text-purple-400';
                    text = 'EL';
                  } else if (loc.type === 'CHARGING') {
                    cellColor = 'bg-yellow-950/20 border border-yellow-900/60 text-yellow-500';
                    text = '⚡';
                  }
                } else if (cell.type === 'vehicle') {
                  const veh = cell.data as Vehicle;
                  cellLabel = `${veh.vehicle_code} (${veh.status})`;
                  cellColor = isSelectedVehicleCoord 
                    ? 'bg-blue-500 border border-slate-100 text-slate-950 font-bold scale-105 shadow-lg shadow-blue-500/30' 
                    : 'bg-blue-600 border border-slate-500 text-slate-100 font-semibold';
                  text = veh.vehicle_code.substring(5); // e.g. '01'
                }
              }

              return (
                <button
                  key={`${x}-${y}`}
                  onClick={() => onGridClick?.(x, y)}
                  title={cellLabel}
                  className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all duration-150 active:scale-95 ${cellColor}`}
                >
                  {text || <span className="text-[8px] text-slate-700 font-normal">{x},{y}</span>}
                  
                  {/* Route marker overlay */}
                  {hasRoute && cell?.type !== 'vehicle' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-blue-500/20 border-2 border-blue-500 rounded-lg animate-pulse">
                      <span className="text-[8px] text-blue-300 font-mono font-black">{routeIdx}</span>
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
