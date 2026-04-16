import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import FadeInSection from '@/components/motion/FadeInSection';
import StatsCard from '@/components/dashboard/StatsCard';
import IncomeChart, { type IncomeChartPoint } from '@/components/dashboard/IncomeChart';
import QuickActions from '@/components/dashboard/QuickActions';
import HeroEarningsBanner from '@/components/dashboard/HeroEarningsBanner';
import BinarySummaryPanel from '@/components/dashboard/BinarySummaryPanel';
import PerformanceHighlights from '@/components/dashboard/PerformanceHighlights';
import Leaderboard from '@/components/dashboard/Leaderboard';
import Notifications from '@/components/dashboard/Notifications';

function formatInr(n: number) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function rankLabel(rank: string) {
  const r = String(rank || 'Starter').trim() || 'Starter';
  if (r === 'Diamond') return `${r} 👑`;
  if (r === 'Platinum') return `${r} 💎`;
  if (r === 'Gold') return `${r} 🥇`;
  if (r === 'Silver') return `${r} 🥈`;
  return `${r} ⭐`;
}

function rankValueColor(rank: string) {
  const r = String(rank || '').trim();
  if (r === 'Diamond') return 'text-violet-600';
  if (r === 'Platinum') return 'text-cyan-600';
  if (r === 'Gold') return 'text-yellow-500';
  if (r === 'Silver') return 'text-slate-500';
  return 'text-slate-600';
}

function DashboardInner() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({
    totalIncome: 0,
    todayIncome: 0,
    leftBV: 0,
    rightBV: 0,
    rank: 'Starter' as string
  });
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [chartSeries, setChartSeries] = useState<IncomeChartPoint[]>([]);
  const [directCount, setDirectCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletHeld, setWalletHeld] = useState(0);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rMlm, rBin, rInc, rDir, rWallet] = await Promise.allSettled([
          api.get('/mlm/stats'),
          api.get('/referral/binary-summary'),
          api.get('/income/history'),
          api.get('/referral/directs'),
          api.get('/wallet')
        ]);
        if (cancelled) return;
        if (rMlm.status === 'fulfilled') {
          const d = rMlm.value.data as Record<string, unknown>;
          setOverview({
            totalIncome: Number(d.totalIncome ?? 0),
            todayIncome: Number(d.todayIncome ?? 0),
            leftBV: Number(d.leftBV ?? 0),
            rightBV: Number(d.rightBV ?? 0),
            rank: String(d.rank ?? 'Starter')
          });
        }
        if (rBin.status === 'fulfilled') {
          setSummary(rBin.value.data as Record<string, unknown>);
        }
        if (rInc.status === 'fulfilled') {
          const s = (rInc.value.data as { series?: IncomeChartPoint[] })?.series;
          setChartSeries(Array.isArray(s) ? s : []);
        }
        if (rDir.status === 'fulfilled') {
          const items = (rDir.value.data as { items?: unknown[] })?.items;
          setDirectCount(Array.isArray(items) ? items.length : 0);
        }
        if (rWallet.status === 'fulfilled') {
          const w = (rWallet.value.data as { wallet?: { balance?: number; heldBalance?: number } })?.wallet;
          setWalletBalance(Number(w?.balance ?? 0));
          setWalletHeld(Number(w?.heldBalance ?? 0));
        }
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-md">
        <p className="text-slate-700">
          <Link className="font-bold text-brand-700 hover:underline" to="/login">
            Sign in
          </Link>{' '}
          to open your earning dashboard.
        </p>
      </div>
    );
  }

  return (
    <FadeInSection className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <header>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Income overview, growth chart, and binary health — built for members who want a premium earning experience.
          </p>
        </header>

        <HeroEarningsBanner
          totalIncome={overview.totalIncome}
          todayIncome={overview.todayIncome}
          teamSize={directCount}
          loading={loading}
        />

        <section aria-labelledby="income-overview-heading">
          <h2 id="income-overview-heading" className="sr-only">
            Income overview
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <StatsCard title="Total income" value={formatInr(overview.totalIncome)} color="text-emerald-600" variant="income" />
            <StatsCard title="Today income" value={formatInr(overview.todayIncome)} color="text-sky-600" variant="growth" />
            <StatsCard title="Left BV" value={formatInr(overview.leftBV)} variant="growth" />
            <StatsCard title="Right BV" value={formatInr(overview.rightBV)} variant="growth" />
            <StatsCard
              title="Your rank"
              value={rankLabel(overview.rank)}
              color={rankValueColor(overview.rank)}
              variant="neutral"
              hint="Based on left + right team BV (binary carry). Updates after binary payouts."
            />
            <StatsCard
              title="Wallet balance"
              value={formatInr(walletBalance)}
              color="text-purple-600"
              variant="neutral"
              hint={
                walletHeld > 0
                  ? `Withdrawable ≈ ${formatInr(Math.max(0, walletBalance - walletHeld))} (₹${walletHeld.toLocaleString('en-IN')} on hold)`
                  : 'Spend at checkout or request a withdrawal when eligible.'
              }
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <IncomeChart series={chartSeries} externalLoading={loading} heading="Income growth" />
          <QuickActions />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Leaderboard />
          <Notifications />
        </div>

        <BinarySummaryPanel summary={summary} />

        <PerformanceHighlights
          chartSeries={chartSeries}
          totalBinaryIncome={overview.totalIncome}
          teamDirects={directCount}
        />

        <div className="flex flex-wrap justify-center gap-4 pb-8 text-sm font-semibold text-brand-800">
          <Link to="/referral" className="rounded-full border border-brand-200 bg-white px-5 py-2.5 shadow-sm hover:bg-brand-50">
            Open full network &amp; tree →
          </Link>
          <Link to="/referral/binary-calculator" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 shadow-sm hover:bg-slate-50">
            Binary calculator →
          </Link>
        </div>
      </div>
    </FadeInSection>
  );
}

export default memo(DashboardInner);
