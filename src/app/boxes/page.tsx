'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { usePreventScroll } from '@/lib/usePreventScroll';
import { Plus, Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, FileDown, Edit3, Trash2, Link2 } from 'lucide-react';
import { Box, Location, Floor, Warehouse } from '@/lib/database.types';
import { generateUUID } from '@/lib/uuid';
import Link from 'next/link';

export default function BoxesPage() {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [assignedWarehouseIds, setAssignedWarehouseIds] = useState<string[]>([]);
  
  // Search, sorting, pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortField, setSortField] = useState<'box_code' | 'priority' | 'weight'>('box_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Add Box Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalWarehouseId, setModalWarehouseId] = useState('');
  const [boxCode, setBoxCode] = useState('');
  const [prodName, setProdName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [weight, setWeight] = useState(1.5);
  const [srcLoc, setSrcLoc] = useState('');
  const [destLoc, setDestLoc] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');

  // Custom location entry state
  const [srcMode, setSrcMode] = useState<'SELECT' | 'CUSTOM'>('SELECT');
  const [destMode, setDestMode] = useState<'SELECT' | 'CUSTOM'>('SELECT');
  const [srcCustomFloorId, setSrcCustomFloorId] = useState('');
  const [srcCustomName, setSrcCustomName] = useState('');
  const [destCustomFloorId, setDestCustomFloorId] = useState('');
  const [destCustomName, setDestCustomName] = useState('');

  const getWarehouseLocations = (whId: string) => {
    if (!whId) return locations;
    const whFloors = floors.filter(f => f.warehouse_id === whId);
    const whFloorIds = new Set(whFloors.map(f => f.id));
    return locations.filter(l => whFloorIds.has(l.floor_id));
  };

  const getWarehouseFloors = (whId: string) => {
    if (!whId) return floors;
    return floors.filter(f => f.warehouse_id === whId);
  };

  const getBoxWarehouse = (box: Box): Warehouse | undefined => {
    const loc = locations.find(l => l.id === box.current_location_id) || locations.find(l => l.id === box.destination_location_id);
    const floor = floors.find(f => f.id === loc?.floor_id);
    return warehouses.find(w => w.id === floor?.warehouse_id);
  };

  const loadBoxes = async (forceMetadata = false) => {
    try {
      if (forceMetadata || locations.length === 0 || warehouses.length === 0) {
        const [bRes, pRes, lRes, fRes, wRes] = await Promise.all([
          supabase.from('boxes').select(),
          supabase.from('profiles').select(),
          supabase.from('locations').select(),
          supabase.from('floors').select(),
          supabase.from('warehouses').select()
        ]);

        let list = (bRes.data || []) as any[];
        const pList = pRes.data || [];
        const currentUserProfile = pList.find((p: any) => p.id === user?.id);
        const assignedWarehouses = currentUserProfile?.assigned_warehouse_ids || [];
        setAssignedWarehouseIds(assignedWarehouses);
        const isRestricted = userRole !== 'ADMIN';
        let locs = (lRes.data || []) as Location[];
        const fls = (fRes.data || []) as Floor[];
        let whs = (wRes.data || []) as Warehouse[];

        if (isRestricted && assignedWarehouses.length > 0) {
          const allowedF = fls.filter((f: any) => assignedWarehouses.includes(f.warehouse_id)).map((f: any) => f.id);
          const allowedL = locs.filter((l: any) => allowedF.includes(l.floor_id)).map((l: any) => l.id);
          list = list.filter((b: any) => allowedL.includes(b.current_location_id));
          locs = locs.filter((l: any) => allowedL.includes(l.id));
          whs = whs.filter((w: any) => assignedWarehouses.includes(w.id));
        }

        locs.sort((a, b) => {
          const fA = fls.find(f => f.id === a.floor_id)?.floor_number ?? 0;
          const fB = fls.find(f => f.id === b.floor_id)?.floor_number ?? 0;
          if (fA !== fB) return fA - fB;
          return a.name.localeCompare(b.name);
        });

        setBoxes(list as Box[]);
        setLocations(locs as Location[]);
        setFloors(fls);
        setWarehouses(whs);
      } else {
        // Fast background poll: only boxes table!
        const bRes = await supabase.from('boxes').select();
        if (bRes.data) {
          let list = bRes.data as any[];
          const isRestricted = userRole !== 'ADMIN';
          if (isRestricted && locations.length > 0) {
            const allowedIds = new Set(locations.map(l => l.id));
            list = list.filter((b: any) => allowedIds.has(b.current_location_id));
          }
          setBoxes(prev => {
            if (prev.length === list.length && prev.every((b, i) => b.id === list[i]?.id && b.status === list[i]?.status && b.updated_at === list[i]?.updated_at)) {
              return prev;
            }
            return list as Box[];
          });
        }
      }
    } catch (err) {
      console.error('Failed to load boxes:', err);
    }
  };

  // Keep default warehouse and locations synchronized
  useEffect(() => {
    if (warehouses.length > 0 && locations.length > 0) {
      const activeWh = modalWarehouseId || (filterWarehouse !== 'ALL' ? filterWarehouse : warehouses[0].id);
      if (!modalWarehouseId) setModalWarehouseId(activeWh);

      const whLocs = getWarehouseLocations(activeWh);
      if (whLocs.length > 0) {
        setSrcLoc(prev => (prev && whLocs.some(l => l.id === prev) ? prev : whLocs[0].id));
        setDestLoc(prev => {
          if (prev && whLocs.some(l => l.id === prev)) return prev;
          return whLocs.length > 1 ? whLocs[1].id : whLocs[0].id;
        });
      }

      const whFloors = getWarehouseFloors(activeWh);
      if (whFloors.length > 0) {
        setSrcCustomFloorId(prev => (prev && whFloors.some(f => f.id === prev) ? prev : whFloors[0].id));
        setDestCustomFloorId(prev => {
          if (prev && whFloors.some(f => f.id === prev)) return prev;
          return whFloors[1]?.id || whFloors[0].id;
        });
      }
    }
  }, [warehouses, locations, floors]);

  // Edit Box Modal state
  const [editingBox, setEditingBox] = useState<Box | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editWeight, setEditWeight] = useState(1);
  const [editPriority, setEditPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');

  useEffect(() => {
    loadBoxes(true);
    const interval = setInterval(() => {
      // Avoid polling and re-renders while typing in a modal or when tab is inactive
      if (document.hidden || showAddModal || editingBox) return;
      loadBoxes(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [showAddModal, Boolean(editingBox)]);

  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getLocationLabel = (l: Location) => {
    const floor = floors.find(f => f.id === l.floor_id);
    const warehouse = warehouses.find(w => w.id === floor?.warehouse_id);
    const floorName = floor ? (floor.name || `Floor ${floor.floor_number}`) : 'Floor 1';
    return warehouse ? `${l.name} (${warehouse.name} - ${floorName})` : `${l.name} (${floorName})`;
  };

  const handleModalWarehouseChange = (whId: string) => {
    setModalWarehouseId(whId);
    const whLocs = getWarehouseLocations(whId);
    const whFloors = getWarehouseFloors(whId);

    if (whLocs.length > 0) {
      setSrcLoc(whLocs[0].id);
      setDestLoc(whLocs.length > 1 ? whLocs[1].id : whLocs[0].id);
    } else {
      setSrcLoc('');
      setDestLoc('');
    }

    if (whFloors.length > 0) {
      setSrcCustomFloorId(whFloors[0].id);
      setDestCustomFloorId(whFloors.length > 1 ? whFloors[1].id : whFloors[0].id);
    } else {
      setSrcCustomFloorId('');
      setDestCustomFloorId('');
    }
  };

  const handleOpenAddModal = () => {
    setBoxCode(`BX-${Math.floor(Math.random() * 9000 + 1000)}`);
    setProdName('');
    setCategory('Electronics');
    setWeight(1.5);
    setPriority('NORMAL');
    setSrcMode('SELECT');
    setDestMode('SELECT');

    const targetWhId = (userRole === 'ADMIN')
      ? ((filterWarehouse !== 'ALL' && warehouses.some(w => w.id === filterWarehouse))
          ? filterWarehouse
          : (modalWarehouseId && warehouses.some(w => w.id === modalWarehouseId))
          ? modalWarehouseId
          : (warehouses[0]?.id || ''))
      : (assignedWarehouseIds.find(id => warehouses.some(w => w.id === id)) || warehouses[0]?.id || '');

    handleModalWarehouseChange(targetWhId);
    setSrcCustomName('');
    setDestCustomName('');
    setModalError(null);
    setShowAddModal(true);
  };

  const handleAddBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxCode || !prodName) return;

    setModalError(null);

    try {
      let finalSrcLocId = srcLoc;
      let finalDestLocId = destLoc;
      const newLocs: Location[] = [];
      const locInserts: Promise<any>[] = [];
      const targetWhFloors = getWarehouseFloors(modalWarehouseId);

      // Handle custom source location creation
      if (srcMode === 'CUSTOM' || !finalSrcLocId) {
        if (!srcCustomName.trim()) {
          setModalError('Please enter a source location name.');
          return;
        }
        const newLocId = generateUUID();
        const targetFloor = srcCustomFloorId || targetWhFloors[0]?.id || floors[0]?.id;
        const newL: Location = {
          id: newLocId,
          name: srcCustomName.trim(),
          floor_id: targetFloor,
          type: 'PICKUP',
          x: 1,
          y: 1
        };
        newLocs.push(newL);
        locInserts.push(supabase.from('locations').insert(newL));
        finalSrcLocId = newLocId;
      }

      // Handle custom destination location creation
      if (destMode === 'CUSTOM' || !finalDestLocId) {
        if (!destCustomName.trim()) {
          setModalError('Please enter a destination location name.');
          return;
        }
        const newLocId = generateUUID();
        const targetFloor = destCustomFloorId || targetWhFloors[1]?.id || targetWhFloors[0]?.id || floors[0]?.id;
        const newL: Location = {
          id: newLocId,
          name: destCustomName.trim(),
          floor_id: targetFloor,
          type: 'DELIVERY',
          x: 6,
          y: 6
        };
        newLocs.push(newL);
        locInserts.push(supabase.from('locations').insert(newL));
        finalDestLocId = newLocId;
      }

      // Enforce strict warehouse boundary check: pickup and delivery must be in the same warehouse!
      const allKnownLocs = [...locations, ...newLocs];
      const srcLocObj = allKnownLocs.find(l => l.id === finalSrcLocId);
      const destLocObj = allKnownLocs.find(l => l.id === finalDestLocId);
      const srcFloorObj = floors.find(f => f.id === srcLocObj?.floor_id);
      const destFloorObj = floors.find(f => f.id === destLocObj?.floor_id);

      if (srcFloorObj && destFloorObj && srcFloorObj.warehouse_id !== destFloorObj.warehouse_id) {
        const srcWh = warehouses.find(w => w.id === srcFloorObj.warehouse_id)?.name || 'Source Warehouse';
        const destWh = warehouses.find(w => w.id === destFloorObj.warehouse_id)?.name || 'Destination Warehouse';
        setModalError(`Cross-warehouse transit blocked: A box picked up in ${srcWh} must be delivered within ${srcWh}, not ${destWh}.`);
        return;
      }

      const newId = generateUUID();
      const newBox: Box = {
        id: newId,
        box_code: boxCode,
        product_name: prodName,
        category,
        weight: Number(weight),
        current_location_id: finalSrcLocId,
        destination_location_id: finalDestLocId,
        priority,
        status: 'WAITING',
        qr_code_data: boxCode,
        created_by: user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const estDistance = 15;
      const estDuration = 120;
      
      const newTask = {
        id: generateUUID(),
        task_code: `TSK-${Date.now().toString().substring(7)}`,
        box_id: newBox.id,
        vehicle_id: null,
        source_location_id: finalSrcLocId,
        destination_location_id: finalDestLocId,
        priority,
        status: 'PENDING',
        priority_score: priority === 'URGENT' ? 100 : (priority === 'HIGH' ? 50 : 10),
        estimated_distance: estDistance,
        estimated_duration: estDuration,
        actual_duration: null,
        created_by: user?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        assigned_at: null,
        started_at: null,
        completed_at: null,
        created_at: new Date().toISOString()
      };

      // 1. Instantly update local UI state (0ms perceived latency!)
      if (newLocs.length > 0) {
        setLocations(prev => [...prev, ...newLocs]);
      }
      setBoxes(prev => [newBox, ...prev]);

      // 2. Immediately close modal and reset form fields
      setShowAddModal(false);
      setBoxCode('');
      setProdName('');
      setIsSubmitting(false);

      // 3. Persist to DB concurrently in background
      (async () => {
        try {
          await Promise.all([
            ...locInserts,
            supabase.from('boxes').insert(newBox),
            supabase.from('tasks').insert(newTask)
          ]);
        } catch (err: any) {
          console.error('Failed to save box/task to server:', err);
          setBoxes(prev => prev.filter(b => b.id !== newBox.id));
          alert('Failed to save box to server: ' + (err?.message || 'Database error'));
        }
      })();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to save box.');
      setIsSubmitting(false);
    }
  };

  usePreventScroll(Boolean(editingBox || showAddModal));

  const handleDeleteBox = async (id: string) => {
    // Instant optimistic removal
    setBoxes(prev => prev.filter(b => b.id !== id));
    try {
      await supabase.from('boxes').delete().eq('id', id);
    } catch (err: any) {
      console.error('Failed to delete box:', err);
      loadBoxes(true);
    }
  };

  const handleEditBoxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBox || !editProdName) return;

    const updatedBox: Box = {
      ...editingBox,
      product_name: editProdName,
      category: editCategory,
      weight: Number(editWeight),
      priority: editPriority,
      updated_at: new Date().toISOString()
    };

    // Instant optimistic update
    setBoxes(prev => prev.map(b => b.id === editingBox.id ? updatedBox : b));
    setEditingBox(null);

    try {
      await supabase.from('boxes').update({
        product_name: editProdName,
        category: editCategory,
        weight: Number(editWeight),
        priority: editPriority,
        updated_at: new Date().toISOString()
      }).eq('id', editingBox.id);
    } catch (err: any) {
      console.error('Failed to update box:', err);
      loadBoxes(true);
    }
  };

  // Filter, Sort, Paginate Pipeline
  const filtered = boxes.filter(b => {
    const matchesSearch = b.box_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = filterPriority === 'ALL' || b.priority === filterPriority;
    const matchesStatus = filterStatus === 'ALL' || b.status === filterStatus;
    const matchesWarehouse = filterWarehouse === 'ALL' || (() => {
      const boxWh = getBoxWarehouse(b);
      return boxWh?.id === filterWarehouse;
    })();
    return matchesSearch && matchesPriority && matchesStatus && matchesWarehouse;
  });

  const sorted = [...filtered].sort((a, b) => {
    let fieldA = a[sortField];
    let fieldB = b[sortField];
    if (typeof fieldA === 'string') {
      return sortOrder === 'asc' 
        ? fieldA.localeCompare(fieldB as string)
        : (fieldB as string).localeCompare(fieldA);
    }
    return sortOrder === 'asc' 
      ? (fieldA as number) - (fieldB as number)
      : (fieldB as number) - (fieldA as number);
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSort = (field: 'box_code' | 'priority' | 'weight') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'OPERATOR']}>
      <div className="flex h-screen w-full overflow-hidden bg-slate-950 relative">
        <AmbientBackground intensity="low" />
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
          <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Warehouse Cargo & Boxes</h1>
              <p className="text-xs sm:text-sm text-slate-400">View register catalogs, download generated QR identities, and assign priorities.</p>
            </div>
            {['ADMIN', 'MANAGER', 'OPERATOR'].includes(userRole) && (
              <button
                onClick={handleOpenAddModal}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-slate-50 transition duration-150 shrink-0"
              >
                <Plus className="h-4 w-4" /> Register Box Packet
              </button>
            )}
          </div>

          {/* Search filters panel */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${userRole === 'ADMIN' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 rounded-2xl border border-slate-800/80 bg-[#141419] p-5 shadow-xl`}>
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search box code, category..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/80 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
              />
            </div>

            {userRole === 'ADMIN' && (
              <div>
                <select
                  value={filterWarehouse}
                  onChange={e => { setFilterWarehouse(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-300"
                >
                  <option value="ALL">All Warehouses</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <select
                value={filterPriority}
                onChange={e => { setFilterPriority(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-300"
              >
                <option value="ALL">All Priorities</option>
                <option value="NORMAL">NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs text-slate-300"
              >
                <option value="ALL">All Statuses</option>
                <option value="WAITING">WAITING</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="DELIVERED">DELIVERED</option>
              </select>
            </div>

            <div className="flex items-center justify-end sm:col-span-2 md:col-span-1">
              <span className="text-[11px] text-slate-400 font-mono font-bold">Found {filtered.length} packets</span>
            </div>
          </div>

          {/* Boxes list table layout */}
          <div className="rounded-2xl border border-slate-800/80 bg-[#141419] p-6 shadow-xl space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3 cursor-pointer" onClick={() => toggleSort('box_code')}>
                      <div className="flex items-center gap-1">Box ID <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="pb-3">Product Name</th>
                    <th className="pb-3">Warehouse</th>
                    <th className="pb-3 cursor-pointer" onClick={() => toggleSort('priority')}>
                      <div className="flex items-center gap-1">Priority <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="pb-3 cursor-pointer" onClick={() => toggleSort('weight')}>
                      <div className="flex items-center gap-1">Weight (KG) <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-slate-300">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">No box packets found. Register one or reset seeds.</td>
                    </tr>
                  ) : (
                    paginated.map(box => (
                      <tr key={box.id}>
                        <td className="py-4 font-mono font-bold text-blue-400">
                          <Link href={`/boxes/${box.id}`} className="hover:underline flex items-center gap-1">
                            <Link2 className="h-3.5 w-3.5" /> {box.box_code}
                          </Link>
                        </td>
                        <td className="py-4">
                          <span className="font-semibold block text-slate-100">{box.product_name}</span>
                          <span className="text-[10px] text-slate-500">{box.category}</span>
                        </td>
                        <td className="py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950/40 text-blue-400 border border-blue-900/30">
                            {getBoxWarehouse(box)?.name || 'Warehouse 1'}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            box.priority === 'URGENT' ? 'bg-red-950 text-red-400 border border-red-900/20' : (box.priority === 'HIGH' ? 'bg-yellow-950 text-yellow-500' : 'bg-slate-900 text-slate-400')
                          }`}>{box.priority}</span>
                        </td>
                        <td className="py-4 font-semibold">{box.weight} kg</td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            box.status === 'DELIVERED' ? 'bg-green-950 text-green-400' : (box.status === 'WAITING' ? 'bg-slate-900 text-slate-400 animate-pulse' : 'bg-blue-950 text-blue-400')
                          }`}>{box.status}</span>
                        </td>
                        <td className="py-4 text-right space-x-2">
                          {['ADMIN', 'MANAGER'].includes(userRole) && (
                            <button
                              onClick={() => {
                                setEditingBox(box);
                                setEditProdName(box.product_name);
                                setEditCategory(box.category);
                                setEditWeight(box.weight);
                                setEditPriority(box.priority as any);
                              }}
                              className="p-1.5 rounded bg-slate-900 text-slate-300 hover:text-slate-100"
                              title="Edit Box Specs"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <Link
                            href={`/boxes/${box.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-[10px] font-semibold text-slate-400 hover:text-slate-200"
                          >
                            Identity QR
                          </Link>
                          {['ADMIN', 'MANAGER'].includes(userRole) && (
                            <button
                              onClick={() => handleDeleteBox(box.id)}
                              className="p-1.5 rounded bg-red-950/20 text-red-400 hover:bg-red-950/40"
                              title="Delete Box"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-900 pt-4">
                <span className="text-[11px] text-slate-500 font-mono">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="p-2 rounded border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="p-2 rounded border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Edit Box Modal */}
      {editingBox && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleEditBoxSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Edit Box Details ({editingBox.box_code})</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Product Description</label>
                <input
                  type="text"
                  required
                  value={editProdName}
                  onChange={e => setEditProdName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Medical">Medical</option>
                    <option value="Hazmat">Hazmat</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Weight (KG)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editWeight}
                    onChange={e => setEditWeight(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cargo Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {['NORMAL', 'HIGH', 'URGENT'].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setEditPriority(level as any)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition duration-150 ${
                        editPriority === level
                          ? 'border-blue-500 bg-blue-600/15 text-slate-50'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setEditingBox(null)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Update Box</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Box Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleAddBox} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Register New Box Packet</h3>
            
            {modalError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {modalError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Generated Box Code</label>
                <input
                  type="text"
                  required
                  value={boxCode}
                  onChange={e => setBoxCode(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Product Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lithium-Ion Battery pack B9"
                  value={prodName}
                  onChange={e => setProdName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Medical">Medical</option>
                    <option value="Hazmat">Hazmat</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Weight (KG)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={weight}
                    onChange={e => setWeight(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                  />
                </div>
              </div>

              {/* Operating Warehouse Facility (Admin Only) */}
              {userRole === 'ADMIN' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Operating Warehouse Facility
                    </label>
                    <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-1 font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                      Same-Facility Isolation
                    </span>
                  </div>
                  <select
                    value={modalWarehouseId}
                    onChange={e => handleModalWarehouseChange(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-semibold text-slate-100 outline-none focus:border-blue-500"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Cargo pickup and delivery are strictly isolated to this warehouse. Cross-facility transit is prohibited.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Source Location */}
                {(() => {
                  const whLocs = getWarehouseLocations(modalWarehouseId);
                  const whFloors = getWarehouseFloors(modalWarehouseId);
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source Location</label>
                        <button
                          type="button"
                          onClick={() => setSrcMode(srcMode === 'SELECT' ? 'CUSTOM' : 'SELECT')}
                          className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 underline"
                        >
                          {srcMode === 'SELECT' ? '+ Enter Custom' : 'Pick Existing'}
                        </button>
                      </div>

                      {srcMode === 'SELECT' && whLocs.length > 0 ? (
                        <select
                          value={srcLoc}
                          onChange={e => {
                            if (e.target.value === '__custom__') {
                              setSrcMode('CUSTOM');
                            } else {
                              setSrcLoc(e.target.value);
                            }
                          }}
                          className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 outline-none"
                        >
                          {whLocs.map(l => (
                            <option key={l.id} value={l.id}>{getLocationLabel(l)}</option>
                          ))}
                          <option value="__custom__">+ Enter Custom Location...</option>
                        </select>
                      ) : (
                        <div className="space-y-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <div>
                            <span className="text-[9px] font-semibold text-slate-500 block mb-0.5">Floor Level</span>
                            <select
                              value={srcCustomFloorId}
                              onChange={e => setSrcCustomFloorId(e.target.value)}
                              className="w-full p-1.5 rounded border border-slate-800 bg-slate-900 text-xs text-slate-200 outline-none"
                            >
                              {whFloors.map(f => (
                                <option key={f.id} value={f.id}>{f.name || `Floor ${f.floor_number}`}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <span className="text-[9px] font-semibold text-slate-500 block mb-0.5">Location Name</span>
                            <input
                              type="text"
                              placeholder="e.g. Inbound Dock 1"
                              value={srcCustomName}
                              onChange={e => setSrcCustomName(e.target.value)}
                              className="w-full p-1.5 rounded border border-slate-800 bg-slate-900 text-xs text-slate-100 placeholder-slate-600 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Destination Location */}
                {(() => {
                  const whLocs = getWarehouseLocations(modalWarehouseId);
                  const whFloors = getWarehouseFloors(modalWarehouseId);
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination Location</label>
                        <button
                          type="button"
                          onClick={() => setDestMode(destMode === 'SELECT' ? 'CUSTOM' : 'SELECT')}
                          className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 underline"
                        >
                          {destMode === 'SELECT' ? '+ Enter Custom' : 'Pick Existing'}
                        </button>
                      </div>

                      {destMode === 'SELECT' && whLocs.length > 0 ? (
                        <select
                          value={destLoc}
                          onChange={e => {
                            if (e.target.value === '__custom__') {
                              setDestMode('CUSTOM');
                            } else {
                              setDestLoc(e.target.value);
                            }
                          }}
                          className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 outline-none"
                        >
                          {whLocs.map(l => (
                            <option key={l.id} value={l.id}>{getLocationLabel(l)}</option>
                          ))}
                          <option value="__custom__">+ Enter Custom Location...</option>
                        </select>
                      ) : (
                        <div className="space-y-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                          <div>
                            <span className="text-[9px] font-semibold text-slate-500 block mb-0.5">Floor Level</span>
                            <select
                              value={destCustomFloorId}
                              onChange={e => setDestCustomFloorId(e.target.value)}
                              className="w-full p-1.5 rounded border border-slate-800 bg-slate-900 text-xs text-slate-200 outline-none"
                            >
                              {whFloors.map(f => (
                                <option key={f.id} value={f.id}>{f.name || `Floor ${f.floor_number}`}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <span className="text-[9px] font-semibold text-slate-500 block mb-0.5">Location Name</span>
                            <input
                              type="text"
                              placeholder="e.g. Delivery Dock 2"
                              value={destCustomName}
                              onChange={e => setDestCustomName(e.target.value)}
                              className="w-full p-1.5 rounded border border-slate-800 bg-slate-900 text-xs text-slate-100 placeholder-slate-600 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cargo Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {['NORMAL', 'HIGH', 'URGENT'].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPriority(level as any)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition duration-150 ${
                        priority === level
                          ? 'border-blue-500 bg-blue-600/15 text-slate-50'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Save & Dispatch Task</button>
            </div>
          </form>
        </div>
      )}
      </div>
    </RoleGuard>
  );
}
