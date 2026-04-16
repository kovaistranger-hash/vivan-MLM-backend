import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

type Tx = {
  id: number;
  type: string;
  amount: string | number;
  balance_after: string | number;
  description: string | null;
  created_at: string;
};

function typeColor(t: string) {
  if (t.includes('credit') || t === 'refund' || t === 'order_refund') return 'text-emerald-700';
  if (t.includes('debit') || t === 'order_payment') return 'text-red-700';
  if (t === 'withdrawal_hold') return 'text-amber-800';
  if (t === 'withdrawal_paid') return 'text-slate-600';
  if (t === 'withdrawal_reversed' || t === 'withdrawal_cancelled') return 'text-emerald-700';
  return 'text-slate-700';
}

export default function AdminWalletDetailPage() {
  const { userId } = useParams();
  const [wallet, setWallet] = useState<any>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [creditAmt, setCreditAmt] = useState('');
  const [creditDesc, setCreditDesc] = useState('');
  const [debitAmt, setDebitAmt] = useState('');
  const [debitDesc, setDebitDesc] = useState('');
  const [refAmt, setRefAmt] = useState('');
  const [refDesc, setRefDesc] = useState('');
  const [refType, setRefType] = useState('order');
  const [refId, setRefId] = useState('');

  function load() {
    if (!userId) return;
    api
      .get(`/admin/wallets/${userId}`)
      .then((r) => {
        setWallet(r.data.wallet);
        setTxs(r.data.transactions || []);
      })
      .catch(() => toast.error('Could not load wallet'));
  }

  useEffect(() => {
    load();
  }, [userId]);

  async function postCredit() {
    if (!userId) return;
    try {
      await api.post(`/admin/wallets/${userId}/credit`, {
        amount: Number(creditAmt),
        description: creditDesc
      });
      toast.success('Credit applied');
      setCreditAmt('');
      setCreditDesc('');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  }

  async function postDebit() {
    if (!userId) return;
    try {
      await api.post(`/admin/wallets/${userId}/debit`, {
        amount: Number(debitAmt),
        description: debitDesc
      });
      toast.success('Debit applied');
      setDebitAmt('');
      setDebitDesc('');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  }

  async function postRefund() {
    if (!userId) return;
    try {
      await api.post(`/admin/wallets/${userId}/refund`, {
        amount: Number(refAmt),
        description: refDesc,
        reference_type: refType,
        reference_id: Number(refId)
      });
      toast.success('Refund recorded');
      setRefAmt('');
      setRefDesc('');
      setRefId('');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  }

  if (!wallet) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/admin/wallets" className="text-sm text-brand-700 hover:underline">
        ← Wallets
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{wallet.user_name}</h1>
        <p className="text-sm text-slate-500">{wallet.user_email}</p>
        <p className="mt-3 text-3xl font-bold text-emerald-900">₹{Number(wallet.balance).toFixed(2)}</p>
        <p className="mt-1 text-sm text-amber-900">
          Held: ₹{Number(wallet.held_balance ?? 0).toFixed(2)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Admin credit</h2>
          <label className="mt-2 block text-xs text-slate-600">
            Amount
            <input
              type="number"
              step="0.01"
              value={creditAmt}
              onChange={(e) => setCreditAmt(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="mt-2 block text-xs text-slate-600">
            Description *
            <input
              value={creditDesc}
              onChange={(e) => setCreditDesc(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={postCredit}
            className="mt-3 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Credit wallet
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Admin debit</h2>
          <label className="mt-2 block text-xs text-slate-600">
            Amount
            <input
              type="number"
              step="0.01"
              value={debitAmt}
              onChange={(e) => setDebitAmt(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="mt-2 block text-xs text-slate-600">
            Description *
            <input
              value={debitDesc}
              onChange={(e) => setDebitDesc(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={postDebit}
            className="mt-3 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Debit wallet
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Manual refund (ledger)</h2>
        <p className="mt-1 text-xs text-slate-500">Credits wallet with audit reference (not the same as order status refund).</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-slate-600">
            Amount
            <input
              type="number"
              step="0.01"
              value={refAmt}
              onChange={(e) => setRefAmt(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Reference id
            <input
              value={refId}
              onChange={(e) => setRefId(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Reference type
            <input
              value={refType}
              onChange={(e) => setRefType(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Description *
            <input
              value={refDesc}
              onChange={(e) => setRefDesc(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button type="button" onClick={postRefund} className="mt-3 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold">
          Record refund credit
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-4 py-2 text-sm font-semibold text-slate-900">Transactions</div>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">After</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txs.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{t.type}</td>
                  <td className={`px-3 py-2 font-semibold ${typeColor(t.type)}`}>₹{Number(t.amount).toFixed(2)}</td>
                  <td className="px-3 py-2 text-slate-800">₹{Number(t.balance_after).toFixed(2)}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-slate-600">{t.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
