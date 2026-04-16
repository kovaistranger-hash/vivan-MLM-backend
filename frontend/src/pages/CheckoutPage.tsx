import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import FadeInSection from '../components/motion/FadeInSection';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';
import { loadRazorpayScript } from '../utils/razorpay';

type Preview = {
  success: boolean;
  merchandiseSubtotal: number;
  gstTotal: number;
  shippingAmount: number;
  totalAmount: number;
  grossTotal?: number;
  walletApplied?: number;
  payableTotal?: number;
  walletBalance?: number;
  zonesConfigured: boolean;
  codGloballyEnabled: boolean;
  codAvailableForPin: boolean;
  freeShippingAbove: number;
  defaultShippingFee: number;
  delivery: { city: string; state: string; estimated_days: number; pincode: string } | null;
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuthStore();
  const [cart, setCart] = useState<any>(null);
  const [form, setForm] = useState({
    shippingName: '',
    shippingPhone: '',
    shippingAddress1: '',
    shippingAddress2: '',
    shippingCity: '',
    shippingState: '',
    shippingPincode: '',
    paymentMethod: 'cod' as 'cod' | 'online',
    customerGstin: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [walletInput, setWalletInput] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    api.get('/cart').then((res) => setCart(res.data.cart));
    api
      .get('/wallet')
      .then((r) => setWalletBalance(Number(r.data.wallet.balance)))
      .catch(() => setWalletBalance(null));
  }, [accessToken]);

  const normalizedPin = form.shippingPincode.replace(/\s/g, '');
  const walletRequest = Math.max(0, Number(walletInput) || 0);

  useEffect(() => {
    if (!accessToken || !cart?.items?.length) return;
    if (normalizedPin.length < 6) {
      setPreview(null);
      setPreviewErr(null);
      return;
    }
    const t = window.setTimeout(() => {
      setPreviewLoading(true);
      const params: Record<string, string | number> = { pincode: normalizedPin };
      if (walletRequest > 0) params.walletAmount = walletRequest;
      api
        .get('/checkout/preview', { params })
        .then((res) => {
          setPreview(res.data as Preview);
          setPreviewErr(null);
        })
        .catch((e: any) => {
          setPreview(null);
          setPreviewErr(e.response?.data?.message || 'Could not verify delivery for this PIN.');
        })
        .finally(() => setPreviewLoading(false));
    }, 450);
    return () => window.clearTimeout(t);
  }, [accessToken, normalizedPin, cart?.items?.length, walletRequest]);

  useEffect(() => {
    if (normalizedPin.length < 6 || previewLoading || previewErr || !preview) return;
    if (form.paymentMethod === 'cod' && !(preview.codGloballyEnabled && preview.codAvailableForPin)) {
      setForm((f) => ({ ...f, paymentMethod: 'online' }));
    }
  }, [normalizedPin, preview, previewLoading, previewErr, form.paymentMethod]);

  const pinBlocked = normalizedPin.length >= 6 && (!!previewErr || previewLoading);
  const codSelectable =
    normalizedPin.length < 6 ||
    !preview ||
    (preview.codGloballyEnabled && preview.codAvailableForPin && !previewErr && !previewLoading);

  const grossPreview = preview ? Number(preview.grossTotal ?? preview.totalAmount) : 0;
  const appliedPreview = preview && !previewErr ? Number(preview.walletApplied ?? 0) : 0;
  const payablePreview = preview && !previewErr ? Number(preview.payableTotal ?? preview.totalAmount) : 0;

  async function syncWalletUse() {
    if (normalizedPin.length < 6) {
      toast.error('Enter a valid PIN first');
      return;
    }
    if (walletRequest <= 0) {
      await api.post('/wallet/remove');
      setWalletInput('');
      toast.message('Wallet amount cleared');
      return;
    }
    try {
      await api.post('/wallet/use', { amount: walletRequest, pincode: normalizedPin });
      toast.success('Wallet amount saved for checkout');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not apply wallet');
    }
  }

  async function clearWalletUse() {
    try {
      await api.post('/wallet/remove');
      setWalletInput('');
      toast.message('Wallet amount cleared');
    } catch {
      toast.error('Could not clear wallet');
    }
  }

  async function placeLocalOrder() {
    const walletAmount =
      preview && !previewErr && !previewLoading ? Number(preview.walletApplied ?? 0) : Math.max(0, Number(walletInput) || 0);
    const payload = {
      ...form,
      customerGstin: form.customerGstin.trim() || undefined,
      shippingAddress2: form.shippingAddress2.trim() || undefined,
      walletAmount
    };
    const { data } = await api.post('/orders', payload);
    return data.order as { id: number; order_number: string; total_amount: number };
  }

  async function payWithRazorpay(order: { id: number; order_number: string }) {
    const key = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
    if (!key) {
      toast.error('Missing VITE_RAZORPAY_KEY_ID — add it to frontend .env');
      return;
    }
    await loadRazorpayScript();
    const Rzp = window.Razorpay;
    if (!Rzp) {
      toast.error('Razorpay script failed to load');
      return;
    }

    const { data } = await api.post('/payments/razorpay/order', { orderId: order.id });
    const opts: Record<string, unknown> = {
      key,
      amount: data.amount,
      currency: data.currency || 'INR',
      order_id: data.orderId,
      name: 'Vivan',
      description: `Order ${order.order_number}`,
      prefill: {
        name: user?.name,
        email: user?.email
      },
      handler: async (response: Record<string, string>) => {
        try {
          await api.post('/payments/razorpay/verify', {
            localOrderId: order.id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          });
          toast.success('Payment successful');
          navigate(`/orders/track/${order.order_number}`);
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Payment verification failed');
        } finally {
          setSubmitting(false);
          submitLock.current = false;
        }
      },
      modal: {
        ondismiss: () => {
          setSubmitting(false);
          submitLock.current = false;
          toast.message('Payment window closed — order remains unpaid until you complete Razorpay.');
        }
      }
    };

    const inst = new Rzp(opts);
    inst.open();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || submitLock.current) return;
    if (pinBlocked) {
      toast.error('Fix delivery for your PIN code before placing the order.');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const order = await placeLocalOrder();
      const due = Number(order.total_amount);

      if (form.paymentMethod === 'cod') {
        toast.success(due <= 0 ? 'Order placed — fully paid from wallet' : 'Order placed');
        navigate(`/orders/track/${order.order_number}`);
        submitLock.current = false;
        setSubmitting(false);
        return;
      }

      if (due <= 0) {
        toast.success('Order placed — fully paid from wallet');
        navigate(`/orders/track/${order.order_number}`);
        submitLock.current = false;
        setSubmitting(false);
        return;
      }

      await payWithRazorpay(order);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Checkout failed');
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        Please{' '}
        <Link className="font-semibold text-brand-700" to="/login">
          sign in
        </Link>{' '}
        to checkout.
      </div>
    );
  }

  if (!cart) {
    return <p className="text-sm text-slate-500">Preparing checkout…</p>;
  }

  if (!cart.items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Your cart is empty.{' '}
        <Link className="font-semibold text-brand-700" to="/products">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
      <FadeInSection className="min-w-0">
        <h1 className="text-3xl font-semibold text-slate-900">Checkout</h1>
        <p className="mt-2 text-sm text-slate-500">
          COD places immediately. Pay online creates your order first, then opens Razorpay — payment is only confirmed after server
          signature verification. Wallet amounts are re-checked on the server when you place the order.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Full name
              <input
                required
                value={form.shippingName}
                onChange={(e) => setForm({ ...form, shippingName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Phone
              <input
                required
                value={form.shippingPhone}
                onChange={(e) => setForm({ ...form, shippingPhone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="text-sm font-medium text-slate-700">
            Address line 1
            <input
              required
              value={form.shippingAddress1}
              onChange={(e) => setForm({ ...form, shippingAddress1: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Address line 2 (optional)
            <input
              value={form.shippingAddress2}
              onChange={(e) => setForm({ ...form, shippingAddress2: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              City
              <input
                required
                value={form.shippingCity}
                onChange={(e) => setForm({ ...form, shippingCity: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              State
              <input
                required
                value={form.shippingState}
                onChange={(e) => setForm({ ...form, shippingState: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              PIN code
              <input
                required
                value={form.shippingPincode}
                onChange={(e) => setForm({ ...form, shippingPincode: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          {normalizedPin.length >= 6 ? (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                previewErr ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {previewLoading ? (
                <span>Checking delivery for your PIN…</span>
              ) : previewErr ? (
                <span>{previewErr}</span>
              ) : preview ? (
                <span>
                  {preview.zonesConfigured ? (
                    <>
                      Delivers to {preview.delivery?.city}, {preview.delivery?.state}. ETA ~{preview.delivery?.estimated_days} day(s).
                      Shipping on this order: <strong>₹{Number(preview.shippingAmount).toFixed(2)}</strong> (free above ₹
                      {Number(preview.freeShippingAbove).toFixed(0)} on merchandise).
                    </>
                  ) : (
                    <>
                      Pincode zones are not active — default shipping rules apply. Shipping on this order:{' '}
                      <strong>₹{Number(preview.shippingAmount).toFixed(2)}</strong>.
                    </>
                  )}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Enter a 6-digit PIN to see delivery, shipping, and COD availability.</p>
          )}

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <p className="text-sm font-semibold text-emerald-900">Use wallet balance</p>
            <p className="mt-1 text-xs text-emerald-800">
              Available:{' '}
              <strong>{walletBalance != null ? `₹${walletBalance.toFixed(2)}` : '—'}</strong>. Enter an amount after PIN is valid;
              preview updates automatically. Optional: sync to server before paying.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium text-emerald-900">
                Amount (₹)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  className="mt-1 w-36 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                  placeholder="0"
                />
              </label>
              <button
                type="button"
                disabled={!preview || !!previewErr || previewLoading || walletBalance == null}
                onClick={() => {
                  const cap = Math.min(grossPreview, walletBalance ?? 0);
                  setWalletInput(cap > 0 ? String(cap) : '0');
                }}
                className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-40"
              >
                Use max
              </button>
              <button
                type="button"
                onClick={syncWalletUse}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Sync to server
              </button>
              <button type="button" onClick={clearWalletUse} className="text-xs font-semibold text-red-700 hover:underline">
                Remove
              </button>
            </div>
          </div>

          <label className="text-sm font-medium text-slate-700">
            GSTIN (optional)
            <input
              value={form.customerGstin}
              onChange={(e) => setForm({ ...form, customerGstin: e.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800">Payment</legend>
            <label className={`flex items-center gap-2 text-sm ${codSelectable ? 'text-slate-700' : 'text-slate-400'}`}>
              <input
                type="radio"
                name="pay"
                disabled={!codSelectable}
                checked={form.paymentMethod === 'cod'}
                onChange={() => setForm({ ...form, paymentMethod: 'cod' })}
              />
              Cash on delivery
              {!codSelectable && normalizedPin.length >= 6 ? <span className="text-xs">(not available)</span> : null}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="pay"
                checked={form.paymentMethod === 'online'}
                onChange={() => setForm({ ...form, paymentMethod: 'online' })}
              />
              Pay online (Razorpay)
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={submitting || pinBlocked}
            className="w-full rounded-full bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Processing…' : form.paymentMethod === 'cod' ? 'Place order' : 'Place order & pay with Razorpay'}
          </button>
        </form>
      </FadeInSection>

      <motion.aside
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
        <div className="divide-y divide-slate-100 text-sm">
          {cart.items.map((item: any, i: number) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={item.image_url || 'https://placehold.co/80x80/png?text=Vivan'}
                  alt=""
                  className="h-14 w-14 flex-shrink-0 rounded-lg border border-slate-100 object-cover"
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 line-clamp-2">{item.name}</p>
                  <p className="text-xs text-slate-500">Qty {item.quantity}</p>
                </div>
              </div>
              <p className="flex-shrink-0 font-semibold text-slate-900">₹{(Number(item.sale_price) * item.quantity).toFixed(0)}</p>
            </motion.div>
          ))}
        </div>
        {preview && !previewErr && !previewLoading ? (
          <motion.div
            key={`${payablePreview}-${appliedPreview}`}
            initial={{ opacity: 0.75 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600"
          >
            <div className="flex justify-between">
              <span>Merchandise</span>
              <span>₹{Number(preview.merchandiseSubtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST</span>
              <span>₹{Number(preview.gstTotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>₹{Number(preview.shippingAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Subtotal (gross)</span>
              <span>₹{grossPreview.toFixed(2)}</span>
            </div>
            {appliedPreview > 0 ? (
              <div className="flex justify-between font-medium text-emerald-800">
                <span>Wallet</span>
                <span>−₹{appliedPreview.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-slate-900">
              <span>Payable</span>
              <span>₹{payablePreview.toFixed(2)}</span>
            </div>
          </motion.div>
        ) : (
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
            Enter your PIN to preview GST, shipping, and totals. Final amounts are confirmed on the server when the order is placed.
          </p>
        )}
      </motion.aside>
    </div>
  );
}
