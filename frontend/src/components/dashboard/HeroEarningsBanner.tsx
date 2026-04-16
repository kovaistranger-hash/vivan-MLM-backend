import { memo } from 'react';
import { TrendingUp, Users, Wallet } from 'lucide-react';

type Props = {
  totalIncome: number;
  todayIncome: number;
  teamSize: number;
  loading?: boolean;
};

function formatInr(n: number): string {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function HeroEarningsBannerInner({ totalIncome, todayIncome, teamSize, loading }: Props) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-teal-400/20 blur-2xl" />

      <div className="relative">
        <p className="text-sm font-medium text-emerald-100">Your earning hub</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Grow income. Build your team.</h2>
        <p className="mt-2 max-w-xl text-sm text-emerald-50/95">
          Track binary match payouts and leg volume — invite others to unlock more earning potential.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white/15 px-4 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-emerald-100">
              <Wallet className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide">Total income</span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">
              {loading ? '…' : formatInr(totalIncome)}
            </p>
            <p className="mt-1 text-xs text-emerald-100/90">Binary lifetime (wallet)</p>
          </div>
          <div className="rounded-xl bg-white/15 px-4 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-emerald-100">
              <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide">Today</span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">
              {loading ? '…' : formatInr(todayIncome)}
            </p>
            <p className="mt-1 text-xs text-emerald-100/90">IST day binary payout</p>
          </div>
          <div className="rounded-xl bg-white/15 px-4 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-emerald-100">
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide">Team size</span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">{loading ? '…' : teamSize}</p>
            <p className="mt-1 text-xs text-emerald-100/90">Direct referrals</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(HeroEarningsBannerInner);
