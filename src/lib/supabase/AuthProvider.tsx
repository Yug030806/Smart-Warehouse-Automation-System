'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { generateUUID } from '@/lib/uuid';

export interface UserSession {
  id: string;
  email: string;
  user_metadata: {
    full_name: string;
    role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  };
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
}

export interface RegisteredUser {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  is_active: boolean;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, role?: 'ADMIN' | 'MANAGER' | 'OPERATOR', password?: string) => Promise<boolean>;
  signup: (fullName: string, email: string, password: string, role: 'ADMIN' | 'MANAGER' | 'OPERATOR') => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => false,
  signup: async () => false,
  logout: () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const sessionStr = localStorage.getItem('sih_session') || sessionStorage.getItem('sih_session');
    if (sessionStr) {
      try {
        const sessionObj = JSON.parse(sessionStr);
        setUser(sessionObj);
      } catch (e) {
        localStorage.removeItem('sih_session');
        sessionStorage.removeItem('sih_session');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      const publicRoutes = ['/login', '/signup'];
      const isPublic = publicRoutes.includes(pathname);
      if (!user && !isPublic) {
        router.push('/login');
      } else if (user && isPublic) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, role?: 'ADMIN' | 'MANAGER' | 'OPERATOR', password?: string): Promise<boolean> => {
    // Check registered users from localStorage
    const regUsersStr = localStorage.getItem('sih_registered_users');
    let registeredUsers: RegisteredUser[] = [];
    if (regUsersStr) {
      try {
        registeredUsers = JSON.parse(regUsersStr);
      } catch (e) {
        registeredUsers = [];
      }
    }

    const regUser = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    let effectiveRole: 'ADMIN' | 'MANAGER' | 'OPERATOR' = role || 'OPERATOR';
    let fullName = 'Warehouse User';

    if (regUser) {
      if (password && regUser.password && regUser.password !== password) {
        throw new Error('Incorrect password');
      }
      
      // Let's also check the actual mockDb in case an admin activated them there
      const mockDb = (await import('@/lib/supabase/mockDb')).default;
      const profile = mockDb.getProfiles().find(p => p.id === regUser.id);
      
      if (profile && !profile.is_active) {
        throw new Error('Your account is pending admin approval.');
      } else if (!profile && !regUser.is_active) {
        throw new Error('Your account is pending admin approval.');
      }
      
      effectiveRole = regUser.role;
      fullName = regUser.fullName;
    } else {
      const names = {
        ADMIN: 'Super Admin',
        MANAGER: 'Warehouse Manager',
        
        OPERATOR: 'AMR Operator',
      };
      fullName = names[effectiveRole];
    }

    const sessionObj: UserSession = {
      id: regUser ? regUser.id : `u-${effectiveRole.toLowerCase()}`,
      email,
      user_metadata: {
        full_name: fullName,
        role: effectiveRole
      },
      role: effectiveRole
    };
    localStorage.setItem('sih_session', JSON.stringify(sessionObj));
    sessionStorage.setItem('sih_session', JSON.stringify(sessionObj));
    setUser(sessionObj);
    router.push('/dashboard');
    return true;
  };

  const signup = async (fullName: string, email: string, password: string, role: 'ADMIN' | 'MANAGER' | 'OPERATOR'): Promise<boolean> => {
    // Check if user already exists in profiles
    const { supabase } = await import('@/lib/supabase/client');
    const existingRes = await supabase.from('profiles').select('id').eq('email', email.toLowerCase());
    if (existingRes.data && existingRes.data.length > 0) {
      throw new Error('An account with this email address already exists.');
    }

    const regUsersStr = localStorage.getItem('sih_registered_users');
    let registeredUsers: RegisteredUser[] = [];
    if (regUsersStr) {
      try {
        registeredUsers = JSON.parse(regUsersStr);
      } catch (e) {
        registeredUsers = [];
      }
    }

    const newId = generateUUID();
    const newUser: RegisteredUser = {
      id: newId,
      fullName,
      email,
      password,
      role,
      is_active: false
    };

    registeredUsers.push(newUser);
    localStorage.setItem('sih_registered_users', JSON.stringify(registeredUsers));

    // Persist pending profile directly to live Supabase DB
    await supabase.from('profiles').insert({
      id: newId,
      full_name: fullName,
      email: email.toLowerCase(),
      role,
      assigned_warehouse_ids: [],
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Create Admin In-App Alert Notification for pending signup
    await supabase.from('alerts').insert({
      id: `alt-${Date.now()}`,
      type: 'SYSTEM_ERROR',
      severity: 'WARNING',
      message: `Pending Registration: New user ${fullName} (${email}) requested ${role} access. Approval required.`,
      is_acknowledged: false,
      created_at: new Date().toISOString()
    });

    const mockDb = (await import('@/lib/supabase/mockDb')).default;
    mockDb.saveProfile({
      id: newUser.id,
      full_name: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      assigned_warehouse_ids: [],
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return true;
  };

  const logout = () => {
    localStorage.removeItem('sih_session');
    sessionStorage.removeItem('sih_session');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
