'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/supabase/AuthProvider';
import Link from 'next/link';
import { UserPlus, Eye, EyeOff, Lock, Mail, User, ShieldCheck, UserCheck, Bot, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SignupPage() {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER'  | 'OPERATOR'>('OPERATOR');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [bgStyle, setBgStyle] = useState({ transform: 'scale(1.05)', transition: 'transform 0.2s ease-out' });

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const moveX = (clientX / window.innerWidth - 0.5) * 30;
    const moveY = (clientY / window.innerHeight - 0.5) * 30;
    setBgStyle({
      transform: `translate(${moveX}px, ${moveY}px) scale(1.05)`,
      transition: 'transform 0.1s ease-out'
    });
  };

  const rolesList = [
    { value: 'OPERATOR' as const, label: 'AMR Operator', icon: Bot },
    { value: 'MANAGER' as const, label: 'Manager', icon: UserCheck },
    { value: 'ADMIN' as const, label: 'Admin', icon: ShieldCheck },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      await signup(fullName, email, password, role);
      setSignupSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Dynamic Animated Ambient Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
      </div>

      {/* Blurred logo background */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-20">
        <img 
          src="/logo.png" 
          alt="" 
          className="w-full h-full object-cover" 
          style={bgStyle}
        />
        <div className="absolute inset-0 bg-slate-950/60" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-[0_0_50px_rgba(6,182,212,0.1)] backdrop-blur-2xl"
      >
        <div className="flex flex-col items-center text-center">
          <motion.div 
            whileHover={{ scale: 1.08, rotate: -3 }}
            className="relative p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg"
          >
            <img src="/logo.png" alt="Smart Warehouse Logo" className="h-14 w-14 object-contain" />
            <div className="absolute -inset-1 rounded-2xl bg-cyan-500/20 blur opacity-75 pointer-events-none animate-pulse" />
          </motion.div>

          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-100">
            Smart Warehouse Autonomous System
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-400">
            Register for access to fleet controls, telemetry & warehouse tools.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-950/80 p-1 border border-slate-800/80">
          <Link
            href="/login"
            className="flex items-center justify-center py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors rounded-xl"
          >
            Sign In
          </Link>
          <div className="flex items-center justify-center py-2 text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-xl shadow-inner">
            Sign Up
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-400"
            >
              {error}
            </motion.div>
          )}

          {signupSuccess && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5 text-center shadow-lg"
            >
              <ShieldCheck className="h-10 w-10 text-cyan-400 mx-auto mb-2 animate-bounce" />
              <h3 className="text-sm font-bold text-slate-100 mb-1">Registration Request Sent</h3>
              <p className="text-xs text-slate-300 font-medium">
                Your personnel access request is submitted. An administrator will review and activate your account.
              </p>
            </motion.div>
          )}

          {!signupSuccess && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full rounded-xl border border-slate-800/80 bg-slate-950/90 pl-10 pr-4 py-2.5 text-xs font-medium text-slate-100 placeholder-slate-600 outline-none transition duration-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@warehouse.com"
                    className="w-full rounded-xl border border-slate-800/80 bg-slate-950/90 pl-10 pr-4 py-2.5 text-xs font-medium text-slate-100 placeholder-slate-600 outline-none transition duration-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full rounded-xl border border-slate-800/80 bg-slate-950/90 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-100 placeholder-slate-600 outline-none transition duration-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-slate-500" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Desired Role</span>
                  <span className="text-[10px] text-cyan-400 font-semibold">Admin Approval Required</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {rolesList.map((r) => {
                    const isSelected = role === r.value;
                    const IconC = r.icon;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all duration-200 ${
                          isSelected 
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] scale-105' 
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <IconC className={`h-4 w-4 mb-1 ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`} />
                        <span className="text-[10px]">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:bg-cyan-400 hover:shadow-cyan-400/35 disabled:pointer-events-none disabled:opacity-50 mt-4"
              >
                <UserPlus className="h-4 w-4" />
                {loading ? 'Registering Account...' : 'Submit Access Request'}
              </motion.button>
            </>
          )}
        </form>

        <p className="mt-6 text-center text-xs font-medium text-slate-400">
          Already registered?{' '}
          <Link href="/login" className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
            Sign in to your account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

