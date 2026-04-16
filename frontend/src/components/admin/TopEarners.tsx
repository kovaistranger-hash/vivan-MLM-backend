export type TopEarnerRow = { userId: number; email: string; income: number };

type TopEarnersProps = {
  rows: TopEarnerRow[];
};

export default function TopEarners({ rows }: TopEarnersProps) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No commission wallet credits yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {rows.map((e, i) => (
        <li key={e.userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <span className="text-xs font-medium text-slate-400">#{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-slate-700" title={e.email}>
            {e.email}
          </span>
          <span className="font-mono font-semibold text-slate-900">₹{e.income.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}
