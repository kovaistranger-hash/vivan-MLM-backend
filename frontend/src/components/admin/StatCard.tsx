type StatCardProps = {
  title: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'emerald' | 'amber' | 'slate';
};

const toneClass: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'border-slate-200 bg-white',
  emerald: 'border-emerald-200 bg-emerald-50/70',
  amber: 'border-amber-200 bg-amber-50/70',
  slate: 'border-slate-200 bg-slate-50/80'
};

export default function StatCard({ title, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClass[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
