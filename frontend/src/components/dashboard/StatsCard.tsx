import { memo } from 'react';

export type StatsCardVariant = 'income' | 'growth' | 'warning' | 'neutral';

const ring: Record<StatsCardVariant, string> = {
  income: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white',
  growth: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-white',
  warning: 'border-rose-200/80 bg-gradient-to-br from-rose-50 to-white',
  neutral: 'border-slate-200/80 bg-white'
};

const labelCls: Record<StatsCardVariant, string> = {
  income: 'text-emerald-800',
  growth: 'text-sky-800',
  warning: 'text-rose-800',
  neutral: 'text-slate-500'
};

const valueCls: Record<StatsCardVariant, string> = {
  income: 'text-emerald-950',
  growth: 'text-sky-950',
  warning: 'text-rose-950',
  neutral: 'text-slate-900'
};

export type StatsCardProps = {
  /** Primary label (premium dashboard). */
  title?: string;
  /** Alias for `title` (network grid). */
  label?: string;
  value: string;
  hint?: string;
  variant?: StatsCardVariant;
  /** Tailwind classes for the value, e.g. `text-green-600` — overrides variant value color when set. */
  color?: string;
};

function StatsCardInner({ title, label, value, hint, variant = 'neutral', color }: StatsCardProps) {
  const displayLabel = (label ?? title ?? '').trim();
  const valueColor = color ?? valueCls[variant];
  return (
    <div className={`rounded-2xl border p-5 shadow-md ${ring[variant]}`}>
      <p className={`text-sm font-medium ${labelCls[variant]}`}>{displayLabel}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums sm:text-3xl ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default memo(StatsCardInner);
