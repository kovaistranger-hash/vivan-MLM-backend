import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { downloadOrderInvoice } from '../utils/downloadInvoice';
import { toast } from 'sonner';

export default function OrdersPage() {
  const { accessToken } = useAuthStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [walletBal, setWalletBal] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    api.get('/orders/my').then((res) => setOrders(res.data.orders || []));
    api
      .get('/wallet')
      .then((r) => setWalletBal(Number(r.data.wallet.balance)))
      .catch(() => setWalletBal(null));
  }, [accessToken]);

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        <Link className="font-semibold text-brand-700" to="/login">
          Sign in
        </Link>{' '}
        to view your orders.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">My orders</h1>
      {walletBal != null ? (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-800">Wallet balance</p>
              <p className="text-2xl font-bold text-emerald-900">₹{walletBal.toFixed(2)}</p>
            </div>
            <Link
              to="/wallet"
              className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              Wallet & history
            </Link>
          </div>
        </div>
      ) : null}
      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-slate-900">{o.order_number}</p>
                <p className="text-xs text-slate-500">
                  {o.status} · {o.payment_status} · ₹{Number(o.total_amount).toFixed(2)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                  onClick={async () => {
                    try {
                      await downloadOrderInvoice(o.id);
                    } catch {
                      toast.error('Could not download invoice');
                    }
                  }}
                >
                  Invoice
                </button>
                <Link className="text-sm font-semibold text-brand-700 hover:text-brand-900" to={`/orders/track/${o.order_number}`}>
                  Track
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
