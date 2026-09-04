'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { Plus, Edit2, Trash2, MapPin, Layers, Network, AlertCircle, Loader2 } from 'lucide-react';
import { Warehouse, Floor, Location } from '@/lib/database.types';
import { generateUUID } from '@/lib/uuid';

export default function WarehousesPage() {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<any[]>([]);

  // Modals forms inputs
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [wName, setWName] = useState('');
  const [wAddress, setWAddress] = useState('');
  const [isSubmittingWarehouse, setIsSubmittingWarehouse] = useState(false);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);

  // Edit Warehouse state
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editWName, setEditWName] = useState('');
  const [editWAddress, setEditWAddress] = useState('');

  // Add/Edit Floor state
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [floorNum, setFloorNum] = useState(1);
  const [floorName, setFloorName] = useState('');
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [editFloorName, setEditFloorName] = useState('');

  // Add/Edit Location state
  const [showAddLoc, setShowAddLoc] = useState(false);
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState<'RACK' | 'PICKUP' | 'DELIVERY' | 'CHARGING' | 'ELEVATOR'>('RACK');
  const [locX, setLocX] = useState(0);
  const [locY, setLocY] = useState(0);

  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocType, setEditLocType] = useState<'RACK' | 'PICKUP' | 'DELIVERY' | 'CHARGING' | 'ELEVATOR'>('RACK');
  const [editLocX, setEditLocX] = useState(0);
  const [editLocY, setEditLocY] = useState(0);

  // Zone management state
  const [showAddZone, setShowAddZone] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneCode, setZoneCode] = useState('');
  const [zoneColor, setZoneColor] = useState('#3b82f6');

  const loadData = async () => {
    try {
      const wRes = await supabase.from('warehouses').select();
      let w = wRes.data || [];
      
      const pRes = await supabase.from('profiles').select();
      const pList = pRes.data || [];
      const currentUserProfile = pList.find(
        (p: any) => p.id === user?.id || (user?.email && p.email?.toLowerCase() === user?.email?.toLowerCase())
      );
      const assignedWarehouses = currentUserProfile?.assigned_warehouse_ids || [];
      const isRestricted = ['MANAGER'].includes(userRole);

      if (isRestricted && assignedWarehouses.length > 0) {
        w = w.filter((warehouse: any) => assignedWarehouses.includes(warehouse.id));
      }

      setWarehouses(w as Warehouse[]);
      setSelectedWarehouse((prev: Warehouse | null) => {
        if (!prev && w.length > 0) return w[0] as Warehouse;
        if (prev && !w.some((item: any) => item.id === prev.id)) {
          return (w[0] as Warehouse) || null;
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to load warehouse data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    let isCancelled = false;
    if (selectedWarehouse?.id) {
      const fetchFloors = async () => {
        try {
          const fRes = await supabase.from('floors').select().eq('warehouse_id', selectedWarehouse.id);
          if (isCancelled) return;
          const f = (fRes.data || []) as Floor[];
          setFloors(f);
          if (f.length > 0) {
            setSelectedFloor(prev => {
              if (prev && f.some((item: any) => item.id === prev.id)) {
                return prev;
              }
              return f[0];
            });
          } else {
            setSelectedFloor(null);
            setLocations([]);
            setZones([]);
          }
        } catch (err) {
          if (!isCancelled) {
            setFloors([]);
            setSelectedFloor(null);
            setLocations([]);
            setZones([]);
          }
        }
      };
      fetchFloors();
    } else {
      setFloors([]);
      setSelectedFloor(null);
      setLocations([]);
      setZones([]);
    }
    return () => {
      isCancelled = true;
    };
  }, [selectedWarehouse?.id]);

  useEffect(() => {
    let isCancelled = false;
    if (selectedFloor?.id) {
      const fetchData = async () => {
        try {
          const [lRes, zRes] = await Promise.all([
            supabase.from('locations').select().eq('floor_id', selectedFloor.id),
            supabase.from('zones').select().eq('floor_id', selectedFloor.id)
          ]);
          if (isCancelled) return;
          setLocations((lRes.data || []) as Location[]);
          setZones(zRes.data || []);
        } catch (err) {
          if (!isCancelled) {
            setLocations([]);
            setZones([]);
          }
        }
      };
      fetchData();
    } else {
      setLocations([]);
      setZones([]);
    }
    return () => {
      isCancelled = true;
    };
  }, [selectedFloor?.id]);

  const handleAddWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWarehouseError(null);
    if (!wName.trim()) {
      setWarehouseError('Logistics center name is required.');
      return;
    }

    setIsSubmittingWarehouse(true);
    try {
      const newId = generateUUID();
      const newW: Warehouse = {
        id: newId,
        name: wName.trim(),
        address: wAddress.trim() || 'Sector 1 Logistics Zone',
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase.from('warehouses').insert(newW);
      if (insertError) {
        console.error('Error creating warehouse in database:', insertError);
        throw new Error(insertError.message || 'Database rejected warehouse insertion.');
      }

      // Auto-create initial default level/floor
      const newFloorId = generateUUID();
      const newFloor: Floor = {
        id: newFloorId,
        warehouse_id: newId,
        floor_number: 1,
        name: 'Floor 1 - Storage & Docking',
        grid_width: 12,
        grid_height: 8
      };
      const { error: floorErr } = await supabase.from('floors').insert(newFloor);
      if (floorErr) {
        console.warn('Notice creating initial floor:', floorErr);
      }

      // Update user profile assigned_warehouse_ids if user is restricted
      if (user?.id || user?.email) {
        try {
          const pRes = await supabase.from('profiles').select();
          const pList = pRes.data || [];
          const currentUserProfile = pList.find(
            (p: any) => p.id === user?.id || (user?.email && p.email?.toLowerCase() === user?.email?.toLowerCase())
          );
          if (currentUserProfile) {
            const assigned = currentUserProfile.assigned_warehouse_ids || [];
            if (!assigned.includes(newId)) {
              await supabase.from('profiles').update({
                assigned_warehouse_ids: [...assigned, newId]
              }).eq('id', currentUserProfile.id);
            }
          }
        } catch (pErr) {
          console.warn('Profile warehouse assignment notice:', pErr);
        }
      }

      setWName('');
      setWAddress('');
      setShowAddWarehouse(false);
      setSelectedWarehouse(newW);
      await loadData();
    } catch (err: any) {
      setWarehouseError(err?.message || 'Failed to save logistics center. Please check database permissions.');
    } finally {
      setIsSubmittingWarehouse(false);
    }
  };

  const handleEditWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse || !editWName.trim()) return;
    const { error } = await supabase.from('warehouses').update({
      name: editWName.trim(),
      address: editWAddress.trim()
    }).eq('id', editingWarehouse.id);
    if (error) {
      alert('Failed to update warehouse: ' + error.message);
      return;
    }
    setEditingWarehouse(null);
    await loadData();
  };

  const handleDeleteWarehouse = async (id: string) => {
    if (!confirm('Are you sure you want to delete this logistics facility?')) return;
    const { error } = await supabase.from('warehouses').delete().eq('id', id);
    if (error) {
      alert('Failed to delete warehouse: ' + error.message);
      return;
    }
    setSelectedWarehouse(null);
    await loadData();
  };

  const handleAddFloorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse || !floorName.trim()) return;
    const newId = generateUUID();
    const newF = {
      id: newId,
      warehouse_id: selectedWarehouse.id,
      floor_number: Number(floorNum),
      name: floorName.trim(),
      grid_width: 12,
      grid_height: 8
    };
    const { error } = await supabase.from('floors').insert(newF);
    if (error) {
      alert('Failed to add floor: ' + error.message);
      return;
    }
    setFloorName('');
    setFloorNum(floors.length + 2);
    setShowAddFloor(false);
    const fRes = await supabase.from('floors').select().eq('warehouse_id', selectedWarehouse.id);
    const updatedFloors = (fRes.data || []) as Floor[];
    setFloors(updatedFloors);
    const createdFloor = updatedFloors.find(x => x.id === newId) || (newF as Floor);
    setSelectedFloor(createdFloor);
  };

  const handleEditFloorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFloor || !editFloorName.trim()) return;
    const { error } = await supabase.from('floors').update({ name: editFloorName.trim() }).eq('id', editingFloor.id);
    if (error) {
      alert('Failed to update floor: ' + error.message);
      return;
    }
    setEditingFloor(null);
    if (selectedWarehouse) {
      const fRes = await supabase.from('floors').select().eq('warehouse_id', selectedWarehouse.id);
      setFloors((fRes.data || []) as Floor[]);
    }
  };

  const handleDeleteFloor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this floor level?')) return;
    const { error } = await supabase.from('floors').delete().eq('id', id);
    if (error) {
      alert('Failed to delete floor: ' + error.message);
      return;
    }
    if (selectedWarehouse) {
      const fRes = await supabase.from('floors').select().eq('warehouse_id', selectedWarehouse.id);
      const f = fRes.data || [];
      setFloors(f as Floor[]);
      setSelectedFloor(f.length > 0 ? (f[0] as Floor) : null);
    }
  };

  const handleAddLocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFloor || !locName.trim()) return;
    const zRes = await supabase.from('zones').select().eq('floor_id', selectedFloor.id);
    const zList = zRes.data || [];
    const zoneId = zList.length > 0 ? zList[0].id : null;

    const newId = generateUUID();
    const newLoc = {
      id: newId,
      zone_id: zoneId,
      name: locName.trim(),
      type: locType,
      x: Number(locX),
      y: Number(locY),
      floor_id: selectedFloor.id
    };
    const { error } = await supabase.from('locations').insert(newLoc);
    if (error) {
      alert('Failed to add location: ' + error.message);
      return;
    }
    setLocName('');
    setLocX(0);
    setLocY(0);
    setShowAddLoc(false);
    const lRes = await supabase.from('locations').select().eq('floor_id', selectedFloor.id);
    setLocations((lRes.data || []) as Location[]);
  };

  const handleEditLocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoc || !editLocName.trim()) return;
    const { error } = await supabase.from('locations').update({
      name: editLocName.trim(),
      type: editLocType,
      x: Number(editLocX),
      y: Number(editLocY)
    }).eq('id', editingLoc.id);
    if (error) {
      alert('Failed to update location: ' + error.message);
      return;
    }
    setEditingLoc(null);
    if (selectedFloor) {
      const lRes = await supabase.from('locations').select().eq('floor_id', selectedFloor.id);
      setLocations((lRes.data || []) as Location[]);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) {
      alert('Failed to delete location: ' + error.message);
      return;
    }
    if (selectedFloor) {
      const lRes = await supabase.from('locations').select().eq('floor_id', selectedFloor.id);
      setLocations((lRes.data || []) as Location[]);
    }
  };

  const handleAddZoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFloor || !zoneName.trim()) return;
    const newId = generateUUID();
    const newZ = {
      id: newId,
      floor_id: selectedFloor.id,
      name: zoneName.trim(),
      code: zoneCode.trim() || `Z-${Date.now().toString().substring(8)}`,
      color: zoneColor
    };
    const { error } = await supabase.from('zones').insert(newZ);
    if (error) {
      alert('Failed to add zone: ' + error.message);
      return;
    }
    setZoneName('');
    setZoneCode('');
    setShowAddZone(false);
    const zRes = await supabase.from('zones').select().eq('floor_id', selectedFloor.id);
    setZones(zRes.data || []);
  };

  const handleDeleteZone = async (id: string) => {
    const { error } = await supabase.from('zones').delete().eq('id', id);
    if (error) {
      alert('Failed to delete zone: ' + error.message);
      return;
    }
    if (selectedFloor) {
      const zRes = await supabase.from('zones').select().eq('floor_id', selectedFloor.id);
      setZones(zRes.data || []);
    }
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="flex h-screen w-full overflow-hidden bg-slate-950 relative">
        <AmbientBackground intensity="low" />
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
          <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Warehouse Configurations</h1>
              <p className="text-xs sm:text-sm text-slate-400">Configure logistics centers, layouts, levels, elevators and pickup lanes.</p>
            </div>
            <button 
              onClick={() => { setWName(''); setWAddress(''); setWarehouseError(null); setShowAddWarehouse(true); }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-slate-50 transition duration-150 shrink-0"
            >
              <Plus className="h-4 w-4" /> Add Logistics Center
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Warehouses list */}
            <div className="rounded-2xl border border-slate-800/80 bg-[#141419] p-6 shadow-xl space-y-4">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Logistics Facilities</span>
              <div className="space-y-2">
                {warehouses.map(w => (
                  <div
                    key={w.id}
                    className={`p-3.5 rounded-xl border transition duration-150 flex items-center justify-between ${
                      selectedWarehouse?.id === w.id
                        ? 'border-blue-500 bg-blue-600/10 text-slate-100 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                        : 'border-slate-800/60 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <button 
                      onClick={() => {
                        if (selectedWarehouse?.id !== w.id) {
                          setSelectedWarehouse(w);
                          setFloors([]);
                          setSelectedFloor(null);
                          setLocations([]);
                          setZones([]);
                        }
                      }} 
                      className="text-left flex-1"
                    >
                      <span className="text-sm font-bold block">{w.name}</span>
                      <span className="text-[10px] block mt-1">{w.address || 'No Address'}</span>
                    </button>
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => { setEditingWarehouse(w); setEditWName(w.name); setEditWAddress(w.address || ''); }}
                        className="text-slate-400 hover:text-slate-200 p-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteWarehouse(w.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floors and coordinates grid configuration list */}
            <div className="lg:col-span-3 space-y-8">
              {selectedWarehouse && (
                <div className="rounded-2xl border border-slate-800/80 bg-[#141419] p-6 shadow-xl space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">{selectedWarehouse.name} Levels</h3>
                      <p className="text-xs text-slate-400">Configure zones and layouts for elevators and sorting routes.</p>
                    </div>
                    <button 
                      onClick={() => setShowAddFloor(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white shadow-[0_0_12px_rgba(59,130,246,0.3)] transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Level
                    </button>
                  </div>

                  {/* Floor Level selector buttons */}
                  {floors.length === 0 ? (
                    <div className="py-8 px-4 border border-dashed border-slate-800 rounded-xl text-center space-y-3 bg-slate-950/40">
                      <Layers className="h-8 w-8 text-slate-600 mx-auto" />
                      <div>
                        <p className="text-xs font-bold text-slate-300">No floor levels configured for {selectedWarehouse.name}</p>
                        <p className="text-[11px] text-slate-500 mt-1">This warehouse facility currently has no floor levels configured.</p>
                      </div>
                      <button 
                        onClick={() => { setFloorName(''); setFloorNum(1); setShowAddFloor(true); }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-[0_0_12px_rgba(59,130,246,0.3)] transition"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add First Level
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {floors.map(f => (
                        <div key={f.id} className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedFloor(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition duration-150 ${
                              selectedFloor?.id === f.id
                                ? 'bg-blue-600 text-slate-50'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {f.name}
                          </button>
                          {selectedFloor?.id === f.id && (
                            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl">
                              <button
                                onClick={() => { setEditingFloor(f); setEditFloorName(f.name); }}
                                className="text-slate-400 hover:text-slate-200 p-1"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteFloor(f.id)}
                                className="text-red-400 hover:text-red-300 p-1"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedFloor && (
                    <div className="space-y-6 pt-4">
                      {/* Zones Section */}
                      <div className="rounded-xl border border-slate-900 bg-slate-950/60 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Warehouse Zones</span>
                          <button
                            onClick={() => setShowAddZone(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-bold text-blue-400 border border-blue-900/30"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Zone
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {zones.map(z => (
                            <div key={z.id} className="p-3 rounded-lg border border-slate-900 bg-slate-950 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: z.color || '#3b82f6' }} />
                                <div>
                                  <span className="text-xs font-bold text-slate-200 block">{z.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{z.code}</span>
                                </div>
                              </div>
                              <button onClick={() => handleDeleteZone(z.id)} className="text-red-400 hover:text-red-300 p-1">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Locations Section */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topology Locations & Racks List</span>
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
                                    <td className="p-4 text-right flex items-center justify-end gap-2">
                                      <button 
                                        onClick={() => { setEditingLoc(loc); setEditLocName(loc.name); setEditLocType(loc.type as any); setEditLocX(loc.x); setEditLocY(loc.y); }}
                                        className="text-slate-400 hover:text-slate-200"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </button>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Add warehouse modal */}
      {/* Add warehouse modal */}
      {showAddWarehouse && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSubmittingWarehouse) { setShowAddWarehouse(false); setWarehouseError(null); } }}>
          <form onSubmit={handleAddWarehouseSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Add Logistics Center</h3>

            {warehouseError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span>{warehouseError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Warehouse Name</label>
                <input 
                  type="text" 
                  value={wName} 
                  onChange={e => { setWName(e.target.value); setWarehouseError(null); }}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:border-blue-500" 
                  placeholder="e.g. Inbound Dock Facility"
                  disabled={isSubmittingWarehouse}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Address / Code</label>
                <input 
                  type="text" 
                  value={wAddress} 
                  onChange={e => setWAddress(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:border-blue-500" 
                  placeholder="e.g. Sector 12 Area"
                  disabled={isSubmittingWarehouse}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button 
                type="button" 
                onClick={() => { setShowAddWarehouse(false); setWarehouseError(null); }} 
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                disabled={isSubmittingWarehouse}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmittingWarehouse}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
              >
                {isSubmittingWarehouse ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving to Database...
                  </>
                ) : (
                  'Save Facility'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit warehouse modal */}
      {editingWarehouse && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleEditWarehouseSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Edit Logistics Center</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Warehouse Name</label>
                <input 
                  type="text" 
                  value={editWName} 
                  onChange={e => setEditWName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Address / Code</label>
                <input 
                  type="text" 
                  value={editWAddress} 
                  onChange={e => setEditWAddress(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setEditingWarehouse(null)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Update Facility</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Floor Level modal */}
      {showAddFloor && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
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

      {/* Edit Floor Level modal */}
      {editingFloor && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleEditFloorSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Edit Level Name</h3>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Level Name</label>
              <input 
                type="text" 
                value={editFloorName} 
                onChange={e => setEditFloorName(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setEditingFloor(null)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Update Level</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Zone modal */}
      {showAddZone && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleAddZoneSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Add Warehouse Zone</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Zone Name</label>
                <input 
                  type="text" 
                  value={zoneName} 
                  onChange={e => setZoneName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  placeholder="e.g. Zone A - Inbound Buffer"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Zone Code</label>
                <input 
                  type="text" 
                  value={zoneCode} 
                  onChange={e => setZoneCode(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  placeholder="e.g. Z1-A"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Zone Color</label>
                <input 
                  type="color" 
                  value={zoneColor} 
                  onChange={e => setZoneColor(e.target.value)}
                  className="w-full h-10 p-1 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowAddZone(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Save Zone</button>
            </div>
          </form>
        </div>
      )}

      {/* Add node location modal */}
      {showAddLoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
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

      {/* Edit node location modal */}
      {editingLoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleEditLocSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Edit Location Node</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Node Name</label>
                <input 
                  type="text" 
                  value={editLocName} 
                  onChange={e => setEditLocName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Node Type</label>
                <select 
                  value={editLocType} 
                  onChange={e => setEditLocType(e.target.value as any)}
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
                    value={editLocX} 
                    min={0}
                    max={11}
                    onChange={e => setEditLocX(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Grid Y (0-7)</label>
                  <input 
                    type="number" 
                    value={editLocY} 
                    min={0}
                    max={7}
                    onChange={e => setEditLocY(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100" 
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setEditingLoc(null)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Update Node</button>
            </div>
          </form>
        </div>
      )}
      </div>
    </RoleGuard>
  );
}
