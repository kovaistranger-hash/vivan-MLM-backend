import { memo, useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

export type IncomeChartPoint = { date: string; income: number };

function formatAxisDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function sumCurrentMonthEarnings(points: IncomeChartPoint[]): number {
  const now = new Date();
  return points.reduce((acc, p) => {
    const raw = p.date.includes('T') ? p.date : `${p.date}T12:00:00`;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return acc;
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      return acc + Number(p.income ?? 0);
    }
    return acc;
  }, 0);
}

type Props = {
  /**
   * Controlled mode: parent supplies series + loading. Omit for self-fetch (e.g. wallet page).
   */
  series?: IncomeChartPoint[];
  externalLoading?: boolean;
  /** Chart card heading */
  heading?: string;
};

function IncomeChartInner({ series: controlledSeries, externalLoading, heading = 'Income growth' }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isControlled = controlledSeries !== undefined;
  const [selfData, setSelfData] = useState<IncomeChartPoint[]>([]);
  const [selfLoading, setSelfLoading] = useState(true);

  useEffect(() => {
    if (isControlled || !accessToken) {
      if (!isControlled) {
        setSelfData([]);
        setSelfLoading(false);
      }
      return;
    }
    let cancelled = false;
    setSelfLoading(true);
    (async () => {
      try {
        const res = await api.get<{ success?: boolean; series?: IncomeChartPoint[] }>('/income/history');
        if (cancelled) return;
        const next = Array.isArray(res.data?.series) ? res.data.series! : [];
        setSelfData(next);
      } catch {
        if (!cancelled) {
          setSelfData([]);
          toast.error('Failed to load income history');
        }
      } finally {
        if (!cancelled) setSelfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isControlled]);

  const data = isControlled ? controlledSeries! : selfData;
  const loading = isControlled ? Boolean(externalLoading) : selfLoading;

  const monthTotal = useMemo(() => sumCurrentMonthEarnings(data), [data]);
  const monthLabel = useMemo(
    () =>
      new Date().toLocaleString(undefined, {
        month: 'long',
        year: 'numeric'
      }),
    []
  );

  const chartRows = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatAxisDate(d.date)
      })),
    [data]
  );

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <h3 className="font-bold text-slate-900">{heading}</h3>
        <p className="mt-2 text-sm text-slate-500">Sign in to see your daily commission credits.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 h-[220px] animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-sky-50/40 to-indigo-50/30 p-6 shadow-md">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{heading}</h3>
          <p className="mt-1 text-xs text-slate-500">Daily commission wallet credits · {monthLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">This month</p>
          <p className="text-2xl font-bold tabular-nums text-sky-950">
            ₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600">Track momentum — stronger weeks usually follow consistent invites.</p>

      {chartRows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">No commission data yet — shop and grow your team to see income here.</p>
      ) : (
        <div className="mt-5 h-[260px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
              />
              <Tooltip
                formatter={(value) => [
                  `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                  'Income'
                ]}
                labelFormatter={(_, payload) => (payload?.[0]?.payload?.date as string) || ''}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
              />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 3, fill: '#6366f1' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default memo(IncomeChartInner);
