'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { KeyRound, Eye, EyeOff, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const credentials = [
    { role: 'ADMIN' as const, email: 'admin@demo.com', pass: 'admin123' },
    { role: 'MANAGER' as const, email: 'manager@demo.com', pass: 'manager123' },
    { role: 'OPERATOR' as const, email: 'operator@demo.com', pass: 'operator123' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email address and password.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Check matching credentials from predefined list first
      const matchingCred = credentials.find(c => c.email.toLowerCase() === email.toLowerCase());
      if (matchingCred && password === matchingCred.pass) {
        await login(email, matchingCred.role, password);
      } else if (email.includes('@')) {
        const role = email.toLowerCase().includes('admin')
          ? 'ADMIN'
          : email.toLowerCase().includes('manager')
          ? 'MANAGER'
          : 'OPERATOR';
        await login(email, role, password);
      } else {
        setError('Invalid login credentials. Please check your email and password.');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid login credentials. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 overflow-hidden">
      {/* Blurred logo background */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <img src="/logo.png" alt="" className="w-full h-full object-cover opacity-40 blur-sm scale-105" />
        <div className="absolute inset-0 bg-slate-955/50"></div>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Smart Warehouse Logo" className="h-16 w-16 object-contain rounded-2xl" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-100">
            Smart Warehouse Logistics
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Autonomous fleet operation, route calculation, and tracking platform.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-950/60 p-1 border border-slate-800/60">
          <div className="flex items-center justify-center py-2 text-xs font-semibold text-blue-400 bg-slate-800/90 rounded-lg shadow-sm">
            Sign In
          </div>
          <a
            href="/signup"
            className="flex items-center justify-center py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors rounded-lg"
          >
            Sign Up
          </a>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-3 text-xs text-slate-100 placeholder-slate-600 outline-none transition duration-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-10 py-3 text-xs text-slate-100 placeholder-slate-600 outline-none transition duration-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-slate-100 shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 mt-2"
          >
            <KeyRound className="h-4 w-4" />
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          New user?{' '}
          <a href="/signup" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}
