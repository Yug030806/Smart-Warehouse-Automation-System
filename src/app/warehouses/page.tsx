'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { Plus, Edit2, Trash2, MapPin, Layers, Network } from 'lucide-react';
import { Warehouse, Floor, Location } from '@/lib/database.types';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  // Modals forms inputs
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [wName, setWName] = useState('');
  const [wAddress, setWAddress] = useState('');

  const [showAddFloor, setShowAddFloor] = useState(false);
  const [floorNum, setFloorNum] = useState(1);
  const [floorName, setFloorName] = useState('');

  const [showAddLoc, setShowAddLoc] = useState(false);
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState<'RACK' | 'PICKUP' | 'DELIVERY' | 'CHARGING' | 'ELEVATOR'>('RACK');
  const [locX, setLocX] = useState(0);
  const [locY, setLocY] = useState(0);

  const loadData = () => {
    const w = supabase.from('warehouses').select().data || [];
    setWarehouses(w as Warehouse[]);
    if (w.length > 0 && !selectedWarehouse) {
      setSelectedWarehouse(w[0] as Warehouse);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedWarehouse) {
      const f = supabase.from('floors').select().eq('warehouse_id', selectedWarehouse.id).data || [];
      setFloors(f as Floor[]);
      if (f.length > 0) {
        setSelectedFloor(f[0] as Floor);
      } else {
        setSelectedFloor(null);
      }
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    if (selectedFloor) {
      const l = supabase.from('locations').select().eq('floor_id', selectedFloor.id).data || [];
      setLocations(l as Location[]);
    } else {
      setLocations([]);
    }
  }, [selectedFloor]);

  const handleAddWarehouseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wName) return;
    const newW = {
      id: `w-${Date.now()}`,
      name: wName,
      address: wAddress,
      created_at: new Date().toISOString()
    };
    supabase.from('warehouses').insert(newW);
    setWName('');
    setWAddress('');
    setShowAddWarehouse(false);
    loadData();
  };

  const handleAddFloorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse || !floorName) return;
    const newF = {
      id: `f-${Date.now()}`,
      warehouse_id: selectedWarehouse.id,
      floor_number: Number(floorNum),
      name: floorName,
      grid_width: 12,
      grid_height: 8
    };
    supabase.from('floors').insert(newF);
    setFloorName('');
    setFloorNum(floors.length + 1);
    setShowAddFloor(false);
    
    // Refresh floors list manually
    const f = supabase.from('floors').select().eq('warehouse_id', selectedWarehouse.id).data || [];
    setFloors(f as Floor[]);
  };

  const handleAddLocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFloor || !locName) return;
    
    // Find zones under this floor or default to zone-1a
    const zones = supabase.from('zones').select().eq('floor_id', selectedFloor.id).data || [];
    const zoneId = zones.length > 0 ? zones[0].id : 'z-1a';

    const newLoc = {
      id: `loc-${Date.now()}`,
      zone_id: zoneId,
      name: locName,
      type: locType,
      x: Number(locX),
      y: Number(locY),
      floor_id: selectedFloor.id
    };
    supabase.from('locations').insert(newLoc);
    setLocName('');
    setLocX(0);
    setLocY(0);
    setShowAddLoc(false);

    // Refresh locations
    const l = supabase.from('locations').select().eq('floor_id', selectedFloor.id).data || [];
    setLocations(l as Location[]);
  };

  const handleDeleteLocation = (id: string) => {
    supabase.from('locations').delete().eq('id', id);
    if (selectedFloor) {
      const l = supabase.from('locations').select().eq('floor_id', selectedFloor.id).data || [];
      setLocations(l as Location[]);
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
              <h1 className="text-2xl font-bold text-slate-100">Warehouse Configurations</h1>
              <p className="text-sm text-slate-400">Configure logistics centers, layouts, levels, elevators and pickup lanes.</p>
            </div>
            <button 
              onClick={() => setShowAddWarehouse(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-slate-100 transition duration-150"
            >
              <Plus className="h-4 w-4" /> Add Logistics Center
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Warehouses list */}
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-bold">Logistics Facilities</span>
              <div className="space-y-2">
                {warehouses.map(w => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWarehouse(w)}
                    className={`w-full text-left p-3.5 rounded-xl border transition duration-150 ${
                      selectedWarehouse?.id === w.id
                        ? 'border-blue-500 bg-blue-600/10 text-slate-100'
                        : 'border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <span className="text-sm font-bold block">{w.name}</span>
                    <span className="text-[10px] block mt-1">{w.address || 'No Address'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Floors and coordinates grid configuration list */}
            <div className="lg:col-span-3 space-y-8">
              {selectedWarehouse && (
                <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-200">{selectedWarehouse.name} Levels</h3>
                      <p className="text-xs text-slate-500">Configure zones and layouts for elevators and sorting routes.</p>
                    </div>
                    <button 
                      onClick={() => setShowAddFloor(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-[11px] font-semibold text-slate-300"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Level
                    </button>
                  </div>

                  {/* Floor Level selector buttons */}
                  <div className="flex gap-2.5">
                    {floors.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFloor(f)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition duration-150 ${
                          selectedFloor?.id === f.id
                            ? 'bg-blue-600 text-slate-50'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>

                  {selectedFloor && (
                    <div className="space-y-6 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topology Locations List</span>
                        <button
                          onClick={() => setShowAddLoc(true)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-blue-400 border border-blue-900/30"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Location node
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-900">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-950 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-900">
                              <th className="p-4">Location Name</th>
                              <th className="p-4">Type</th>
                              <th className="p-4">X Coordinate</th>
                              <th className="p-4">Y Coordinate</th>
                              <th className="p-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900/50 bg-slate-950/20">
                            {locations.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">No layout nodes configured for this level.</td>
                              </tr>
                            ) : (
                              locations.map(loc => (
                                <tr key={loc.id} className="text-slate-300">
                                  <td className="p-4 font-semibold">{loc.name}</td>
                                  <td className="p-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      loc.type === 'RACK' ? 'bg-blue-950 text-blue-400' : (loc.type === 'PICKUP' ? 'bg-green-950 text-green-400' : 'bg-purple-950 text-purple-400')
                                    }`}>{loc.type}</span>
                                  </td>
                                  <td className="p-4 font-mono font-semibold">{loc.x}</td>
                                  <td className="p-4 font-mono font-semibold">{loc.y}</td>
                                  <td className="p-4 text-right">
                                    <button 
                                      onClick={() => handleDeleteLocation(loc.id)}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add warehouse modal */}
      {showAddWarehouse && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleAddWarehouseSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Add Logistics Center</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Warehouse Name</label>
                <input 
                  type="text" 
                  value={wName} 
                  onChange={e => setWName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  placeholder="e.g. Inbound Dock Facility"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Address / Code</label>
                <input 
                  type="text" 
                  value={wAddress} 
                  onChange={e => setWAddress(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  placeholder="e.g. Sector 12 Area"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowAddWarehouse(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Save Facility</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Floor Level modal */}
      {showAddFloor && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleAddFloorSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Add Level / Floor</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Floor number</label>
                <input 
                  type="number" 
                  value={floorNum} 
                  onChange={e => setFloorNum(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Level Name</label>
                <input 
                  type="text" 
                  value={floorName} 
                  onChange={e => setFloorName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  placeholder="e.g. Floor 4 Sorting Area"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowAddFloor(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Save Level</button>
            </div>
          </form>
        </div>
      )}

      {/* Add node location modal */}
      {showAddLoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleAddLocSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Add Location Node</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Node Name</label>
                <input 
                  type="text" 
                  value={locName} 
                  onChange={e => setLocName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  placeholder="e.g. Rack A5"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Node Type</label>
                <select 
                  value={locType} 
                  onChange={e => setLocType(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100"
                >
                  <option value="RACK">RACK</option>
                  <option value="PICKUP">PICKUP</option>
                  <option value="DELIVERY">DELIVERY</option>
                  <option value="CHARGING">CHARGING</option>
                  <option value="ELEVATOR">ELEVATOR</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Grid X (0-11)</label>
                  <input 
                    type="number" 
                    value={locX} 
                    min={0}
                    max={11}
                    onChange={e => setLocX(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Grid Y (0-7)</label>
                  <input 
                    type="number" 
                    value={locY} 
                    min={0}
                    max={7}
                    onChange={e => setLocY(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowAddLoc(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Save Node</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
