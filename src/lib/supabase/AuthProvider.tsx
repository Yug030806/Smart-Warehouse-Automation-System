'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

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
    const sessionStr = sessionStorage.getItem('sih_session');
    if (sessionStr) {
      try {
        const sessionObj = JSON.parse(sessionStr);
        setUser(sessionObj);
      } catch (e) {
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
        OPERATOR: 'Cart Operator',
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
    sessionStorage.setItem('sih_session', JSON.stringify(sessionObj));
    setUser(sessionObj);
    router.push('/dashboard');
    return true;
  };

  const signup = async (fullName: string, email: string, password: string, role: 'ADMIN' | 'MANAGER' | 'OPERATOR'): Promise<boolean> => {
    const regUsersStr = localStorage.getItem('sih_registered_users');
    let registeredUsers: RegisteredUser[] = [];
    if (regUsersStr) {
      try {
        registeredUsers = JSON.parse(regUsersStr);
      } catch (e) {
        registeredUsers = [];
      }
    }

    const exists = registeredUsers.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      throw new Error('An account with this email address already exists.');
    }

    const newUser: RegisteredUser = {
      id: `usr-${Date.now()}`,
      fullName,
      email,
      password,
      role,
      is_active: false
    };

    registeredUsers.push(newUser);
    localStorage.setItem('sih_registered_users', JSON.stringify(registeredUsers));

    // Also add to mock database profiles so the user appears on the Users page
    const mockDb = (await import('@/lib/supabase/mockDb')).default;
    mockDb.saveProfile({
      id: newUser.id,
      full_name: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Do NOT automatically log them in, just return true
    return true;
  };

  const logout = () => {
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
