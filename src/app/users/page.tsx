'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import AmbientBackground from '@/components/AmbientBackground';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { usePreventScroll } from '@/lib/usePreventScroll';
import { Plus, Search, Shield, UserCheck, Trash2, ShieldAlert } from 'lucide-react';
import { Profile, Warehouse } from '@/lib/database.types';

export default function UsersPage() {
  const { user } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';
  const [users, setUsers] = useState<Profile[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Add User states
  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'OPERATOR'>('OPERATOR');
  const [assignedWarehouses, setAssignedWarehouses] = useState<string[]>([]);

  // Edit User states
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'MANAGER' | 'OPERATOR'>('OPERATOR');
  const [editAssignedWarehouses, setEditAssignedWarehouses] = useState<string[]>([]);

  usePreventScroll(Boolean(editingUser || showAddModal));

  const loadData = async () => {
    try {
      const regUsersStr = localStorage.getItem('sih_registered_users');
      if (regUsersStr) {
        const regUsers = JSON.parse(regUsersStr) as Array<{ id: string; fullName: string; email: string; role: string }>;
        const existingRes = await supabase.from('profiles').select();
        const existingProfiles = (existingRes.data || []) as Profile[];
        const existingIds = new Set(existingProfiles.map(p => p.id));
        const existingEmails = new Set(existingProfiles.map(p => p.email.toLowerCase()));
        
        for (const ru of regUsers) {
          if (!existingIds.has(ru.id) && !existingEmails.has(ru.email.toLowerCase())) {
            await supabase.from('profiles').insert({
              id: ru.id,
              full_name: ru.fullName,
              email: ru.email,
              role: ru.role,
              is_active: false,
              assigned_warehouse_ids: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {}

    const res = await supabase.from('profiles').select();
    const list = res.data || [];
    setUsers((list as Profile[]).map(p => ({ ...p })));

    const wRes = await supabase.from('warehouses').select();
    const wList = wRes.data || [];
    setWarehouses(wList as Warehouse[]);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;

    const newId = typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0')}`;
    const newProfile: Profile = {
      id: newId,
      full_name: name,
      email,
      role,
      assigned_warehouse_ids: ['MANAGER'].includes(role) ? assignedWarehouses : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    };

    await supabase.from('profiles').insert(newProfile);
    setShowAddModal(false);
    setEmail('');
    setName('');
    setAssignedWarehouses([]);
    await loadData();
  };

  const handleDeactivate = async (id: string, currentStatus: boolean, profileRole: string) => {
    if (!currentStatus && ['MANAGER'].includes(profileRole)) {
      // If approving a manager, force them to go through the edit modal to assign warehouses
      const u = users.find(x => x.id === id);
      if (u) {
        setEditingUser(u);
        setEditName(u.full_name);
        setEditRole(u.role as any);
        setEditAssignedWarehouses(u.assigned_warehouse_ids || []);
      }
      return;
    }

    await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', id);

    const mockDb = require('@/lib/supabase/mockDb').default;
    const profile = mockDb.getProfiles().find((p: any) => p.id === id);
    if (profile) {
      mockDb.saveProfile({ ...profile, is_active: !currentStatus });
    }

    try {
      const regUsersStr = localStorage.getItem('sih_registered_users');
      if (regUsersStr) {
        const regUsers = JSON.parse(regUsersStr);
        const updated = regUsers.map((u: any) => u.id === id ? { ...u, is_active: !currentStatus } : u);
        localStorage.setItem('sih_registered_users', JSON.stringify(updated));
      }
    } catch (e) { /* ignore */ }

    await loadData();
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editName) return;

    const updates: any = {
      full_name: editName,
      role: editRole,
    };
    
    // Always activate if saving from edit modal when pending
    if (!editingUser.is_active) {
      updates.is_active = true;
      try {
        const regUsersStr = localStorage.getItem('sih_registered_users');
        if (regUsersStr) {
          const regUsers = JSON.parse(regUsersStr);
          const updated = regUsers.map((u: any) => u.id === editingUser.id ? { ...u, is_active: true } : u);
          localStorage.setItem('sih_registered_users', JSON.stringify(updated));
        }
      } catch (e) {}
    }

    if (['MANAGER'].includes(editRole)) {
      updates.assigned_warehouse_ids = editAssignedWarehouses;
    } else {
      updates.assigned_warehouse_ids = [];
    }

    await supabase.from('profiles').update(updates).eq('id', editingUser.id);

    setEditingUser(null);
    await loadData();
  };

  const handleDeleteUser = (id: string) => {
    const mockDb = require('@/lib/supabase/mockDb').default;
    mockDb.deleteProfile(id);
    try {
      const regUsersStr = localStorage.getItem('sih_registered_users');
      if (regUsersStr) {
        const regUsers = JSON.parse(regUsersStr);
        const filtered = regUsers.filter((u: any) => u.id !== id);
        localStorage.setItem('sih_registered_users', JSON.stringify(filtered));
      }
    } catch (e) {}
    loadData();
  };

  // Filter users based on search and roles
  const filtered = users.filter(u => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
    
    // Managers can't see Admins
    if (userRole === 'MANAGER' && u.role === 'ADMIN') return false;
    
    return matchesSearch;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="flex h-screen w-full overflow-hidden bg-slate-950 relative">
        <AmbientBackground intensity="low" />
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
          <Navbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto flex-1 overscroll-contain">
          {!['ADMIN', 'MANAGER'].includes(userRole) ? (
            <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-12 text-center text-slate-400 space-y-4 max-w-lg mx-auto mt-12">
              <ShieldAlert className="h-16 w-16 text-red-500 mx-auto" />
              <h2 className="text-xl font-bold text-slate-100">Access Restricted</h2>
              <p className="text-xs text-slate-400">User Management is limited to Admin and Manager roles.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-100">User & Permission Settings</h1>
                  <p className="text-xs sm:text-sm text-slate-400">Control system logins access permissions, role groups, and operational active statuses.</p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-slate-50 transition duration-150 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Add User Profile
                </button>
              </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search user profile name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-100 outline-none focus:border-blue-500"
            />
          </div>

          <div className="rounded-xl border border-slate-900 bg-slate-950 p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Email Address</th>
                    <th className="pb-3">Role Group</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-slate-300">
                  {filtered.map(u => (
                    <tr key={u.id}>
                      <td className="py-4 font-semibold text-slate-100">{u.full_name}</td>
                      <td className="py-4 font-mono text-slate-400">{u.email}</td>
                      <td className="py-4">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                          <Shield className="h-3.5 w-3.5 text-blue-500" /> {u.role}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.is_active ? 'bg-green-950 text-green-400' : 'bg-orange-950 text-orange-400'
                        }`}>{u.is_active ? 'ACTIVE' : 'PENDING APPROVAL'}</span>
                      </td>
                      <td className="py-4 text-right space-x-3">
                        <button
                          onClick={() => { setEditingUser(u); setEditName(u.full_name); setEditRole(u.role as any); setEditAssignedWarehouses(u.assigned_warehouse_ids || []); }}
                          className="text-xs text-slate-300 hover:text-slate-100 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivate(u.id, u.is_active, u.role)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          {u.is_active ? 'Deactivate' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </main>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleEditUserSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Edit User Profile ({editingUser.email})</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Role Group Permission</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400 outline-none"
                >
                  {userRole === 'ADMIN' && <option value="ADMIN">ADMIN</option>}
                  <option value="MANAGER">MANAGER</option>

                  <option value="OPERATOR">OPERATOR</option>
                </select>
              </div>

              {['MANAGER'].includes(editRole) && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Warehouses</label>
                  <div className="space-y-1 mt-1 max-h-32 overflow-y-auto border border-slate-800 rounded-lg p-2 bg-slate-950/50">
                    {warehouses.map(w => (
                      <label key={w.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-1 hover:bg-slate-800 rounded">
                        <input
                          type="checkbox"
                          checked={editAssignedWarehouses.includes(w.id)}
                          onChange={(e) => {
                            if (e.target.checked) setEditAssignedWarehouses([...editAssignedWarehouses, w.id]);
                            else setEditAssignedWarehouses(editAssignedWarehouses.filter(id => id !== w.id));
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                        />
                        {w.name}
                      </label>
                    ))}
                    {warehouses.length === 0 && <span className="text-slate-500 text-xs italic">No warehouses available.</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">{!editingUser.is_active ? 'Approve & Save' : 'Update Profile'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { const cancelBtn = Array.from((e.target as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.match(/cancel|close/i) || b.querySelector('svg.lucide-x')); if (cancelBtn) (cancelBtn as HTMLButtonElement).click(); } }}>
          <form onSubmit={handleAddUserSubmit} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Add User Profile</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. user@demo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Role Group Permission</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400 outline-none"
                >
                  {userRole === 'ADMIN' && <option value="ADMIN">ADMIN</option>}
                  <option value="MANAGER">MANAGER</option>

                  <option value="OPERATOR">OPERATOR</option>
                </select>
              </div>

              {['MANAGER'].includes(role) && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Warehouses</label>
                  <div className="space-y-1 mt-1 max-h-32 overflow-y-auto border border-slate-800 rounded-lg p-2 bg-slate-950/50">
                    {warehouses.map(w => (
                      <label key={w.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer p-1 hover:bg-slate-800 rounded">
                        <input
                          type="checkbox"
                          checked={assignedWarehouses.includes(w.id)}
                          onChange={(e) => {
                            if (e.target.checked) setAssignedWarehouses([...assignedWarehouses, w.id]);
                            else setAssignedWarehouses(assignedWarehouses.filter(id => id !== w.id));
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-600"
                        />
                        {w.name}
                      </label>
                    ))}
                    {warehouses.length === 0 && <span className="text-slate-500 text-xs italic">No warehouses available.</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Save Profile</button>
            </div>
          </form>
        </div>
      )}
      </div>
    </RoleGuard>
  );
}
