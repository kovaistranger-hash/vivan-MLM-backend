import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';
import WalletSubNav from '../components/WalletSubNav';

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

export default function WalletHistoryPage() {
  const { accessToken } = useAuthStore();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Tx[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setLoading(true);
    api
      .get('/wallet/transactions', { params: { page, pageSize: 20 } })
      .then((r) => {
        if (cancelled) return;
        setItems(r.data.transactions || []);
        setTotalPages(r.data.pagination?.totalPages || 1);
      })
      .catch(() => toast.error('Could not load transactions'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, page]);

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        <Link className="font-semibold text-brand-700" to="/login">
          Sign in
        </Link>{' '}
        to view wallet history.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Wallet history</h1>
          <p className="mt-1 text-sm text-slate-500">Date, type, amount, and balance after each entry.</p>
        </div>
        <Link to="/wallet" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
          ← Wallet overview
        </Link>
      </div>

      <WalletSubNav />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Balance after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((t) => (
                  <tr key={t.id} className="text-slate-700">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{t.type}</td>
                    <td className={`px-4 py-3 font-semibold ${typeColor(t.type)}`}>₹{Number(t.amount).toFixed(2)}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600">{t.description || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">₹{Number(t.balance_after).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
