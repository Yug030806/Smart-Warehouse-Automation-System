'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { isRouteAllowed, UserRole } from '@/lib/permissions';
import { ShieldAlert } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const userRole = (user?.user_metadata?.role || 'OPERATOR') as UserRole;

  useEffect(() => {
    if (loading) return;

    let isAllowed = true;
    if (allowedRoles) {
      isAllowed = allowedRoles.includes(userRole);
    } else {
      isAllowed = isRouteAllowed(pathname, userRole);
    }

    if (!isAllowed) {
      setAuthorized(false);
      const timer = setTimeout(() => {
        router.replace('/dashboard');
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setAuthorized(true);
    }
  }, [user, userRole, loading, pathname, allowedRoles, router]);

  if (loading || authorized === null) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-400">Verifying security permissions...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-900/50 bg-red-950/20 p-8 text-center backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-900/30 text-red-400 border border-red-800/40">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-100 mb-2">Access Restricted</h3>
          <p className="text-sm text-slate-400 mb-6">
            Your current role (<span className="font-mono text-amber-400 font-bold uppercase">{userRole}</span>) does not have permission to view this section.
          </p>
          <div className="text-xs text-slate-500 font-mono">Redirecting to Dashboard...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
