import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

export default function AdminBinaryDailyPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api
      .get('/admin/binary-daily', { params: { page, pageSize: 30 } })
      .then((r) => {
        setItems(r.data.items || []);
        setTotal(r.data.total || 0);
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed'));
  }, [page]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Binary daily ceiling</h1>
          <p className="text-sm text-slate-500">Per user IST day: binary paid vs ceiling-blocked totals.</p>
        </div>
        <Link to="/admin/commissions" className="text-sm text-brand-700 hover:underline">
          ← Commission ledger
        </Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Binary paid</th>
              <th className="px-3 py-2">Ceiling blocked</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={`${r.user_id}-${r.summary_date}`} className="border-b border-slate-100">
                <td className="px-3 py-2">{String(r.summary_date).slice(0, 10)}</td>
                <td className="px-3 py-2">
                  <Link className="text-brand-700 hover:underline" to={`/admin/referrals/${r.user_id}`}>
                    #{r.user_id}
                  </Link>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </td>
                <td className="px-3 py-2">₹{Number(r.binary_paid_total).toFixed(2)}</td>
                <td className="px-3 py-2">₹{Number(r.ceiling_blocked_total).toFixed(2)}</td>
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
