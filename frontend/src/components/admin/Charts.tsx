import {
  Line,
  LineChart,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis
} from 'recharts';

export type GrowthChartPoint = { date: string; users: number };

type GrowthLineChartProps = {
  data: GrowthChartPoint[];
};

export function GrowthLineChart({ data }: GrowthLineChartProps) {
  if (!data.length) {
    return <p className="text-sm text-slate-500">No signup data in the last 30 days.</p>;
  }

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
            formatter={(value) => [`${Number(value ?? 0)} users`, 'Signups']}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Line type="monotone" dataKey="users" stroke="#4f46e5" strokeWidth={2} dot={false} name="Signups" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
