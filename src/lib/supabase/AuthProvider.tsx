'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface UserSession {
  id: string;
  email: string;
  user_metadata: {
    full_name: string;
    role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  };
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER') => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => false,
  logout: () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const sessionStr = localStorage.getItem('sih_session');
    if (sessionStr) {
      try {
        const sessionObj = JSON.parse(sessionStr);
        setUser(sessionObj);
      } catch (e) {
        localStorage.removeItem('sih_session');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      const publicRoutes = ['/login'];
      const isPublic = publicRoutes.includes(pathname);
      if (!user && !isPublic) {
        router.push('/login');
      } else if (user && isPublic) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER'): Promise<boolean> => {
    const names = {
      ADMIN: 'Super Admin',
      MANAGER: 'Warehouse Manager',
      OPERATOR: 'Cart Operator',
      VIEWER: 'Auditor Viewer'
    };
    const sessionObj: UserSession = {
      id: `u-${role.toLowerCase()}`,
      email,
      user_metadata: {
        full_name: names[role],
        role
      },
      role
    };
    localStorage.setItem('sih_session', JSON.stringify(sessionObj));
    setUser(sessionObj);
    router.push('/dashboard');
    return true;
  };

  const logout = () => {
    localStorage.removeItem('sih_session');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
