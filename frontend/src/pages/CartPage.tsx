import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';
import { notifyCartChanged } from '../utils/cartNotify';

type CartItem = {
  id: number;
  quantity: number;
  product_id: number;
  name: string;
  slug: string;
  sale_price: number;
  mrp_price: number;
  image_url: string | null;
  gst_rate: number;
  bv: number;
};

export default function CartPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [cart, setCart] = useState<{ items: CartItem[]; subtotal: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    api
      .get('/cart')
      .then((res) => setCart(res.data.cart))
      .catch(() => toast.error('Unable to load cart'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function updateQty(itemId: number, quantity: number) {
    try {
      const res = await api.patch(`/cart/${itemId}`, { quantity });
      setCart(res.data.cart);
      notifyCartChanged();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Update failed');
    }
  }

  async function remove(itemId: number) {
    try {
      const res = await api.delete(`/cart/${itemId}`);
      setCart(res.data.cart);
      notifyCartChanged();
    } catch {
      toast.error('Could not remove item');
    }
  }

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        <p>Sign in to view your cart.</p>
        <Link className="mt-3 inline-block text-sm font-semibold text-brand-700" to="/login">
          Go to login
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading cart…</p>;
  }

  if (!cart?.items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Your cart is empty.{' '}
        <Link className="font-semibold text-brand-700" to="/products">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-900">Your cart</h1>
        <button
          type="button"
          onClick={() => navigate('/checkout')}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Proceed to checkout
        </button>
      </div>

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {cart.items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <img
                src={item.image_url || 'https://placehold.co/200x200/png?text=Vivan'}
                alt=""
                className="h-24 w-24 rounded-xl object-cover"
              />
              <div className="min-w-[180px] flex-1">
                <Link to={`/products/${item.slug}`} className="text-base font-semibold text-slate-900 hover:text-brand-700">
                  {item.name}
                </Link>
                <p className="text-xs text-slate-500">GST {Number(item.gst_rate).toFixed(0)}% · BV {Number(item.bv).toFixed(0)}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateQty(item.id, Number(e.target.value))}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm transition-shadow duration-200 focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div className="text-right">
                <motion.p
                  key={item.quantity + item.sale_price}
                  initial={{ opacity: 0.65 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="text-sm font-semibold text-slate-900"
                >
                  ₹{(Number(item.sale_price) * item.quantity).toFixed(0)}
                </motion.p>
                <button type="button" className="text-xs font-semibold text-red-600" onClick={() => remove(item.id)}>
                  Remove
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Merchandise subtotal</p>
          <p className="text-2xl font-bold text-slate-900">₹{Number(cart.subtotal).toFixed(2)}</p>
          <p className="text-xs text-slate-500">Shipping, GST, and promos calculate at checkout.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/checkout')}
          className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Checkout
        </button>
      </motion.div>
    </div>
  );
}
