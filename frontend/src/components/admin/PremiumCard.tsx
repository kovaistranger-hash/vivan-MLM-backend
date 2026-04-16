const accents = {
  violet: 'from-violet-500 via-fuchsia-500 to-indigo-500',
  amber: 'from-amber-400 via-orange-400 to-rose-400',
  emerald: 'from-emerald-400 via-teal-400 to-cyan-500',
  slate: 'from-slate-400 via-slate-500 to-slate-600'
} as const;

export type PremiumCardAccent = keyof typeof accents;

type PremiumCardProps = {
  title: string;
  /** Pre-formatted display string (e.g. ₹12,345 or 12.3%) */
  value: string;
  /** Optional % change vs prior period (positive = green) */
  change?: number | null;
  accent?: PremiumCardAccent;
};

export default function PremiumCard({ title, value, change, accent = 'violet' }: PremiumCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/90 p-5 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/60 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-200/30">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90 ${accents[accent]}`}
      />
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
      <h2 className="mt-3 bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent tabular-nums">
        {value}
      </h2>
      {change != null && Number.isFinite(change) ? (
        <p
          className={`mt-2 text-sm font-semibold tabular-nums ${
            change > 0 ? 'text-emerald-600' : change < 0 ? 'text-rose-600' : 'text-slate-500'
          }`}
        >
          {change > 0 ? '+' : ''}
          {change.toFixed(1)}%
        </p>
      ) : null}
    </div>
  );
}
