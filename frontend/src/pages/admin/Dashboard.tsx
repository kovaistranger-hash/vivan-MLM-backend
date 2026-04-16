import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/services/api';
import { toast } from 'sonner';
import FadeInSection from '@/components/motion/FadeInSection';
import KPIGrid from '@/components/admin/KPIGrid';
import ProfitChart from '@/components/admin/ProfitChart';
import { GrowthLineChart } from '@/components/admin/Charts';
import TopEarners from '@/components/admin/TopEarners';
import PremiumCard from '@/components/admin/PremiumCard';

type AdminStatsResponse = {
  success: boolean;
  revenue: number;
  payout: number;
  profit: number;
  margin: number | null;
  growth: Array<{ date: string; users: number }>;
  topEarners: Array<{ userId: number; email: string; income: number }>;
  binaryHealth: { leftTotal: number; rightTotal: number };
  recentTransactions: Array<{
    id: number;
    userId: number;
    userEmail: string;
    type: string;
    amount: number;
    createdAt: string;
  }>;
};

type PredictionResponse = {
  success: boolean;
  lookbackDays: number;
  forecastDays: number;
  avgDailyRevenue: number;
  avgDailyPayout: number;
  predictedRevenue: number;
  predictedPayout: number;
  predictedProfit: number;
  profitTrend: Array<{ date: string; revenue: number; payout: number; profit: number }>;
};

type RiskAlert = {
  type: string;
  severity: 'info' | 'warning' | 'danger';
  message: string;
  metadata?: Record<string, unknown>;
};

type RiskStatusResponse = {
  success: boolean;
  revenue: number;
  payout: number;
  payoutRatio: number | null;
  binaryLeftTotal: number;
  binaryRightTotal: number;
  binaryImbalance: number;
  binaryImbalanceRatio: number | null;
  profitTodayIst: number;
  profitYesterdayIst: number;
  alerts: RiskAlert[];
  mitigatedBinary: boolean;
  insertedAlerts: number;
  recentAlerts: Array<{
    id: number;
    type: string;
    severity: 'info' | 'warning' | 'danger';
    message: string;
    metadata: unknown;
    createdAt: string;
  }>;
};

function fmtInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function Dashboard() {
  const [data, setData] = useState<AdminStatsResponse | null>(null);
  const [pred, setPred] = useState<PredictionResponse | null>(null);
  const [risk, setRisk] = useState<RiskStatusResponse | null>(null);

  useEffect(() => {
    Promise.all([api.get<AdminStatsResponse>('/admin/stats'), api.get<PredictionResponse>('/admin/stats/prediction')])
      .then(([s, p]) => {
        setData(s.data);
        setPred(p.data);
      })
      .catch(() => toast.error('Could not load dashboard'));

    api
      .get<RiskStatusResponse>('/admin/risk/status')
      .then((r) => setRisk(r.data))
      .catch(() => toast.error('Could not load risk status'));
  }, []);

  const profitChartData = useMemo(
    () => (pred?.profitTrend ?? []).map((d) => ({ date: d.date, profit: d.profit })),
    [pred]
  );

  if (!data?.success) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <FadeInSection>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-600/90">Finance</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Investor overview</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Delivered revenue vs commission wallet ledger. Predictions extrapolate a simple 7-day average — not a
              forecast model.
            </p>
          </div>
        </div>
      </FadeInSection>

      <KPIGrid
        stats={{ revenue: data.revenue, payout: data.payout, profit: data.profit, margin: data.margin }}
        formatInr={fmtInr}
      />

      {risk?.success ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="space-y-3"
        >
          {risk.mitigatedBinary ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
              Auto-mitigation ran: binary match rates were capped toward 8% because payout ratio crossed the danger band.
            </div>
          ) : null}
          {risk.alerts.length ? (
            <div className="space-y-2">
              {risk.alerts.map((a) => (
                <div
                  key={a.type}
                  className={
                    a.severity === 'danger'
                      ? 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-sm'
                      : 'rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm'
                  }
                >
                  <span className="font-semibold">{a.severity === 'danger' ? 'Risk' : 'Advisory'}:</span> {a.message}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
              Risk engine: no active payout, carry, or daily-profit alerts right now.
              {risk.payoutRatio != null ? (
                <span className="ml-1 font-mono text-xs">
                  (payout ratio {(risk.payoutRatio * 100).toFixed(1)}%)
                </span>
              ) : null}
            </div>
          )}
          {risk.recentAlerts?.length ? (
            <details className="rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
              <summary className="cursor-pointer font-medium text-slate-900">Recent stored alerts</summary>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
                {risk.recentAlerts.slice(0, 12).map((row) => (
                  <li key={row.id} className="border-b border-slate-100 pb-2 last:border-0">
                    <span className="font-mono text-slate-500">{row.createdAt.slice(0, 19)}</span>{' '}
                    <span
                      className={
                        row.severity === 'danger'
                          ? 'font-semibold text-rose-700'
                          : row.severity === 'warning'
                            ? 'font-semibold text-amber-800'
                            : 'text-slate-600'
                      }
                    >
                      {row.type}
                    </span>
                    : {row.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </motion.section>
      ) : null}

      {pred?.success ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-900 p-6 text-white shadow-xl shadow-indigo-300/25 ring-1 ring-white/10"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <h2 className="relative text-sm font-semibold tracking-wide text-white/90">
            {pred.forecastDays}-day projection
          </h2>
          <p className="relative mt-1 text-xs text-white/70">
            Based on avg daily figures over the last {pred.lookbackDays} days (delivered orders + commission credits).
          </p>
          <div className="relative mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/60">Predicted revenue</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{fmtInr(pred.predictedRevenue)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/60">Predicted payout</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-amber-100">{fmtInr(pred.predictedPayout)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/60">Predicted profit</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-200">{fmtInr(pred.predictedProfit)}</p>
            </div>
          </div>
        </motion.section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <ProfitChart data={profitChartData} />
        <div className="rounded-2xl bg-white/90 p-6 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/60">
          <h3 className="text-sm font-semibold text-slate-900">User signups</h3>
          <p className="text-xs text-slate-500">Last 30 days</p>
          <div className="mt-4">
            <GrowthLineChart data={data.growth} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white/90 p-6 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/60">
          <h3 className="text-sm font-semibold text-slate-900">Binary carry</h3>
          <p className="text-xs text-slate-500">Network-wide totals</p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <PremiumCard title="Left leg Σ" value={fmtInr(data.binaryHealth.leftTotal)} accent="violet" />
            <PremiumCard title="Right leg Σ" value={fmtInr(data.binaryHealth.rightTotal)} accent="slate" />
          </div>
        </div>
        <div className="rounded-2xl bg-white/90 p-6 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/60">
          <h3 className="text-sm font-semibold text-slate-900">Top earners</h3>
          <p className="text-xs text-slate-500">By commission wallet credits</p>
          <div className="mt-4">
            <TopEarners rows={data.topEarners} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/90 p-6 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/60">
        <h3 className="text-sm font-semibold text-slate-900">Recent wallet activity</h3>
        <p className="text-xs text-slate-500">Latest movements across all users</p>
        {data.recentTransactions.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-3 pr-3">Time</th>
                  <th className="py-3 pr-3">User</th>
                  <th className="py-3 pr-3">Type</th>
                  <th className="py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="py-3 pr-3 font-mono text-xs text-slate-600">{t.createdAt.slice(0, 19)}</td>
                    <td className="max-w-[220px] truncate py-3 pr-3 text-slate-800" title={t.userEmail}>
                      {t.userEmail}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-slate-900">₹{t.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No wallet transactions yet.</p>
        )}
      </div>
    </div>
  );
}
