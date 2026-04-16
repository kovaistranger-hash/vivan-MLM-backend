import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

export type ProfitChartPoint = { date: string; profit: number };

type ProfitChartProps = {
  data: ProfitChartPoint[];
  title?: string;
  subtitle?: string;
};

export default function ProfitChart({
  data,
  title = 'Profit trend',
  subtitle = 'Daily delivered revenue minus commission wallet credits (last 7 days with activity)'
}: ProfitChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-2xl bg-white/90 p-6 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/60">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-4 text-sm text-slate-500">Not enough daily data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/90 p-6 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/60">
      <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4 h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="profitStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => String(v).slice(5)} />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              width={52}
              tickFormatter={(v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return '';
                const a = Math.abs(n);
                if (a >= 100000) return `${(n / 100000).toFixed(1)}L`;
                if (a >= 1000) return `${(n / 1000).toFixed(0)}k`;
                return String(Math.round(n));
              }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 10px 40px rgba(15,23,42,0.08)'
              }}
              formatter={(value) => [
                `₹${Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                'Profit'
              ]}
              labelFormatter={(label) => `Day ${label}`}
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="url(#profitStroke)"
              strokeWidth={2.5}
              fill="url(#profitFill)"
              dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
