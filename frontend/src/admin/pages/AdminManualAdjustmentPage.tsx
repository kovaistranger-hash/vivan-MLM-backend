import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

export default function AdminManualAdjustmentPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    orderId: '',
    adjustmentType: 'goodwill',
    amount: '',
    action: 'credit' as 'credit' | 'debit',
    reason: '',
    applyToWallet: true
  });

  function load() {
    api
      .get('/admin/commissions/manual-adjustments', { params: { page, pageSize: 25 } })
      .then((r) => {
        setRows(r.data.items || []);
        setTotal(r.data.total || 0);
      })
      .catch(() => toast.error('Could not load adjustments'));
  }

  useEffect(() => {
    load();
  }, [page]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/commissions/manual-adjustment', {
        userId: Number(form.userId),
        orderId: form.orderId.trim() ? Number(form.orderId) : null,
        adjustmentType: form.adjustmentType,
        amount: Number(form.amount),
        action: form.action,
        reason: form.reason,
        applyToWallet: form.applyToWallet
      });
      toast.success('Adjustment recorded');
      setForm({
        userId: '',
        orderId: '',
        adjustmentType: 'goodwill',
        amount: '',
        action: 'credit',
        reason: '',
        applyToWallet: true
      });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Manual commission adjustment</h1>
          <p className="text-sm text-slate-500">Creates an auditable row; wallet changes always go through the ledger.</p>
        </div>
        <Link to="/admin/compensation-settings" className="text-sm text-brand-700 hover:underline">
          ← Compensation settings
        </Link>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            User id
            <input
              required
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Order id (optional)
            <input
              value={form.orderId}
              onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Adjustment type
            <input
              required
              value={form.adjustmentType}
              onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Amount (INR)
            <input
              required
              type="number"
              min={0.01}
              step={0.01}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Action
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value as 'credit' | 'debit' })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.applyToWallet}
              onChange={(e) => setForm({ ...form, applyToWallet: e.target.checked })}
            />
            Apply to wallet (ledger entry + commission row)
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Reason
          <textarea
            required
            rows={2}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit adjustment'}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-4 py-2 text-sm font-semibold text-slate-900">Recent adjustments</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2">Id</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Wallet</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2">
                    #{r.user_id}
                    <div className="text-xs text-slate-500">{r.user_email}</div>
                  </td>
                  <td className="px-3 py-2">{r.adjustment_type}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2">₹{Number(r.amount).toFixed(2)}</td>
                  <td className="px-3 py-2">{r.apply_to_wallet ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between border-t px-4 py-2 text-sm text-slate-600">
          <span>{total} total</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} className="rounded border px-2 py-0.5 disabled:opacity-40" onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <button
              type="button"
              disabled={page * 25 >= total}
              className="rounded border px-2 py-0.5 disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
