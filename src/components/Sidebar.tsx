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
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-slate-800/80 bg-slate-950/40 backdrop-blur-md flex flex-col h-screen transition-transform duration-300 ease-in-out md:translate-x-0 overscroll-contain relative overflow-hidden ${
          mobileOpen ? 'translate-x-0 shadow-2xl flex' : '-translate-x-full hidden md:flex'
        }`}
      >
        {/* AMR Warehouse Background Image */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-75"
          style={{ backgroundImage: "url('/amr-bg.jpg')" }}
        />
        {/* Light tint overlay so background image details are clearly visible */}
        <div className="absolute inset-0 z-0 bg-slate-950/40 pointer-events-none" />
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between relative z-10">
          <Link 
            href="/dashboard" 
            onClick={onMobileClose}
            className="flex items-center gap-3 font-bold text-slate-100 text-base tracking-wider flex-1 min-w-0 pr-2 group"
          >
            <div className="relative shrink-0">
              <img src="/logo.jpg" alt="Smart Warehouse Logo" className="h-10 w-10 object-contain rounded-xl group-hover:scale-105 transition-transform duration-200" />
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

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto overscroll-contain relative z-10">
          {menuItems.map((item) => {
            if (!item.roles.includes(userRole)) return null;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onMobileClose}
                className={`relative flex items-center gap-3 px-4 py-3 text-xs font-extrabold rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.25)] backdrop-blur-md' 
                    : 'text-slate-100 bg-slate-950/40 border border-slate-800/40 hover:text-white hover:bg-slate-900/80 hover:border-slate-700 hover:translate-x-1 shadow-sm'
                }`}
              >
                {/* Glowing Left Indicator */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full bg-cyan-400 shadow-[0_0_12px_#38bdf8]" />
                )}
                
                <item.icon className={`h-4.5 w-4.5 shrink-0 stroke-[2.5] transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'text-slate-200 group-hover:text-white'}`} />
                <span className="truncate tracking-wide drop-shadow-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Profile summary footer card */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center font-extrabold text-blue-400 border border-slate-700 shrink-0 shadow-md">
              {user?.user_metadata?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-xs font-extrabold text-slate-100 truncate">{user?.user_metadata?.full_name}</h4>
              <span className="text-[10px] uppercase font-mono font-extrabold tracking-widest text-slate-300 truncate block">{userRole}</span>
            </div>
          </div>
          <button
            onClick={() => {
              if (onMobileClose) onMobileClose();
              logout();
            }}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-950/40 text-xs font-extrabold text-red-300 hover:bg-red-900/60 hover:text-white transition-all duration-150 shadow-sm"
          >
            <LogOut className="h-4 w-4 stroke-[2.5]" />
            <span>Exit Session</span>
          </button>
        </div>
      </aside>
    </>
  );
}

