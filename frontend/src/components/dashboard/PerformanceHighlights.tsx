import { memo, useMemo } from 'react';
import { Award, Flame, Sparkles, TrendingUp } from 'lucide-react';
import type { IncomeChartPoint } from './IncomeChart';

type Props = {
  chartSeries: IncomeChartPoint[];
  totalBinaryIncome: number;
  teamDirects: number;
};

function formatInr(n: number) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function PerformanceHighlightsInner({ chartSeries, totalBinaryIncome, teamDirects }: Props) {
  const { bestDay, bestDate, last7Sum } = useMemo(() => {
    let best = 0;
    let bestD = '';
    for (const p of chartSeries) {
      const v = Number(p.income ?? 0);
      if (v > best) {
        best = v;
        bestD = p.date;
      }
    }
    const tail = [...chartSeries].slice(-7);
    const last7 = tail.reduce((a, p) => a + Number(p.income ?? 0), 0);
    return { bestDay: best, bestDate: bestD, last7Sum: last7 };
  }, [chartSeries]);

  const bestLabel = bestDate
    ? new Date(bestDate.includes('T') ? bestDate : `${bestDate}T12:00:00`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      })
    : '—';

  return (
    <section className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-6 shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-5 w-5 text-amber-600" aria-hidden />
        <h3 className="text-lg font-bold text-slate-900">Performance highlights</h3>
      </div>
      <p className="mt-1 text-sm text-slate-600">Signals that compound trust and retention.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-rose-700">
            <Flame className="h-4 w-4" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wide">Best day</span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">{formatInr(bestDay)}</p>
          <p className="text-xs text-slate-500">{bestLabel}</p>
        </div>
        <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sky-700">
            <TrendingUp className="h-4 w-4" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wide">Last 7 days</span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">{formatInr(last7Sum)}</p>
          <p className="text-xs text-slate-500">Commission credits</p>
        </div>
        <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-violet-700">
            <Award className="h-4 w-4" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wide">Your runway</span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">{formatInr(totalBinaryIncome)}</p>
          <p className="text-xs text-slate-500">
            Lifetime binary · {teamDirects} direct{teamDirects === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default memo(PerformanceHighlightsInner);
