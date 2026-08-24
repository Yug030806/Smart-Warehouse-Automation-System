'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { History, Search, Terminal } from 'lucide-react';
import { AuditLog } from '@/lib/database.types';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = () => {
    const list = supabase.from('audit_logs').select().data || [];
    setLogs(list as AuditLog[]);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter(log => {
    const term = searchQuery.toLowerCase();
    return log.action.toLowerCase().includes(term) ||
           log.user_email.toLowerCase().includes(term) ||
           log.object_type.toLowerCase().includes(term);
  });

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-grow flex flex-col min-w-0">
        <Navbar />

        <main className="p-8 space-y-8 overflow-y-auto flex-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Security Audit Logs</h1>
            <p className="text-sm text-slate-400">Track user log in logins, task dispatches, settings adjustments and database transactions.</p>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search actions, emails..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-100 outline-none focus:border-blue-500"
            />
          </div>

          <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3">Timestamp</th>
                    <th className="pb-3">Operator User</th>
                    <th className="pb-3">Action Type</th>
                    <th className="pb-3">Object Category</th>
                    <th className="pb-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-slate-300">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">No audit log trail entries found.</td>
                    </tr>
                  ) : (
                    filtered.map(log => (
                      <tr key={log.id} className="hover:bg-slate-900/10">
                        <td className="py-4 font-mono text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="py-4 font-semibold text-slate-300">{log.user_email}</td>
                        <td className="py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-800">{log.action}</span>
                        </td>
                        <td className="py-4 font-bold text-slate-400">{log.object_type}</td>
                        <td className="py-4 text-right">
                          <span className="text-[10px] text-slate-500 font-mono block max-w-xs truncate ml-auto">
                            {JSON.stringify(log.new_state || {})}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
