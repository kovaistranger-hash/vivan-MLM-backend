import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

type Row = {
  user_id: number;
  name: string;
  email: string;
  left_profit_carry: number;
  right_profit_carry: number;
  matched_volume_today: number;
  binary_paid_today: number;
  remaining_ceiling_today: number;
  daily_binary_ceiling: number;
};

export default function AdminBinaryCarryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [ceilingDefault, setCeilingDefault] = useState(4000);
  const [istDate, setIstDate] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{
    userId: number;
    side: 'left' | 'right' | 'reset';
    delta: string;
    reason: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  function load() {
    api
      .get('/admin/binary-carry', { params: { page, pageSize: 20, q: q || undefined } })
      .then((r) => {
        setRows(r.data.items || []);
        setTotal(r.data.total || 0);
        setCeilingDefault(Number(r.data.ceilingDefault ?? 4000));
        setIstDate(r.data.istDate || '');
      })
      .catch(() => toast.error('Could not load binary carry'));
  }

  useEffect(() => {
    load();
  }, [page, q]);

  async function submitAdjust() {
    if (!modal) return;
    setBusyId(modal.userId);
    try {
      await api.post(
        `/admin/binary-carry/${modal.userId}/adjust`,
        modal.side === 'reset'
          ? { side: 'reset' as const, reason: modal.reason }
          : { side: modal.side, delta: Number(modal.delta), reason: modal.reason }
      );
      toast.success('Carry updated');
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Adjust failed');
    } finally {
      setBusyId(null);
    }
  }

  async function recalc(userId: number) {
    setBusyId(userId);
    try {
      const { data } = await api.post(`/admin/binary-carry/${userId}/recalculate`);
      toast.success(`Standstill cycles: ${data.events ?? 0}`);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Recalculate failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Binary carry</h1>
          <p className="text-sm text-slate-500">
            IST day {istDate || '—'} · default ceiling ₹{ceilingDefault.toFixed(2)}
          </p>
        </div>
        <Link to="/admin/compensation-settings" className="text-sm text-brand-700 hover:underline">
          Compensation settings
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search user…"
        className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Left</th>
              <th className="px-3 py-2">Right</th>
              <th className="px-3 py-2">Matched vol. today</th>
              <th className="px-3 py-2">Binary paid today</th>
              <th className="px-3 py-2">Ceiling left</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-b border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </td>
                <td className="px-3 py-2">₹{Number(r.left_profit_carry).toFixed(2)}</td>
                <td className="px-3 py-2">₹{Number(r.right_profit_carry).toFixed(2)}</td>
                <td className="px-3 py-2">₹{Number(r.matched_volume_today).toFixed(2)}</td>
                <td className="px-3 py-2">₹{Number(r.binary_paid_today).toFixed(2)}</td>
                <td className="px-3 py-2 font-medium text-emerald-800">₹{Number(r.remaining_ceiling_today).toFixed(2)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busyId === r.user_id}
                      className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-40"
                      onClick={() => setModal({ userId: r.user_id, side: 'left', delta: '', reason: '' })}
                    >
                      +L
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.user_id}
                      className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-40"
                      onClick={() => setModal({ userId: r.user_id, side: 'right', delta: '', reason: '' })}
                    >
                      +R
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.user_id}
                      className="rounded border border-amber-200 px-2 py-0.5 text-xs text-amber-900 hover:bg-amber-50 disabled:opacity-40"
                      onClick={() => setModal({ userId: r.user_id, side: 'reset', delta: '0', reason: '' })}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.user_id}
                      className="rounded border border-brand-200 px-2 py-0.5 text-xs text-brand-900 hover:bg-brand-50 disabled:opacity-40"
                      onClick={() => recalc(r.user_id)}
                    >
                      Recalc
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between text-sm text-slate-600">
        <span>{total} customers</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <button
            type="button"
            disabled={page * 20 >= total}
            className="rounded border px-2 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Adjust carry · user #{modal.userId} · {modal.side}
            </h3>
            {modal.side !== 'reset' ? (
              <label className="mt-3 block text-sm text-slate-700">
                Delta (INR, can be negative)
                <input
                  value={modal.delta}
                  onChange={(e) => setModal({ ...modal, delta: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Sets both legs to zero and logs audit.</p>
            )}
            <label className="mt-3 block text-sm text-slate-700">
              Reason
              <input
                value={modal.reason}
                onChange={(e) => setModal({ ...modal, reason: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === modal.userId || !modal.reason.trim() || (modal.side !== 'reset' && modal.delta === '')}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={submitAdjust}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
