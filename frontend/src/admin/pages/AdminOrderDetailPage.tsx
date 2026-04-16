import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { downloadOrderInvoice } from '../../utils/downloadInvoice';

const statuses = ['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'] as const;

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [status, setStatus] = useState<string>('pending');
  const [busy, setBusy] = useState(false);
  const [refundToWallet, setRefundToWallet] = useState(false);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recalcForce, setRecalcForce] = useState(false);

  function load() {
    if (!id) return;
    api.get(`/admin/orders/${id}`).then((r) => {
      setOrder(r.data.order);
      setStatus(r.data.order.status);
    });
  }

  useEffect(() => {
    load();
  }, [id]);

  async function saveStatus() {
    if (!id) return;
    setBusy(true);
    try {
      await api.patch(`/admin/orders/${id}/status`, { status, refundToWallet });
      toast.success('Order status updated');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/admin/orders" className="text-sm text-brand-700 hover:underline">
        ← Orders
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{order.order_number}</h1>
          <p className="text-sm text-slate-500">
            {order.user_name} · {order.user_email}
          </p>
          {order.invoice_number ? <p className="mt-1 text-xs text-slate-500">Invoice {order.invoice_number}</p> : null}
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await downloadOrderInvoice(Number(order.id));
              toast.success('Invoice downloaded');
            } catch {
              toast.error('Could not download invoice');
            }
          }}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Download invoice
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-sm font-medium text-slate-700">Order status</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={saveStatus} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Save status
          </button>
        </div>
        {(status === 'cancelled' || status === 'returned') && (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={refundToWallet} onChange={(e) => setRefundToWallet(e.target.checked)} />
            Refund to customer wallet (wallet + paid remainder, once per order)
          </label>
        )}
        <p className="mt-2 text-xs text-slate-500">Payment: {order.payment_status}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Commissions</p>
        <p className="mt-1">
          Profit basis (subtotal): <strong>₹{Number(order.subtotal ?? 0).toFixed(2)}</strong> · Stored profit_amount:{' '}
          <strong>₹{Number(order.profit_amount ?? 0).toFixed(2)}</strong>
        </p>
        <p className="mt-1">
          Status: <strong>{order.commission_status || '—'}</strong>
          {order.commission_processed_at ? (
            <span className="text-slate-500"> · processed {new Date(order.commission_processed_at).toLocaleString()}</span>
          ) : null}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={recalcForce} onChange={(e) => setRecalcForce(e.target.checked)} />
            Force (reverse prior payouts for this order, then re-run)
          </label>
          <button
            type="button"
            disabled={recalcBusy}
            onClick={async () => {
              if (!id) return;
              setRecalcBusy(true);
              try {
                const { data } = await api.post(`/admin/commissions/recalculate/${id}`, { force: recalcForce });
                toast.success(data.result?.processed ? 'Commissions processed' : `Skipped: ${data.result?.reason || ''}`);
                load();
              } catch (e: any) {
                toast.error(e.response?.data?.message || 'Recalculate failed');
              } finally {
                setRecalcBusy(false);
              }
            }}
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-900 hover:bg-brand-100 disabled:opacity-50"
          >
            Recalculate commissions
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Ship to</p>
        <p className="mt-1">
          {order.shipping_name}, {order.shipping_phone}
          <br />
          {order.shipping_address1}
          {order.shipping_address2 ? `, ${order.shipping_address2}` : ''}
          <br />
          {order.shipping_city}, {order.shipping_state} {order.shipping_pincode}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-4 py-2 text-sm font-semibold text-slate-900">Line items</div>
        <ul className="divide-y">
          {(order.items || []).map((it: any) => (
            <li key={it.id} className="flex justify-between px-4 py-3 text-sm">
              <span>
                {it.product_name} × {it.quantity}
              </span>
              <span className="font-medium">₹{Number(it.line_total).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t px-4 py-3 text-right text-sm">
          {Number(order.wallet_amount) > 0 ? (
            <p className="text-xs text-slate-500">Wallet applied ₹{Number(order.wallet_amount).toFixed(2)}</p>
          ) : null}
          <p className="font-semibold text-slate-900">Payable total ₹{Number(order.total_amount).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
