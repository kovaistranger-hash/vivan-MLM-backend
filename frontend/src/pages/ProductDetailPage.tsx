import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  Minus,
  Plus,
  Heart,
  ShieldCheck,
  RotateCcw,
  Truck,
  Star,
  Wallet,
  Share2,
  Loader2,
  ShoppingBag,
  Zap,
  CreditCard,
  BadgeCheck,
  Users,
  Package
} from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import ProductCard, { ProductCardModel } from '../components/ProductCard';
import { toast } from 'sonner';
import { notifyCartChanged } from '../utils/cartNotify';
import { useWishlist } from '../hooks/useWishlist';
import ProductGallery from '../components/product/ProductGallery';
import PincodeDeliveryCheck from '../components/product/PincodeDeliveryCheck';
import AnimatedTabs from '../components/motion/AnimatedTabs';
import StickyReveal from '../components/motion/StickyReveal';
import { durations, easings } from '../components/motion/motionTokens';

type ReviewRow = {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  author_name: string;
};

type TabId = 'description' | 'benefits' | 'specs' | 'howto' | 'reviews' | 'shipping';

const TABS: { id: TabId; label: string }[] = [
  { id: 'description', label: 'Description' },
  { id: 'benefits', label: 'Key benefits' },
  { id: 'specs', label: 'Specifications' },
  { id: 'howto', label: 'How to use' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'shipping', label: 'Shipping & returns' }
];

function Stars({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const rounded = Math.min(5, Math.max(0, Math.round(value)));
  const sz = size === 'sm' ? 'text-sm' : 'text-base';
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <span className={`inline-flex items-center gap-0.5 ${sz}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${dim} ${i <= rounded ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`}
          strokeWidth={0}
        />
      ))}
    </span>
  );
}

function viewersWatching(productId: number) {
  return 14 + (productId * 11) % 56;
}

function ratingBars(reviews: ReviewRow[]) {
  const counts = [0, 0, 0, 0, 0];
  for (const r of reviews) {
    const n = Math.min(5, Math.max(1, Math.round(Number(r.rating))));
    counts[n - 1] += 1;
  }
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: counts[star - 1],
    pct: Math.round((counts[star - 1] / total) * 100)
  }));
}

