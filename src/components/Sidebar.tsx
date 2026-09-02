'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { usePreventScroll } from '@/lib/usePreventScroll';
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
  Warehouse,
  X,
  ClipboardCheck,
  Brain
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const userRole = user?.user_metadata?.role || 'OPERATOR';

  usePreventScroll(mobileOpen);

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'Warehouses', href: '/warehouses', icon: Warehouse, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Boxes Management', href: '/boxes', icon: Boxes, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'Vehicles', href: '/vehicles', icon: Truck, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'Transportation Tasks', href: '/tasks', icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'Live Map Tracking', href: '/tracking', icon: Map, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'QR Scan Console', href: '/scanner', icon: ScanQrCode, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'System Analytics', href: '/analytics', icon: BarChart3, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'Active Alerts', href: '/alerts', icon: AlertTriangle, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'Audit Logs', href: '/audit-log', icon: History, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
    { name: 'User Management', href: '/users', icon: Users, roles: ['ADMIN'] },
    { name: 'System Settings', href: '/settings', icon: Settings, roles: ['ADMIN', 'MANAGER'] },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden transition-opacity overscroll-none touch-none"
          onClick={onMobileClose}
          onWheel={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
        />
      )}

      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-slate-800/80 bg-slate-950/80 backdrop-blur-2xl flex flex-col h-screen transition-transform duration-300 ease-in-out md:translate-x-0 overscroll-contain ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <Link 
            href="/dashboard" 
            onClick={onMobileClose}
            className="flex items-center gap-3 font-bold text-slate-100 text-base tracking-wider flex-1 min-w-0 pr-2 group"
          >
            <div className="relative shrink-0">
              <img src="/logo.png" alt="Smart Warehouse Logo" className="h-10 w-10 object-contain rounded-xl group-hover:scale-105 transition-transform duration-200" />
              <div className="absolute -inset-0.5 rounded-xl bg-cyan-500/20 blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-extrabold truncate text-slate-100 tracking-tight">Smart Warehouse</span>
              <span className="text-[9px] text-cyan-400 font-bold tracking-widest uppercase truncate flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-cyan-400 animate-ping" />
                Logistics OS
              </span>
            </div>
          </Link>
          <button 
            onClick={onMobileClose}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 shrink-0 transition-colors"
            aria-label="Close Sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto overscroll-contain">
          {menuItems.map((item) => {
            if (!item.roles.includes(userRole)) return null;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onMobileClose}
                className={`relative flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 hover:translate-x-1'
                }`}
              >
                {/* Glowing Left Indicator */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-cyan-400 shadow-[0_0_10px_#38bdf8]" />
                )}
                
                <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span className="truncate tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Profile summary footer card */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/80">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-blue-400 border border-slate-700 shrink-0">
              {user?.user_metadata?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-xs font-semibold text-slate-200 truncate">{user?.user_metadata?.full_name}</h4>
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 truncate block">{userRole}</span>
            </div>
          </div>
          <button
            onClick={() => {
              if (onMobileClose) onMobileClose();
              logout();
            }}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/50 text-xs font-semibold text-red-400 hover:bg-red-950/20 hover:border-red-950/30 transition-all duration-150"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Exit Session</span>
          </button>
        </div>
      </aside>
    </>
  );
}

