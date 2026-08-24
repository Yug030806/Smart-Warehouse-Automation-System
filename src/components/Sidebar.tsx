'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { 
  LayoutDashboard, 
  Boxes, 
  Truck, 
  ClipboardList, 
  Map, 
  ScanQrCode, 
  BarChart3, 
  AlertTriangle, 
  History, 
  Users, 
  Settings, 
  LogOut,
  Warehouse
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const userRole = user?.user_metadata?.role || 'VIEWER';

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] },
    { name: 'Warehouses', href: '/warehouses', icon: Warehouse, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Boxes Management', href: '/boxes', icon: Boxes, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'Vehicles', href: '/vehicles', icon: Truck, roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] },
    { name: 'Transportation Tasks', href: '/tasks', icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] },
    { name: 'Live Map Tracking', href: '/tracking', icon: Map, roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] },
    { name: 'QR Scan Console', href: '/scanner', icon: ScanQrCode, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'System Analytics', href: '/analytics', icon: BarChart3, roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] },
    { name: 'Active Alerts', href: '/alerts', icon: AlertTriangle, roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] },
    { name: 'Audit Logs', href: '/audit-log', icon: History, roles: ['ADMIN', 'MANAGER', 'VIEWER'] },
    { name: 'User Management', href: '/users', icon: Users, roles: ['ADMIN'] },
    { name: 'System Settings', href: '/settings', icon: Settings, roles: ['ADMIN', 'MANAGER'] },
  ];

  return (
    <aside className="w-64 border-r border-slate-900 bg-slate-950 flex flex-col min-h-screen">
      <div className="p-5 border-b border-slate-900">
        <Link href="/dashboard" className="flex items-center gap-3 font-bold text-slate-100 text-base tracking-wider">
          <img src="/logo.png" alt="Smart Warehouse Logo" className="h-10 w-10 object-contain rounded-lg" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-extrabold">Smart Warehouse</span>
            <span className="text-[9px] text-slate-500 font-semibold tracking-widest uppercase">Logistics Platform</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          if (!item.roles.includes(userRole)) return null;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-150 ${
                isActive 
                  ? 'bg-blue-600 text-slate-50' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Profile summary footer card */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/80">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-blue-400 border border-slate-700">
            {user?.user_metadata?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-semibold text-slate-200 truncate">{user?.user_metadata?.full_name}</h4>
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500">{userRole}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/50 text-xs font-semibold text-red-400 hover:bg-red-950/20 hover:border-red-950/30 transition-all duration-150"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Exit Session</span>
        </button>
      </div>
    </aside>
  );
}
