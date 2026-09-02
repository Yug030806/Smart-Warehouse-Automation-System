'use client';

import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  colorClass?: string;
}

export default function KpiCard({ title, value, subtitle, icon: Icon, colorClass = 'text-cyan-400' }: KpiCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="relative group rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 flex items-center justify-between shadow-xl hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] transition-all duration-300 overflow-hidden"
    >
      {/* Background Subtle Gradient Glow */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all duration-500 pointer-events-none" />

      <div className="space-y-1 z-10">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          {title}
        </span>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
      </div>

      <div className={`h-12 w-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:border-cyan-500/30 transition-all duration-300 z-10 ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
    </motion.div>
  );
}

