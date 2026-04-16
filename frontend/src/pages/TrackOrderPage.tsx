import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'sonner';

export default function TrackOrderPage() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!orderNumber) return;
    api
      .get(`/orders/track/${orderNumber}`)
      .then((res) => {
        setOrder(res.data.order);
        document.title = `Order ${orderNumber} | Vivan`;
      })
      .catch(() => toast.error('Order not found'));
  }, [orderNumber]);

  if (!order) {
    return <p className="text-sm text-slate-500">Loading order…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Order tracking</h1>
        <p className="text-sm text-slate-500">{order.order_number}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
          <p className="text-lg font-semibold text-slate-900">{order.status}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payment</p>
          <p className="text-lg font-semibold text-slate-900">{order.payment_status}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Payable total</p>
          <p className="text-lg font-semibold text-slate-900">₹{Number(order.total_amount).toFixed(2)}</p>
          {Number(order.wallet_amount) > 0 ? (
            <p className="mt-1 text-xs text-emerald-800">Includes ₹{Number(order.wallet_amount).toFixed(2)} from wallet</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <p>
          <span className="font-semibold text-slate-900">Ship to:</span> {order.shipping_name}, {order.shipping_phone}
        </p>
        <p className="mt-2">
          {order.shipping_address1}
          {order.shipping_address2 ? `, ${order.shipping_address2}` : ''}, {order.shipping_city}, {order.shipping_state}{' '}
          {order.shipping_pincode}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Items</h2>
        <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {(order.items || []).map((item: any) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{item.product_name}</p>
                <p className="text-xs text-slate-500">
                  Qty {item.quantity} · GST {Number(item.gst_rate).toFixed(0)}%
                </p>
              </div>
              <p className="font-semibold text-slate-900">₹{Number(item.line_total).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
