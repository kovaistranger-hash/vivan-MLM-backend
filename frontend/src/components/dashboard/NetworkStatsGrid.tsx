import { memo } from 'react';
import type { MlmStats } from '@/stores/mlmStore';
import StatsCard from './StatsCard';

function formatInr(n: number): string {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

type Props = {
  stats: MlmStats;
};

function NetworkStatsGridInner({ stats }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-sky-50/30 p-5 shadow-md sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Network performance</h2>
      <p className="mt-1 text-sm text-slate-600">Leg carry (BV) and binary income — updated live.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard label="Left BV" value={formatInr(stats.leftBV)} variant="growth" />
        <StatsCard label="Right BV" value={formatInr(stats.rightBV)} variant="growth" />
        <StatsCard
          label="Weak leg"
          value={stats.weakLeg === 'right' ? 'Right' : 'Left'}
          hint="Smaller carry gets spill preference"
          variant="warning"
        />
        <StatsCard label="Today income" value={formatInr(stats.todayIncome)} variant="income" />
        <StatsCard label="Total income" value={formatInr(stats.totalIncome)} variant="income" />
      </div>
    </div>
  );
}

export default memo(NetworkStatsGridInner);
