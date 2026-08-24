'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { Plus, Search, Shield, UserCheck, Trash2 } from 'lucide-react';
import { Profile } from '@/lib/database.types';

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Add User states
  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER'>('VIEWER');

  const loadUsers = () => {
    const list = supabase.from('profiles').select().data || [];
    setUsers(list as Profile[]);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;

    const newProfile: Profile = {
      id: `u-${role.toLowerCase()}-${Date.now().toString().substring(8)}`,
      full_name: name,
      email,
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    };

    supabase.from('profiles').insert(newProfile);
    setShowAddModal(false);
    setEmail('');
    setName('');
    loadUsers();
  };

  const handleDeactivate = (id: string, currentStatus: boolean) => {
    supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', id);
    loadUsers();
  };

  const filtered = users.filter(u => {
    const term = searchQuery.toLowerCase();
    return u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-grow flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-8 overflow-y-auto flex-1">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">User & Permission Settings</h1>
              <p className="text-sm text-slate-400">Control system logins access permissions, role groups, and operational active statuses.</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-slate-50 transition duration-150"
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
                          u.is_active ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'
                        }`}>{u.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleDeactivate(u.id, u.is_active)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm">
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
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
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
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Role Group Permission</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-50 bg-blue-600 rounded-lg">Save Profile</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
