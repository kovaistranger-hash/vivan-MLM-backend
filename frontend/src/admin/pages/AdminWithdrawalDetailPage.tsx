import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

export default function AdminWithdrawalDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [remarks, setRemarks] = useState('');

  function load() {
    if (!id) return;
    api
      .get(`/admin/withdrawals/${id}`)
      .then((r) => setData(r.data))
      .catch(() => toast.error('Could not load withdrawal'));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function approve() {
    try {
      await api.post(`/admin/withdrawals/${id}/approve`, { remarks: remarks.trim() || null });
      toast.success('Approved');
      setRemarks('');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  }

  async function reject() {
    try {
      await api.post(`/admin/withdrawals/${id}/reject`, { remarks: remarks.trim() || null });
      toast.success('Rejected');
      setRemarks('');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  }

  async function markPaid() {
    try {
      await api.post(`/admin/withdrawals/${id}/mark-paid`, { remarks: remarks.trim() || null });
      toast.success('Marked paid');
      setRemarks('');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  }

  if (!data?.withdrawal) return <p className="text-sm text-slate-500">Loading…</p>;

  const w = data.withdrawal;
  const wallet = data.wallet;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/admin/withdrawals" className="text-sm text-brand-700 hover:underline">
        ← Withdrawals
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Withdrawal #{w.id}</h1>
        <p className="text-sm text-slate-500">
          {w.user_name} · {w.user_email}
        </p>
        <p className="mt-2 text-sm">
          Status: <span className="font-semibold">{w.status}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Amounts</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>Gross: ₹{Number(w.amount).toFixed(2)}</li>
            <li>Fee: ₹{Number(w.fee_amount).toFixed(2)}</li>
            <li>Net: ₹{Number(w.net_amount).toFixed(2)}</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Wallet</h2>
          {wallet ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>Balance: ₹{Number(wallet.balance).toFixed(2)}</li>
              <li>Held: ₹{Number(wallet.held_balance ?? 0).toFixed(2)}</li>
              <li>Active: {wallet.is_active ? 'yes' : 'no'}</li>
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No wallet row</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Bank account</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          <li>{w.bank_name}</li>
          <li>{w.account_holder_name}</li>
          {w.account_number ? <li className="font-mono">Acct ····{String(w.account_number).slice(-4)}</li> : null}
          {w.ifsc_code ? <li className="font-mono">{w.ifsc_code}</li> : null}
          {w.upi_id ? <li>UPI: {w.upi_id}</li> : null}
          {w.branch_name ? <li>Branch: {w.branch_name}</li> : null}
        </ul>
      </div>

      {(w.notes || w.admin_remarks) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          {w.notes ? <p>User note: {w.notes}</p> : null}
          {w.admin_remarks ? <p className="mt-1">Admin remarks: {w.admin_remarks}</p> : null}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <label className="block text-xs text-slate-600">
          Remarks (optional for approve / paid; recommended for reject)
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {w.status === 'pending' ? (
            <>
              <button type="button" onClick={approve} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
                Approve
              </button>
              <button type="button" onClick={reject} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white">
                Reject
              </button>
            </>
          ) : null}
          {w.status === 'approved' ? (
            <>
              <button type="button" onClick={markPaid} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                Mark paid
              </button>
              <button type="button" onClick={reject} className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">
                Reject (refund hold)
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
