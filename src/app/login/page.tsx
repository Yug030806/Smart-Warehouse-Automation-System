'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/supabase/AuthProvider';
import { Shield, KeyRound, UserCheck, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER' | null>(null);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const credentials = [
    { label: 'Admin Access', role: 'ADMIN' as const, email: 'admin@demo.com', pass: 'admin123' },
    { label: 'Manager Access', role: 'MANAGER' as const, email: 'manager@demo.com', pass: 'manager123' },
    { label: 'Operator Access', role: 'OPERATOR' as const, email: 'operator@demo.com', pass: 'operator123' },
    { label: 'Viewer Access', role: 'VIEWER' as const, email: 'viewer@demo.com', pass: 'viewer123' }
  ];

  const handleQuickSelect = (item: typeof credentials[number]) => {
    setSelectedRole(item.role);
    setEmail(item.email);
    setPassword(item.pass);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields or select a quick credentials role.');
      return;
    }
    setLoading(true);
    setError('');

    // Check pre-loaded credentials matching
    const matchingCred = credentials.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (matchingCred && password === matchingCred.pass) {
      await login(email, matchingCred.role);
    } else {
      setError('Invalid email or password. Use the quick role selection buttons.');
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 overflow-hidden">
      {/* Blurred logo background */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <img src="/logo.png" alt="" className="w-full h-full object-cover opacity-40 blur-sm scale-105" />
        <div className="absolute inset-0 bg-slate-955/50"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-800/80 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Smart Warehouse Logo" className="h-24 w-24 object-contain rounded-2xl" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-100">
            Smart Warehouse Logistics
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Autonomous fleet operation, route calculation, and tracking platform.
          </p>
        </div>

        {/* Demo Roles Quick Select Buttons */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Demo User Credentials Profiles</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {credentials.map((cred) => (
              <button
                key={cred.role}
                type="button"
                onClick={() => handleQuickSelect(cred)}
                className={`flex flex-col items-start justify-between rounded-xl border p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                  selectedRole === cred.role
                    ? 'border-blue-500 bg-blue-600/10 shadow-blue-500/10'
                    : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
              >
                <span className="text-sm font-semibold">{cred.label}</span>
                <span className="mt-1 text-[11px] text-slate-500 font-mono select-all">{cred.email}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-3 text-slate-500 font-semibold tracking-widest">or sign in manually</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSelectedRole(null); }}
              placeholder="e.g. manager@demo.com"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 shadow-inner outline-none transition duration-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setSelectedRole(null); }}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-4 pr-10 py-3 text-sm text-slate-100 placeholder-slate-600 shadow-inner outline-none transition duration-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-slate-100 shadow-lg shadow-blue-600/20 transition-all duration-200 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/25 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {loading ? 'Validating credentials...' : 'Enter Console'}
          </button>
        </form>
      </div>
    </div>
  );
}
