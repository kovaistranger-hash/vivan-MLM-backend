import { memo, useEffect, useState } from 'react';
import { api } from '@/services/api';

export type LeaderboardEntry = {
  id: number;
  name: string;
  total_income: number;
};

function formatInr(n: number) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function rankStyle(i: number) {
  if (i === 0) return 'bg-amber-100 text-amber-900 ring-amber-200';
  if (i === 1) return 'bg-slate-200 text-slate-800 ring-slate-300';
  if (i === 2) return 'bg-orange-100 text-orange-900 ring-orange-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function LeaderboardInner() {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ success?: boolean; leaderboard?: LeaderboardEntry[] }>('/leaderboard');
        if (cancelled) return;
        const list = res.data?.leaderboard;
        setRows(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setError('Could not load leaderboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Top earners</h2>
          <p className="mt-1 text-sm text-slate-600">Ranked by total commission credited to wallet (top 10).</p>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-rose-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No leaderboard data yet — invite your team and earn commissions.</p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-100">
          {rows.map((user, i) => (
            <li key={user.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ring-1 ${rankStyle(i)}`}
                >
                  {i + 1}
                </span>
                <span className="truncate font-semibold text-slate-900">{user.name || 'Member'}</span>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-600">{formatInr(user.total_income)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default memo(LeaderboardInner);
