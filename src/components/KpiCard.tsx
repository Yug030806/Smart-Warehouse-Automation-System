import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  colorClass?: string;
}

export default function KpiCard({ title, value, subtitle, icon: Icon, colorClass = 'text-blue-500' }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 flex items-center justify-between shadow-lg">
      <div className="space-y-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{title}</span>
        <h3 className="text-2xl font-bold text-slate-100">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
      </div>
      <div className={`h-12 w-12 rounded-xl bg-slate-900/50 flex items-center justify-center border border-slate-800 ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
