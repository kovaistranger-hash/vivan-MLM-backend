import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';
import WalletSubNav from '../components/WalletSubNav';
import FadeInSection from '../components/motion/FadeInSection';
import IncomeChart from '@/components/dashboard/IncomeChart';

type Tx = {
  id: number;
  type: string;
  amount: string | number;
  balance_after: string | number;
  description: string | null;
  created_at: string;
};

function typeColor(t: string) {
  if (t.includes('credit') || t === 'refund' || t === 'order_refund' || t === 'commission_credit' || t === 'bonus_credit') {
    return 'text-emerald-700';
  }
  if (t.includes('debit') || t === 'order_payment') return 'text-red-700';
  if (t === 'withdrawal_hold') return 'text-amber-800';
  if (t === 'withdrawal_paid') return 'text-slate-600';
  if (t === 'withdrawal_reversed' || t === 'withdrawal_cancelled') return 'text-emerald-700';
  return 'text-slate-700';
}

export default function WalletPage() {
  const { accessToken } = useAuthStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [heldBalance, setHeldBalance] = useState<number | null>(null);
  const [intent, setIntent] = useState(0);
  const [recent, setRecent] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    api
      .get('/wallet')
      .then((r) => {
        setBalance(Number(r.data.wallet.balance));
        setHeldBalance(Number(r.data.wallet.heldBalance ?? 0));
        setIntent(Number(r.data.wallet.checkoutIntentAmount || 0));
        setRecent(r.data.wallet.recentTransactions || []);
      })
      .catch(() => toast.error('Could not load wallet'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        <Link className="font-semibold text-brand-700" to="/login">
          Sign in
        </Link>{' '}
        to view your wallet.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  return (
    <FadeInSection className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Wallet</h1>
        <p className="mt-1 text-sm text-slate-500">Store credit balance and recent activity.</p>
      </div>

      <WalletSubNav />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Available balance</p>
          <p className="mt-2 text-4xl font-bold text-emerald-900">₹{(balance ?? 0).toFixed(2)}</p>
          {intent > 0 ? (
            <p className="mt-2 text-sm text-emerald-800">
              ₹{intent.toFixed(2)} reserved for checkout — complete or clear from checkout.
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Held for withdrawals</p>
          <p className="mt-2 text-4xl font-bold text-amber-950">₹{(heldBalance ?? 0).toFixed(2)}</p>
          <Link to="/wallet/withdraw" className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:text-brand-900">
            Withdraw funds →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link to="/wallet/history" className="font-semibold text-brand-700 hover:text-brand-900">
          Ledger history →
        </Link>
        <Link to="/wallet/bank-accounts" className="font-semibold text-brand-700 hover:text-brand-900">
          Bank accounts →
        </Link>
      </div>

      <IncomeChart />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Recent transactions</h2>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No transactions yet. Admin credits or purchases will appear here.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {recent.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{t.description || t.type}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleString()} · <span className="font-mono">{t.type}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${typeColor(t.type)}`}>₹{Number(t.amount).toFixed(2)}</p>
                  <p className="text-xs text-slate-500">Balance ₹{Number(t.balance_after).toFixed(2)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FadeInSection>
  );
}
