import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

export default function AdminCommissionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [type, setType] = useState('');

  function load() {
    api
      .get('/admin/commissions', {
        params: {
          page,
          pageSize: 30,
          userId: userId.trim() || undefined,
          type: type.trim() || undefined
        }
      })
      .then((r) => {
        setItems(r.data.items || []);
        setTotal(r.data.total || 0);
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Commission ledger</h1>
          <p className="text-sm text-slate-500">All commission_transactions across users.</p>
        </div>
        <Link to="/admin/binary-daily" className="ml-auto text-sm text-brand-700 hover:underline">
          Binary daily summary →
        </Link>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
      >
        <input
          placeholder="User id"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-28 rounded-lg border px-2 py-1 text-sm"
        />
        <input
          placeholder="Type (welcome_bonus, …)"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="min-w-[180px] flex-1 rounded-lg border px-2 py-1 text-sm"
        />
        <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
          Filter
        </button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Id</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Gross</th>
              <th className="px-3 py-2">Wallet</th>
              <th className="px-3 py-2">Ceiling</th>
              <th className="px-3 py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{c.id}</td>
                <td className="px-3 py-2">
                  <Link className="text-brand-700 hover:underline" to={`/admin/referrals/${c.user_id}`}>
                    #{c.user_id}
                  </Link>
                  <div className="text-xs text-slate-500">{c.user_email}</div>
                </td>
                <td className="px-3 py-2">{c.commission_type}</td>
                <td className="px-3 py-2">{c.order_number || c.order_id || '—'}</td>
                <td className="px-3 py-2">₹{Number(c.gross_amount).toFixed(2)}</td>
                <td className="px-3 py-2">₹{Number(c.wallet_amount).toFixed(2)}</td>
                <td className="px-3 py-2">₹{Number(c.ceiling_blocked_amount).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm text-slate-600">
        <span>
          {total} rows · page {page}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <button
            type="button"
            disabled={page * 30 >= total}
            className="rounded border px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
