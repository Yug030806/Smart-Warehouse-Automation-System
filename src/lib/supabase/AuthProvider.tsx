'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
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

  // Sync session from real Supabase Auth on mount & track auth state changes
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          // Fetch profile to get real role and active status
          const { data: rawProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const profile = Array.isArray(rawProfile) ? (rawProfile.find(p => p.id === session.user.id) || rawProfile[0]) : rawProfile;

          if (profile && profile.is_active === false) {
            await supabase.auth.signOut();
            localStorage.removeItem('sih_session');
            sessionStorage.removeItem('sih_session');
            if (isMounted) setUser(null);
            return;
          }

          const role = (profile?.role || session.user.user_metadata?.role || 'OPERATOR') as 'ADMIN' | 'MANAGER' | 'OPERATOR';
          const fullName = profile?.full_name || session.user.user_metadata?.full_name || 'Warehouse User';

          const sessionObj: UserSession = {
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: {
              full_name: fullName,
              role
            },
            role
          };

          localStorage.setItem('sih_session', JSON.stringify(sessionObj));
          if (isMounted) setUser(sessionObj);
        } else if (isMounted) {
          // Fallback to stored session if present
          const sessionStr = localStorage.getItem('sih_session') || sessionStorage.getItem('sih_session');
          if (sessionStr) {
            try {
              setUser(JSON.parse(sessionStr));
            } catch {
              localStorage.removeItem('sih_session');
              sessionStorage.removeItem('sih_session');
            }
          }
        }
      } catch (err) {
        console.error('Error initializing Supabase Auth session:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        localStorage.removeItem('sih_session');
        sessionStorage.removeItem('sih_session');
        setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const { data: rawProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const profile = Array.isArray(rawProfile) ? (rawProfile.find(p => p.id === session.user.id) || rawProfile[0]) : rawProfile;

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          localStorage.removeItem('sih_session');
          sessionStorage.removeItem('sih_session');
          setUser(null);
          return;
        }

        const role = (profile?.role || session.user.user_metadata?.role || 'OPERATOR') as 'ADMIN' | 'MANAGER' | 'OPERATOR';
        const fullName = profile?.full_name || session.user.user_metadata?.full_name || 'Warehouse User';

        const sessionObj: UserSession = {
          id: session.user.id,
          email: session.user.email || '',
          user_metadata: {
            full_name: fullName,
            role
          },
          role
        };

        localStorage.setItem('sih_session', JSON.stringify(sessionObj));
        setUser(sessionObj);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
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
    if (!email) throw new Error('Please enter an email address.');
    const trimmedEmail = email.trim().toLowerCase();

    // 1. Authenticate with real Supabase Auth
    if (password) {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Sign in failed. No user returned.');
      }

      // Check profile status under RLS
      const { data: rawProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      const profile = Array.isArray(rawProfile) ? (rawProfile.find(p => p.id === authData.user.id) || rawProfile[0]) : rawProfile;

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('Your account is pending admin approval.');
      }

      const effectiveRole: 'ADMIN' | 'MANAGER' | 'OPERATOR' = (profile?.role || authData.user.user_metadata?.role || role || 'OPERATOR') as any;
      const fullName = profile?.full_name || authData.user.user_metadata?.full_name || 'Warehouse User';

      const sessionObj: UserSession = {
        id: authData.user.id,
        email: authData.user.email || trimmedEmail,
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
    }

    throw new Error('Password is required for authentication.');
  };

  const signup = async (fullName: string, email: string, password: string, role: 'ADMIN' | 'MANAGER' | 'OPERATOR'): Promise<boolean> => {
    const trimmedEmail = email.trim().toLowerCase();

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email: trimmedEmail, password, role })
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || 'Failed to submit registration request.');
    }

    return true;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error signing out:', e);
    }
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
