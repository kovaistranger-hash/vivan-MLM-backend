import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

const statuses = ['', 'pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'] as const;

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const page = Number(searchParams.get('page') || '1');
  const [data, setData] = useState<any>(null);

  const qs = useMemo(() => ({ status: status || undefined, page, pageSize: 20 }), [status, page]);

  useEffect(() => {
    api
      .get('/admin/orders', { params: qs })
      .then((r) => setData(r.data))
      .catch(() => toast.error('Failed to load orders'));
  }, [qs]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
      <select
        value={status}
        onChange={(e) => {
          const n = new URLSearchParams();
          if (e.target.value) n.set('status', e.target.value);
          n.set('page', '1');
          setSearchParams(n);
        }}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        {statuses.map((s) => (
          <option key={s || 'all'} value={s}>
            {s ? s : 'All statuses'}
          </option>
        ))}
      </select>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Pay</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data?.orders || []).map((o: any) => (
              <tr key={o.id}>
                <td className="px-4 py-2 font-mono text-xs">{o.order_number}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{o.user_name}</div>
                  <div className="text-xs text-slate-500">{o.user_email}</div>
                </td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize">{o.status}</span>
                </td>
                <td className="px-4 py-2 text-xs capitalize">{o.payment_status}</td>
                <td className="px-4 py-2">₹{Number(o.total_amount).toFixed(0)}</td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/admin/orders/${o.id}`} className="text-brand-700 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.pagination ? (
          <div className="flex justify-between border-t px-4 py-2 text-sm text-slate-600">
            <span>
              Page {data.pagination.page}/{data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="rounded border px-2 py-1 disabled:opacity-40"
                onClick={() => {
                  const n = new URLSearchParams(searchParams);
                  n.set('page', String(page - 1));
                  setSearchParams(n);
                }}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                className="rounded border px-2 py-1 disabled:opacity-40"
                onClick={() => {
                  const n = new URLSearchParams(searchParams);
                  n.set('page', String(page + 1));
                  setSearchParams(n);
                }}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
