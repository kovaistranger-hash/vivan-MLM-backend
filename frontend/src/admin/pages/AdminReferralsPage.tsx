import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

export default function AdminReferralsPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  function load() {
    api
      .get('/admin/referrals/users', { params: { q: q || undefined, page, pageSize: 25 } })
      .then((r) => {
        setItems(r.data.items || []);
        setTotal(r.data.total || 0);
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Referral users</h1>
        <p className="text-sm text-slate-500">Search by email, name, referral code, or user id.</p>
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
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Sponsor id</th>
              <th className="px-4 py-2">Placement</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.user_id} className="border-b border-slate-100">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">{row.name}</div>
                  <div className="text-xs text-slate-500">{row.email}</div>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{row.referral_code}</td>
                <td className="px-4 py-2">{row.sponsor_user_id ?? '—'}</td>
                <td className="px-4 py-2 text-xs">
                  {row.placement_parent_user_id ? (
                    <>
                      parent #{row.placement_parent_user_id} · {row.placement_side}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2">
                  <Link to={`/admin/referrals/${row.user_id}`} className="text-brand-700 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} · {total} users
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} className="rounded border px-3 py-1 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <button
            type="button"
            disabled={page * 25 >= total}
            className="rounded border px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
