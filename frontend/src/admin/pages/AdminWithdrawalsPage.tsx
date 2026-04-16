import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

type Row = {
  id: number;
  user_id: number;
  user_email?: string;
  user_name?: string;
  amount: string | number;
  fee_amount: string | number;
  net_amount: string | number;
  status: string;
  created_at: string;
};

function badge(s: string) {
  const m: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-900',
    approved: 'bg-sky-100 text-sky-900',
    paid: 'bg-emerald-100 text-emerald-900',
    rejected: 'bg-red-100 text-red-900',
    cancelled: 'bg-slate-200 text-slate-700'
  };
  return m[s] || 'bg-slate-100 text-slate-800';
}

type Applied = { status: string; userId: string; from: string; to: string };

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<Applied>({ status: '', userId: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/withdrawals', {
        params: {
          page,
          pageSize: 20,
          ...(applied.status ? { status: applied.status } : {}),
          ...(applied.userId ? { userId: Number(applied.userId) } : {}),
          ...(applied.from ? { from: applied.from } : {}),
          ...(applied.to ? { to: applied.to } : {})
        }
      })
      .then((r) => {
        setItems(r.data.withdrawals || []);
        setTotalPages(r.data.pagination?.totalPages || 1);
      })
      .catch(() => toast.error('Could not load withdrawals'))
      .finally(() => setLoading(false));
  }, [page, applied]);

  function applyFilters() {
    setApplied({ status, userId, from, to });
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Withdrawals</h1>
          <p className="text-sm text-slate-500">Review payout requests and open a row for actions.</p>
        </div>
        <Link to="/admin/withdrawal-settings" className="text-sm font-semibold text-brand-700 hover:underline">
          Withdrawal settings →
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs text-slate-600">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block rounded-lg border px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="paid">paid</option>
            <option value="rejected">rejected</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
        <label className="text-xs text-slate-600">
          User id
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 block w-28 rounded-lg border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-slate-600">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border px-2 py-1.5 text-sm" />
        </label>
        <button type="button" onClick={applyFilters} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Apply filters
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Gross</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((w) => (
                  <tr key={w.id} className="text-slate-800">
                    <td className="px-3 py-2 font-mono text-xs">#{w.id}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs font-medium">{w.user_name}</div>
                      <div className="text-xs text-slate-500">{w.user_email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge(w.status)}`}>{w.status}</span>
                    </td>
                    <td className="px-3 py-2">₹{Number(w.amount).toFixed(2)}</td>
                    <td className="px-3 py-2">₹{Number(w.net_amount).toFixed(2)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{new Date(w.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <Link to={`/admin/withdrawals/${w.id}`} className="text-sm font-semibold text-brand-700">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 ? (
          <div className="flex justify-end gap-2 border-t px-3 py-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">
              {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
