import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';
import WalletSubNav from '../components/WalletSubNav';
import FadeInSection from '../components/motion/FadeInSection';

type Rules = {
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number | null;
  withdrawalFeeType: 'fixed' | 'percentage';
  withdrawalFeeValue: number;
  kycRequired: boolean;
  allowUpi: boolean;
  allowBankTransfer: boolean;
  onePendingRequestOnly: boolean;
};

type Bank = { id: number; bank_name: string; account_holder_name: string; is_default: number };

type Wd = {
  id: number;
  amount: string | number;
  fee_amount: string | number;
  net_amount: string | number;
  status: string;
  created_at: string;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function previewFee(gross: number, rules: Rules | null) {
  if (!rules || !gross || gross <= 0) return { fee: 0, net: 0 };
  let fee =
    rules.withdrawalFeeType === 'fixed'
      ? round2(rules.withdrawalFeeValue)
      : round2(gross * (rules.withdrawalFeeValue / 100));
  fee = Math.min(fee, gross);
  const net = round2(gross - fee);
  return { fee, net: Math.max(0, net) };
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-900',
    approved: 'bg-sky-100 text-sky-900',
    paid: 'bg-emerald-100 text-emerald-900',
    rejected: 'bg-red-100 text-red-900',
    cancelled: 'bg-slate-200 text-slate-700'
  };
  return map[s] || 'bg-slate-100 text-slate-800';
}

export default function WalletWithdrawPage() {
  const { accessToken } = useAuthStore();
  const [rules, setRules] = useState<Rules | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [balance, setBalance] = useState(0);
  const [held, setHeld] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Wd[]>([]);
  const [bankId, setBankId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  const gross = Number(amount) || 0;
  const preview = useMemo(() => previewFee(gross, rules), [gross, rules]);

  function loadAll() {
    if (!accessToken) return;
    setLoading(true);
    Promise.all([
      api.get('/wallet/withdrawal-rules'),
      api.get('/wallet/bank-accounts'),
      api.get('/wallet'),
      api.get('/wallet/withdrawals', { params: { page: 1, pageSize: 50 } })
    ])
      .then(([r1, r2, r3, r4]) => {
        setRules(r1.data.rules);
        const list = r2.data.bankAccounts || [];
        setBanks(list);
        setBankId((prev) => {
          if (prev !== '') return prev;
          const def = list.find((b: Bank) => b.is_default);
          return def ? def.id : list[0]?.id ?? '';
        });
        setBalance(Number(r3.data.wallet.balance));
        setHeld(Number(r3.data.wallet.heldBalance ?? 0));
        setWithdrawals(r4.data.withdrawals || []);
      })
      .catch(() => toast.error('Could not load withdrawal data'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, [accessToken]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bankId) {
      toast.error('Select a bank account');
      return;
    }
    try {
      await api.post('/wallet/withdrawals', {
        bankAccountId: bankId,
        amount: gross,
        notes: notes.trim() || null
      });
      toast.success('Withdrawal requested');
      setAmount('');
      setNotes('');
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Request failed');
    }
  }

  async function cancelWd(id: number) {
    if (!confirm('Cancel this pending withdrawal? Funds return to your wallet.')) return;
    try {
      await api.post(`/wallet/withdrawals/${id}/cancel`);
      toast.success('Cancelled');
      loadAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Cancel failed');
    }
  }

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        <Link className="font-semibold text-brand-700" to="/login">
          Sign in
        </Link>{' '}
        to withdraw.
      </div>
    );
  }

  return (
    <FadeInSection className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Withdraw</h1>
        <p className="mt-1 text-sm text-slate-500">Funds move to hold until payout is completed or the request is rejected.</p>
      </div>
      <WalletSubNav />

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Available</p>
              <p className="mt-1 text-3xl font-bold text-emerald-900">₹{balance.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">On hold (withdrawals)</p>
              <p className="mt-1 text-3xl font-bold text-amber-950">₹{held.toFixed(2)}</p>
            </div>
          </div>

          {rules?.kycRequired ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              KYC is required for withdrawals. Contact support or complete verification when available.
            </div>
          ) : null}

          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">New request</h2>
            <label className="block text-xs text-slate-600">
              Bank account *
              <select
                value={bankId === '' ? '' : String(bankId)}
                onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : '')}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                required
              >
                <option value="">Select…</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} — {b.account_holder_name}
                    {b.is_default ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {banks.length === 0 ? (
              <p className="text-sm text-amber-800">
                <Link className="font-semibold underline" to="/wallet/bank-accounts">
                  Add a bank account
                </Link>{' '}
                first.
              </p>
            ) : null}
            <label className="block text-xs text-slate-600">
              Amount (gross) *
              <input
                type="number"
                step="0.01"
                min={rules?.minWithdrawalAmount}
                max={rules?.maxWithdrawalAmount ?? undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            {rules ? (
              <p className="text-xs text-slate-500">
                Min ₹{rules.minWithdrawalAmount}
                {rules.maxWithdrawalAmount != null ? ` · Max ₹${rules.maxWithdrawalAmount}` : ''}
              </p>
            ) : null}
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p>Fee: ₹{preview.fee.toFixed(2)}</p>
              <p className="font-semibold">You receive (net): ₹{preview.net.toFixed(2)}</p>
            </div>
            <label className="block text-xs text-slate-600">
              Note (optional)
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                maxLength={500}
              />
            </label>
            <button
              type="submit"
              disabled={!banks.length || gross <= 0 || gross > balance}
              className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              Submit request
            </button>
            {gross > balance ? <p className="text-sm text-red-600">Amount exceeds available balance.</p> : null}
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Your withdrawal requests</div>
            {withdrawals.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Gross</th>
                      <th className="px-4 py-2">Fee</th>
                      <th className="px-4 py-2">Net</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                          {new Date(w.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(w.status)}`}>
                            {w.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-medium">₹{Number(w.amount).toFixed(2)}</td>
                        <td className="px-4 py-2">₹{Number(w.fee_amount).toFixed(2)}</td>
                        <td className="px-4 py-2">₹{Number(w.net_amount).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">
                          {w.status === 'pending' ? (
                            <button type="button" onClick={() => cancelWd(w.id)} className="text-xs font-semibold text-red-600">
                              Cancel
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </FadeInSection>
  );
}
