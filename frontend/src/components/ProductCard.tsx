import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Heart, ShoppingBag, Eye, X, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';
import { useWishlist } from '../hooks/useWishlist';
import { notifyCartChanged } from '../utils/cartNotify';
import { durations, easings } from './motion/motionTokens';

export type ProductCardModel = {
  id: number;
  name: string;
  slug: string;
  sale_price: number;
  mrp_price: number;
  image_url: string | null;
  short_description?: string | null;
  bv?: number;
  is_bestseller?: number | boolean | null;
  is_new_arrival?: number | boolean | null;
  is_featured?: number | boolean | null;
};

function truthy(v: unknown) {
  return v === true || v === 1 || v === '1';
}

function displayRating(id: number) {
  const r = 4.2 + (id % 8) / 10;
  return Math.min(5, Math.round(r * 10) / 10);
}

function ratingCount(id: number) {
  return 40 + (id * 17) % 520;
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`text-sm ${i <= rounded ? 'text-amber-400' : 'text-slate-200'}`}>
            ★
          </span>
        ))}
      </div>
      <span className="text-xs font-medium text-slate-500">
        {rating.toFixed(1)} <span className="text-slate-400">({count})</span>
      </span>
    </div>
  );
}

export default function ProductCard({ product }: { product: ProductCardModel }) {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const { items, toggle } = useWishlist();
  const [adding, setAdding] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickProduct, setQuickProduct] = useState<any>(null);
  const [heartAnim, setHeartAnim] = useState(false);

  const wishlisted = items.some((x) => x.id === product.id);

  const discount =
    product.mrp_price > product.sale_price
      ? Math.round(((Number(product.mrp_price) - Number(product.sale_price)) / Number(product.mrp_price)) * 100)
      : 0;

  const rating = displayRating(product.id);
  const reviews = ratingCount(product.id);
  const trending =
    truthy(product.is_bestseller) || truthy(product.is_new_arrival) || truthy(product.is_featured) || product.id % 7 === 0;

  useEffect(() => {
    if (!quickOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickOpen]);

  useEffect(() => {
    if (!quickOpen) {
      setQuickProduct(null);
      return;
    }
    let cancelled = false;
    setQuickLoading(true);
    api
      .get(`/products/${product.slug}`)
      .then((res) => {
        if (!cancelled) setQuickProduct(res.data.product);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load preview');
      })
      .finally(() => {
        if (!cancelled) setQuickLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quickOpen, product.slug]);

  const onWishlist = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const on = toggle(product);
      setHeartAnim(true);
      window.setTimeout(() => setHeartAnim(false), 400);
      toast.success(on ? 'Saved to wishlist' : 'Removed from wishlist');
    },
    [product, toggle]
  );

  const onAddCart = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!accessToken) {
        toast.message('Sign in to add items to your cart');
        navigate('/login');
        return;
      }
      setAdding(true);
      try {
        await api.post('/cart', { productId: product.id, quantity: 1 });
        notifyCartChanged();
        toast.success('Added to cart');
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Could not add to cart');
      } finally {
        setAdding(false);
      }
    },
    [accessToken, navigate, product.id]
  );

  const openQuick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickOpen(true);
  };

  const modal =
    quickOpen &&
    createPortal(
      <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          aria-label="Close"
          onClick={() => setQuickOpen(false)}
        />
        <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fadeInUp">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Quick view</h2>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              onClick={() => setQuickOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4">
            {quickLoading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                <p className="text-sm text-slate-500">Loading product…</p>
              </div>
            ) : quickProduct ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={quickProduct.image_url || 'https://placehold.co/600x600/1e1b4b/ffffff/png?text=Vivan'}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{quickProduct.brand_name || 'Vivan'}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{quickProduct.name}</h3>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3">{quickProduct.short_description}</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-brand-900">₹{Number(quickProduct.sale_price).toFixed(0)}</span>
                  {quickProduct.mrp_price > quickProduct.sale_price ? (
                    <span className="text-sm text-slate-400 line-through">₹{Number(quickProduct.mrp_price).toFixed(0)}</span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onAddCart}
                    disabled={adding}
                    className="flex-1 rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-800 disabled:opacity-50"
                  >
                    {adding ? 'Adding…' : 'Add to cart'}
                  </button>
                  <Link
                    to={`/products/${product.slug}`}
                    onClick={() => setQuickOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-brand-300"
                  >
                    Full details
                  </Link>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">Product unavailable.</p>
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <motion.div
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-md will-change-transform"
        whileHover={
          reduceMotion
            ? undefined
            : {
                y: -6,
                boxShadow: '0 22px 50px -18px rgba(30, 27, 75, 0.32)',
                borderColor: 'rgba(199, 210, 254, 0.9)'
              }
        }
        transition={{ duration: durations.fast, ease: easings.smooth }}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
          <Link to={`/products/${product.slug}`} className="block h-full w-full">
            <motion.img
              src={product.image_url || 'https://placehold.co/800x1000/0f172a/ffffff/png?text=Vivan'}
              alt={product.name}
              className="h-full w-full object-cover"
              loading="lazy"
              whileHover={reduceMotion ? undefined : { scale: 1.06 }}
              transition={{ duration: 0.45, ease: easings.smooth }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent opacity-90 transition duration-500 group-hover:from-slate-950/75" />
          </Link>
          {trending ? (
            <span className="absolute left-3 top-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
              Trending
            </span>
          ) : null}
          {discount > 0 ? (
            <span
              className={`absolute ${trending ? 'left-3 top-12' : 'left-3 top-3'} rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow`}
            >
              {discount}% off
            </span>
          ) : null}
          <motion.button
            type="button"
            onClick={onWishlist}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            animate={heartAnim && !reduceMotion ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={{ duration: 0.35, ease: easings.smooth }}
            whileTap={{ scale: 0.94 }}
            className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/95 text-slate-700 shadow-lg backdrop-blur transition hover:text-rose-600 ${
              wishlisted ? 'text-rose-600' : ''
            }`}
          >
            <Heart className={`h-5 w-5 transition-transform ${wishlisted ? 'fill-current scale-110' : ''}`} />
          </motion.button>
          <div className="absolute inset-x-0 bottom-0 z-[5] translate-y-0 p-3 transition duration-300 ease-out md:translate-y-full md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
            <div className="flex gap-2 rounded-xl bg-black/55 p-2 shadow-lg ring-1 ring-white/10 backdrop-blur-md md:bg-black/40">
              <motion.button
                type="button"
                onClick={onAddCart}
                disabled={adding}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white py-2.5 text-xs font-bold text-brand-900 shadow transition hover:bg-brand-50 disabled:opacity-50 sm:text-sm"
              >
                <ShoppingBag className="h-4 w-4 shrink-0" />
                {adding ? '…' : 'Add to cart'}
              </motion.button>
              <motion.button
                type="button"
                onClick={openQuick}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 sm:text-sm"
              >
                <Eye className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Quick</span>
              </motion.button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
          <StarRow rating={rating} count={reviews} />
          <div>
            <Link to={`/products/${product.slug}`} className="block">
              <h3 className="text-base font-semibold leading-snug text-slate-900 transition group-hover:text-brand-700 line-clamp-2">
                {product.name}
              </h3>
            </Link>
            {product.short_description ? (
              <p className="mt-1.5 text-sm text-slate-500 line-clamp-2">{product.short_description}</p>
            ) : null}
          </div>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3">
            <div>
              <p className="text-lg font-bold text-brand-900">₹{Number(product.sale_price).toFixed(0)}</p>
              {product.mrp_price > product.sale_price ? (
                <p className="text-xs text-slate-400 line-through">MRP ₹{Number(product.mrp_price).toFixed(0)}</p>
              ) : null}
            </div>
            {typeof product.bv === 'number' ? (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800">BV {product.bv}</span>
            ) : null}
          </div>

          <div className="flex gap-2 md:hidden">
            <button
              type="button"
              onClick={onAddCart}
              disabled={adding}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-800 hover:shadow-lg disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />
              {adding ? 'Adding…' : 'Add to cart'}
            </button>
            <button
              type="button"
              onClick={openQuick}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-400 hover:bg-brand-50/60 hover:shadow-md"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Quick view</span>
            </button>
          </div>
        </div>
      </motion.div>
      {modal}
    </>
  );
}