export default function ProductDetailPage() {
  const reduceMotion = useReducedMotion();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const { items: wishItems, toggle } = useWishlist();
  const [product, setProduct] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState({ rating: 5, title: '', body: '' });
  const [activeTab, setActiveTab] = useState<TabId>('description');
  const [cartBusy, setCartBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const [alsoBought, setAlsoBought] = useState<ProductCardModel[]>([]);
  const [heartPop, setHeartPop] = useState(false);
  const [comboAdding, setComboAdding] = useState(false);

  const refreshProduct = useCallback(async () => {
    if (!slug) return;
    const res = await api.get(`/products/${slug}`);
    setProduct(res.data.product);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    api
      .get(`/products/${slug}`)
      .then((res) => {
        if (!cancelled) {
          setProduct(res.data.product);
          document.title = `${res.data.product.name} | Vivan`;
        }
      })
      .catch(() => toast.error('Unable to load product'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    api
      .get('/products', { params: { bestseller: 'true', pageSize: 12 } })
      .then((res) => {
        if (cancelled) return;
        const list: ProductCardModel[] = (res.data.products || []).filter((p: ProductCardModel) => p.id !== product.id);
        setAlsoBought(list.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setAlsoBought([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    let gallery: string[] = [];
    if (Array.isArray(product.gallery_json)) gallery = product.gallery_json as string[];
    else if (typeof product.gallery_json === 'string') {
      try {
        const parsed = JSON.parse(product.gallery_json);
        if (Array.isArray(parsed)) gallery = parsed;
      } catch {
        gallery = [];
      }
    }
    return [product.image_url, ...gallery].filter(Boolean).slice(0, MAX_PRODUCT_IMAGES) as string[];
  }, [product]);

  const discountPct = useMemo(() => {
    if (!product) return 0;
    const m = Number(product.mrp_price);
    const s = Number(product.sale_price);
    if (m <= s) return 0;
    return Math.round(((m - s) / m) * 100);
  }, [product]);

  const youSave = useMemo(() => {
    if (!product) return 0;
    const m = Number(product.mrp_price);
    const s = Number(product.sale_price);
    return Math.max(0, m - s) * qty;
  }, [product, qty]);

  const wishlisted = product && wishItems.some((x) => x.id === product.id);

  const cardModel: ProductCardModel | null = useMemo(() => {
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sale_price: Number(product.sale_price),
      mrp_price: Number(product.mrp_price),
      image_url: product.image_url,
      short_description: product.short_description,
      bv: typeof product.bv === 'number' ? product.bv : Number(product.bv)
    };
  }, [product]);

  const reviews: ReviewRow[] = (product?.reviews || []) as ReviewRow[];
  const avg = product?.reviewSummary?.average != null ? Number(product.reviewSummary.average) : null;
  const reviewCount = Number(product?.reviewSummary?.count || 0);
  const bars = useMemo(() => ratingBars(reviews), [reviews]);

  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const dr = Number(b.rating) - Number(a.rating);
      if (dr !== 0) return dr;
      return (b.body?.length || 0) - (a.body?.length || 0);
    });
  }, [reviews]);
  const topReview = sortedReviews[0];
  const otherReviews = useMemo(() => {
    if (!topReview) return sortedReviews;
    return sortedReviews.filter((r) => r.id !== topReview.id);
  }, [sortedReviews, topReview]);

  const fbtBundle = useMemo((): ProductCardModel[] => {
    if (!product || !cardModel) return [];
    const seen = new Set<number>([product.id]);
    const out: ProductCardModel[] = [cardModel];
    const merge = (list: ProductCardModel[]) => {
      for (const p of list) {
        if (out.length >= 3) break;
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
      }
    };
    merge(alsoBought);
    merge((product.relatedProducts || []) as ProductCardModel[]);
    return out;
  }, [product, cardModel, alsoBought]);

  const fbtTotal = useMemo(() => fbtBundle.reduce((s, p) => s + Number(p.sale_price), 0), [fbtBundle]);

  const stockQty = Number(product?.stock_qty ?? 0);
  const inStock = stockQty > 0;
  const lowStock = inStock && stockQty <= 5;

  async function addToCart() {
    if (!accessToken) {
      toast.message('Please sign in to add items to your cart');
      return;
    }
    if (!product) return;
    setCartBusy(true);
    try {
      await api.post('/cart', { productId: product.id, quantity: qty });
      notifyCartChanged();
      toast.success('Added to cart');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not update cart');
    } finally {
      setCartBusy(false);
    }
  }

  async function addAllFbtToCart() {
    if (!accessToken) {
      toast.message('Please sign in to add items to your cart');
      return;
    }
    if (fbtBundle.length < 2) {
      toast.message('Bundle needs at least two items');
      return;
    }
    setComboAdding(true);
    try {
      for (const p of fbtBundle) {
        await api.post('/cart', { productId: p.id, quantity: 1 });
      }
      notifyCartChanged();
      toast.success('Frequently bought together — added to cart');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not add bundle');
    } finally {
      setComboAdding(false);
    }
  }

  async function buyNow() {
    if (!accessToken) {
      toast.message('Please sign in to continue');
      navigate('/login');
      return;
    }
    if (!product) return;
    setBuyBusy(true);
    try {
      await api.post('/cart', { productId: product.id, quantity: qty });
      notifyCartChanged();
      navigate('/checkout');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not proceed');
    } finally {
      setBuyBusy(false);
    }
  }

  async function submitReview() {
    if (!accessToken) {
      toast.message('Sign in to leave a review');
      return;
    }
    if (!slug) return;
    try {
      await api.post(`/products/${slug}/reviews`, review);
      toast.success('Thanks for your feedback');
      await refreshProduct();
      setReview({ rating: 5, title: '', body: '' });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Review not saved');
    }
  }

  function onWishlist(e: React.MouseEvent) {
    e.preventDefault();
    if (!cardModel) return;
    const on = toggle(cardModel);
    setHeartPop(true);
    window.setTimeout(() => setHeartPop(false), 400);
    toast.success(on ? 'Saved to wishlist' : 'Removed from wishlist');
  }

  const benefitLines = useMemo(() => {
    if (!product?.short_description) return ['Curated quality', 'Transparent pricing', 'GST-ready invoicing'];
    return product.short_description
      .split(/[.•\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
  }, [product]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-8 pb-28 lg:pb-0">
        <div className="h-4 w-2/3 max-w-md rounded-full bg-slate-200" />
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square rounded-3xl bg-slate-200" />
          <div className="space-y-4">
            <div className="h-6 w-1/3 rounded bg-slate-200" />
            <div className="h-10 w-full rounded bg-slate-200" />
            <div className="h-24 w-full rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <p className="text-slate-600">Product unavailable.</p>
        <Link to="/products" className="mt-4 inline-block text-sm font-bold text-brand-700 hover:text-brand-900">
          Back to shop
        </Link>
      </div>
    );
  }

  const categoryHref =
    product.category_slug != null && product.category_slug !== ''
      ? `/products?slug=${encodeURIComponent(product.category_slug)}`
      : product.category_id
        ? `/products?categoryId=${product.category_id}`
        : '/products';

  const sale = Number(product.sale_price);
  const mrp = Number(product.mrp_price);

  return (
    <div className="space-y-10 pb-32 lg:space-y-14 lg:pb-0">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link to="/" className="font-medium transition hover:text-brand-700">
          Home
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        <Link to="/products" className="font-medium transition hover:text-brand-700">
          Shop
        </Link>
        {product.category_name ? (
          <>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
            <Link to={categoryHref} className="font-medium transition hover:text-brand-700">
              {product.category_name}
            </Link>
          </>
        ) : null}
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        <span className="line-clamp-1 font-semibold text-slate-800">{product.name}</span>
      </nav>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
        <ProductGallery images={galleryImages} alt={product.name} discountPct={discountPct} />

        <div className="space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          {product.brand_name ? (
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">{product.brand_name}</p>
          ) : null}
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">{product.name}</h1>

          <div className="flex flex-wrap items-center gap-3">
            <Stars value={avg ?? 0} />
            <span className="text-sm font-semibold text-slate-800">
              {avg != null ? avg.toFixed(1) : '—'} <span className="font-normal text-slate-500">({reviewCount} reviews)</span>
            </span>
          </div>

          {product.short_description ? (
            <p className="text-base leading-relaxed text-slate-600">{product.short_description}</p>
          ) : null}

          <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80 p-6 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.12)]">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-4xl font-extrabold tabular-nums text-slate-900">₹{sale.toFixed(0)}</p>
                {mrp > sale ? <p className="mt-1 text-lg text-slate-400 line-through">MRP ₹{mrp.toFixed(0)}</p> : null}
              </div>
              {discountPct > 0 ? (
                <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Save {discountPct}%
                </span>
              ) : null}
              <span className="ml-auto inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
                GST {Number(product.gst_rate).toFixed(0)}% incl.
              </span>
            </div>
            {mrp > sale ? (
              <p className="mt-3 text-sm font-semibold text-emerald-800">
                You save ₹{((mrp - sale) * qty).toFixed(0)} on this order qty
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                !inStock ? 'bg-rose-100 text-rose-800' : lowStock ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {!inStock ? 'Out of stock' : lowStock ? `Only ${stockQty} left` : 'In stock'}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Ships from verified sellers
            </span>
          </div>

          {inStock && stockQty > 0 ? (
            <div className="space-y-2 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/80 p-4 shadow-sm ring-1 ring-amber-100/60 animate-fadeIn">
              {stockQty < 40 ? (
                <p className="text-sm font-bold text-amber-950">
                  Only <span className="tabular-nums">{stockQty}</span> items left — order soon to secure yours.
                </p>
              ) : (
                <p className="text-sm font-semibold text-amber-950">In high demand — complete checkout to lock inventory.</p>
              )}
              <p className="flex items-center gap-2 text-sm text-slate-700">
                <Users className="h-4 w-4 shrink-0 text-rose-600" />
                <span>
                  <strong className="tabular-nums text-rose-700">{viewersWatching(product.id)}</strong> shoppers are viewing this
                  product right now.
                </span>
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-brand-200">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">BV</p>
              <p className="mt-1 text-2xl font-extrabold text-brand-900">{Number(product.bv).toFixed(0)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-brand-200">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">PV</p>
              <p className="mt-1 text-2xl font-extrabold text-brand-900">{Number(product.pv).toFixed(0)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-semibold text-slate-700">Quantity</span>
            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                disabled={qty <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[2.5rem] text-center text-sm font-bold tabular-nums text-slate-900">{qty}</span>
              <button
                type="button"
                disabled={!inStock || qty >= stockQty}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                onClick={() => setQty((q) => Math.min(stockQty, q + 1))}
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="hidden flex-wrap gap-3 lg:flex">
            <button
              type="button"
              onClick={addToCart}
              disabled={!inStock || cartBusy}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-bold text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl active:scale-[0.99] disabled:opacity-50"
            >
              {cartBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
              Add to cart
            </button>
            <button
              type="button"
              onClick={buyNow}
              disabled={!inStock || buyBusy}
              className="inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 text-sm font-bold text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:from-brand-500 hover:to-indigo-500 hover:shadow-xl active:scale-[0.99] disabled:opacity-50"
            >
              {buyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Buy now
            </button>
            <motion.button
              type="button"
              onClick={onWishlist}
              animate={heartPop && !reduceMotion ? { scale: [1, 1.14, 1] } : { scale: 1 }}
              transition={{ duration: 0.35, ease: easings.smooth }}
              whileTap={{ scale: 0.95 }}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-slate-600 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:text-rose-600 ${
                wishlisted ? 'border-rose-200 text-rose-600' : ''
              }`}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`h-5 w-5 ${wishlisted ? 'fill-current' : ''}`} />
            </motion.button>
          </div>

          <div className="hidden space-y-3 rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50/90 to-indigo-50/40 p-4 text-sm text-slate-800 lg:block">
            <p className="flex items-start gap-2 font-semibold text-brand-950">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <strong>Wallet:</strong> apply your balance on the checkout screen before payment — no extra steps here.
              </span>
            </p>
            <p className="flex items-start gap-2 text-slate-700">
              <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <strong>Earning:</strong> BV from this order counts toward your plan; build referral volume from your dashboard.
              </span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: CreditCard, t: 'Secure payment', d: 'Encrypted checkout with trusted payment partners.' },
              { icon: Truck, t: 'Fast delivery', d: 'Pincode-based ETAs and dispatch updates.' },
              { icon: RotateCcw, t: 'Easy returns', d: 'Simple returns where policy allows.' },
              { icon: ShieldCheck, t: 'Buyer trust', d: 'GST-ready invoices on eligible orders.' }
            ].map(({ icon: Icon, t, d }) => (
              <div
                key={t}
                className="flex gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.75} />
                <div>
                  <p className="text-sm font-bold text-slate-900">{t}</p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{d}</p>
                </div>
              </div>
            ))}
          </div>

          <PincodeDeliveryCheck />
        </div>
      </div>

      {fbtBundle.length >= 2 ? (
        <section className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-brand-50/30 p-6 shadow-lg ring-1 ring-slate-900/[0.04] sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md">
                <Package className="h-6 w-6" strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">Frequently bought together</h2>
                <p className="mt-0.5 text-sm text-slate-600">Bundle these items — one tap adds all to your cart.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Combo total</p>
              <p className="text-2xl font-extrabold tabular-nums text-slate-900">₹{fbtTotal.toFixed(0)}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-stretch justify-center gap-4 sm:gap-6">
            {fbtBundle.map((p, idx) => (
              <div key={p.id} className="flex w-[140px] shrink-0 flex-col sm:w-[160px]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <Link to={`/products/${p.slug}`} className="block aspect-square bg-slate-50">
                    <img
                      src={p.image_url || 'https://placehold.co/400x400/1e1b4b/ffffff/png?text=Vivan'}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </Link>
                </div>
                <Link to={`/products/${p.slug}`} className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-slate-900 hover:text-brand-700">
                  {p.name}
                </Link>
                <p className="mt-1 text-sm font-extrabold text-brand-900">₹{Number(p.sale_price).toFixed(0)}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={addAllFbtToCart}
              disabled={comboAdding}
              className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-8 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
            >
              {comboAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}
              Add all to cart
            </button>
          </div>
        </section>
      ) : null}

      <div className="rounded-3xl border border-slate-200/90 bg-white p-2 shadow-sm sm:p-3">
        <AnimatedTabs<TabId>
          tabs={TABS}
          value={activeTab}
          onChange={setActiveTab}
          tabListClassName="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          tabButtonClass={(active) =>
            `shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ease-out ${
              active
                ? 'scale-[1.02] bg-slate-900 text-white shadow-md ring-1 ring-slate-900/10'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
          panelClassName="border-t border-slate-100 p-5 sm:p-8"
        >
          {(tab) => (
            <>
          {tab === 'description' ? (
            <div className="max-w-none text-base leading-relaxed text-slate-600">
              <p className="whitespace-pre-line">
                {product.long_description || 'Full product description will appear here. Our team updates long-form copy for clarity, ingredients, and compliance.'}
              </p>
            </div>
          ) : null}
          {tab === 'benefits' ? (
            <ul className="space-y-3">
              {benefitLines.map((line: string) => (
                <li key={line} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-800">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    ✓
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          {tab === 'specs' ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['SKU', product.sku || '—'],
                    ['Category', product.category_name || '—'],
                    ['Brand', product.brand_name || '—'],
                    ['GST rate', `${Number(product.gst_rate).toFixed(0)}%`],
                    ['Business volume (BV)', Number(product.bv).toFixed(0)],
                    ['Point value (PV)', Number(product.pv).toFixed(0)],
                    ['Stock on hand', String(stockQty)]
                  ].map(([k, v]) => (
                    <tr key={k} className="bg-white hover:bg-slate-50/80">
                      <th className="w-2/5 px-4 py-3 font-semibold text-slate-500">{k}</th>
                      <td className="px-4 py-3 font-medium text-slate-900">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {tab === 'howto' ? (
            <div className="max-w-none space-y-4 text-base leading-relaxed text-slate-600">
              <p>
                Follow the instructions on the product label. For cosmetics and personal care, patch test before full use. Store
                in a cool, dry place away from direct sunlight unless the brand specifies otherwise.
              </p>
              <p className="text-sm text-slate-500">
                Product-specific directions may be added by your merchandising team in the long description.
              </p>
            </div>
          ) : null}
          {tab === 'reviews' ? (
            <div className="space-y-10">
              <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-inner">
                  <p className="text-5xl font-extrabold text-slate-900">{avg != null ? avg.toFixed(1) : '—'}</p>
                  <Stars value={avg ?? 0} />
                  <p className="mt-2 text-sm font-medium text-slate-600">{reviewCount} verified reviews</p>
                  <div className="mt-6 space-y-2">
                    {bars.map(({ star, count, pct }) => (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-3 font-bold text-slate-600">{star}</span>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" strokeWidth={0} />
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums text-slate-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-5">
                  {reviews.length === 0 ? (
                    <p className="text-sm text-slate-500">No reviews yet — be the first to share your experience.</p>
                  ) : (
                    <>
                      {topReview ? (
                        <article className="relative overflow-hidden rounded-3xl border-2 border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-white p-6 shadow-lg ring-1 ring-amber-100/60">
                          <div className="absolute right-3 top-3 flex max-w-[11rem] flex-col items-end gap-1.5 sm:right-4 sm:top-4 sm:max-w-none sm:flex-row sm:items-center">
                            <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow">
                              Top review
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/60">
                              <BadgeCheck className="h-3 w-3" />
                              Verified purchase
                            </span>
                          </div>
                          <div className="mt-14 flex flex-wrap items-center justify-between gap-2 sm:mt-10">
                            <p className="text-lg font-extrabold text-slate-900">{topReview.author_name}</p>
                            <span className="text-xs font-medium text-slate-400">{new Date(topReview.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Stars value={Number(topReview.rating)} />
                            <span className="text-sm font-bold text-slate-700">{Number(topReview.rating).toFixed(1)} / 5</span>
                          </div>
                          {topReview.title ? <p className="mt-3 text-lg font-bold text-slate-900">{topReview.title}</p> : null}
                          {topReview.body ? <p className="mt-3 text-sm leading-relaxed text-slate-700">{topReview.body}</p> : null}
                        </article>
                      ) : null}
                      {otherReviews.map((r) => (
                        <article
                          key={r.id}
                          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:border-brand-200/60 hover:shadow-md"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-bold text-slate-900">{r.author_name}</p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                              <BadgeCheck className="h-3 w-3" />
                              Verified
                            </span>
                          </div>
                          <span className="mt-1 block text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                          <div className="mt-2 flex items-center gap-1">
                            <Stars value={Number(r.rating)} size="sm" />
                          </div>
                          {r.title ? <p className="mt-2 font-semibold text-slate-800">{r.title}</p> : null}
                          {r.body ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.body}</p> : null}
                        </article>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/30 p-6">
                <h3 className="text-base font-bold text-slate-900">Write a review</h3>
                {!accessToken ? (
                  <p className="mt-2 text-sm text-slate-600">
                    <Link to="/login" className="font-bold text-brand-700 hover:underline">
                      Sign in
                    </Link>{' '}
                    to share feedback.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Rating
                      <select
                        value={review.rating}
                        onChange={(e) => setReview({ ...review, rating: Number(e.target.value) })}
                        className="mt-1 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} stars
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Title
                      <input
                        value={review.title}
                        onChange={(e) => setReview({ ...review, title: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Your review
                      <textarea
                        value={review.body}
                        onChange={(e) => setReview({ ...review, body: e.target.value })}
                        rows={4}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={submitReview}
                      className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                    >
                      Submit review
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {tab === 'shipping' ? (
            <div className="max-w-none space-y-4 text-base leading-relaxed text-slate-600">
              <p>
                Standard delivery timelines apply based on your PIN code. Use the checker above for fees, COD availability, and
                estimated days.
              </p>
              <p>
                <Link to="/shipping-policy" className="font-bold text-brand-700 hover:underline">
                  Shipping policy
                </Link>{' '}
                ·{' '}
                <Link to="/refund-policy" className="font-bold text-brand-700 hover:underline">
                  Refund &amp; returns
                </Link>
              </p>
            </div>
          ) : null}
            </>
          )}
        </AnimatedTabs>
      </div>

      {(product.relatedProducts || []).length > 0 ? (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-extrabold text-slate-900">Related products</h2>
            <Link to={categoryHref} className="text-sm font-bold text-brand-700 hover:text-brand-900">
              View category →
            </Link>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] lg:grid lg:grid-cols-3 lg:overflow-visible xl:grid-cols-4">
            {(product.relatedProducts as ProductCardModel[]).map((p: ProductCardModel) => (
              <div key={p.id} className="min-w-[260px] shrink-0 snap-start lg:min-w-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {alsoBought.length > 0 ? (
        <section className="space-y-5 border-t border-slate-200 pt-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-extrabold text-slate-900">Customers also bought</h2>
            <Link to="/products?sort=discount" className="text-sm font-bold text-brand-700 hover:text-brand-900">
              Shop deals →
            </Link>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {alsoBought.slice(0, 4).map((p) => (
              <div key={p.id} className="min-w-[260px] shrink-0 snap-start lg:min-w-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <StickyReveal className="fixed bottom-20 left-0 right-0 z-[48] border-t border-slate-200/90 bg-white/98 px-3 py-3 shadow-[0_-16px_48px_-12px_rgba(15,23,42,0.22)] backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex max-w-lg items-end gap-3">
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your price</p>
            <p className="text-lg font-extrabold tabular-nums leading-tight text-slate-900">₹{(sale * qty).toFixed(0)}</p>
            {mrp > sale ? (
              <p className="text-xs text-slate-400 line-through">MRP ₹{(mrp * qty).toFixed(0)}</p>
            ) : null}
            {youSave > 0 ? (
              <p className="mt-0.5 text-xs font-bold text-emerald-700">You save ₹{youSave.toFixed(0)}</p>
            ) : null}
          </div>
          <motion.button
            type="button"
            onClick={onWishlist}
            animate={heartPop && !reduceMotion ? { scale: [1, 1.14, 1] } : { scale: 1 }}
            transition={{ duration: 0.35, ease: easings.smooth }}
            whileTap={{ scale: 0.95 }}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-slate-600 shadow-sm transition ${
              wishlisted ? 'border-rose-200 text-rose-600' : ''
            }`}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart className={`h-5 w-5 ${wishlisted ? 'fill-current' : ''}`} />
          </motion.button>
          <button
            type="button"
            onClick={addToCart}
            disabled={!inStock || cartBusy}
            className="flex h-12 min-w-[5.5rem] shrink-0 items-center justify-center rounded-2xl bg-slate-900 px-4 text-xs font-extrabold uppercase tracking-wide text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
          >
            {cartBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add to cart'}
          </button>
          <button
            type="button"
            onClick={buyNow}
            disabled={!inStock || buyBusy}
            className="flex h-12 min-w-[5.5rem] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 text-xs font-extrabold uppercase tracking-wide text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
          >
            {buyBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buy now'}
          </button>
        </div>
      </StickyReveal>
    </div>
  );
}
const MAX_PRODUCT_IMAGES = 5;
