import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

type Row = {
  id: number;
  user_id: number;
  balance: string | number;
  held_balance?: string | number;
  user_name: string;
  user_email: string;
  is_active: number;
};

export default function AdminWalletsPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/wallets', { params: { search: q || undefined, page, pageSize: 20 } })
      .then((r) => {
        setRows(r.data.wallets || []);
        setTotalPages(r.data.pagination?.totalPages || 1);
      })
      .catch(() => toast.error('Could not load wallets'))
      .finally(() => setLoading(false));
  }, [q, page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Wallets</h1>
        <p className="text-sm text-slate-500">Search by customer name or email, then open a wallet to adjust balance.</p>
      </div>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search name or email…"
        className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No wallets match.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Held</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((w) => (
                <tr key={w.user_id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{w.user_name}</td>
                  <td className="px-4 py-3 text-slate-600">{w.user_email}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{Number(w.balance).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-amber-900">₹{Number(w.held_balance ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        w.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {w.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/wallets/${w.user_id}`}
                      className="text-sm font-semibold text-brand-700 hover:text-brand-900"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 ? (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
