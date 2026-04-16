import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Menu,
  ShoppingBag,
  UserRound,
  X,
  Search,
  Heart,
  Headphones,
  Truck,
  PackageSearch,
  Wallet,
  Sparkles,
  ChevronDown,
  LogOut,
  LayoutGrid
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useWishlist } from '../../hooks/useWishlist';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { STOREFRONT_CATEGORIES } from '../../config/storefrontCatalog';
import { notifyCartChanged } from '../../utils/cartNotify';

function IconBadge({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex">
      {children}
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </span>
  );
}

export default function StorefrontHeader() {
  const reduceMotion = useReducedMotion();
  const [drawer, setDrawer] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [walletBal, setWalletBal] = useState<number | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const { user, clearSession, accessToken } = useAuthStore();
  const { count: wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  const refreshCart = useCallback(() => {
    if (!accessToken) {
      setCartCount(0);
      return;
    }
    api
      .get('/cart')
      .then((r) => {
        const items = r.data?.cart?.items ?? [];
        const n = items.reduce((s: number, it: { quantity?: number }) => s + Number(it.quantity ?? 0), 0);
        setCartCount(n);
      })
      .catch(() => setCartCount(0));
  }, [accessToken]);

  useEffect(() => {
    setDrawer(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!accessToken) {
      setWalletBal(null);
      return;
    }
    let cancelled = false;
    api
      .get('/wallet')
      .then((r) => {
        if (!cancelled) setWalletBal(Number(r.data?.wallet?.balance ?? 0));
      })
      .catch(() => {
        if (!cancelled) setWalletBal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, location.pathname]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart, location.pathname]);

  useEffect(() => {
    window.addEventListener('vivan-cart', refreshCart);
    return () => window.removeEventListener('vivan-cart', refreshCart);
  }, [refreshCart]);

  useEffect(() => {
    if (!accountOpen) return;
    function onDoc(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [accountOpen]);

  async function handleLogout() {
    const refreshToken = localStorage.getItem('vivan_refresh_token');
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      /* ignore */
    }
    clearSession();
    notifyCartChanged();
    toast.success('Signed out');
    setAccountOpen(false);
    navigate('/');
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQ.trim();
    if (!q) {
      navigate('/products');
      return;
    }
    navigate(`/products?search=${encodeURIComponent(q)}`);
  }

  const iconBtn =
    'relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-600 shadow-sm transition duration-200 hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-800 hover:shadow-md active:scale-[0.97]';

  return (
    <>
      <div className="border-b border-slate-800/90 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-xs text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
              <Truck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Free shipping on orders above ₹499
            </span>
            <span className="hidden items-center gap-1.5 font-medium text-slate-400 sm:inline-flex">
              <Headphones className="h-3.5 w-3.5 shrink-0 text-brand-300" />
              Support: care@vivan.local · 10am–7pm IST
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Link
              to="/products?sort=discount"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-100 transition duration-200 hover:border-amber-300/60 hover:bg-amber-500/25"
            >
              Deals
            </Link>
            <Link
              to="/track-order"
              className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 shadow-md shadow-black/20 ring-1 ring-white/30 transition duration-200 hover:bg-slate-100 hover:shadow-lg"
            >
              <PackageSearch className="h-3.5 w-3.5 text-brand-700" />
              Track order
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200/90 bg-white/90 py-3 shadow-sm backdrop-blur-md sm:py-3.5">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 sm:gap-4 sm:px-4">
          <button
            type="button"
            className={`${iconBtn} md:hidden`}
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            to="/"
            className="group flex shrink-0 items-center gap-2 rounded-xl py-0.5 outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 sm:gap-2.5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 via-brand-600 to-indigo-700 text-white shadow-lg shadow-brand-900/30 ring-1 ring-white/20 transition duration-200 group-hover:scale-[1.04] group-hover:shadow-xl sm:h-10 sm:w-10">
              <Sparkles className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" strokeWidth={2.2} />
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-xl font-extrabold tracking-tight text-slate-900">Vivan</span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Shop &amp; earn</span>
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 sm:hidden">Vivan</span>
          </Link>

          <form onSubmit={submitSearch} className="mx-auto hidden min-w-0 max-w-xl flex-1 md:block lg:max-w-2xl">
            <motion.div
              className="relative origin-center"
              animate={{ scale: reduceMotion ? 1 : searchFocused ? 1.012 : 1 }}
              transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[1.05rem] w-[1.05rem] -translate-y-1/2 text-slate-400" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search for products, brands, and categories"
                className="w-full rounded-full border border-slate-200/95 bg-slate-50 py-2.5 pl-11 pr-5 text-sm font-medium text-slate-900 shadow-inner shadow-slate-900/[0.02] outline-none ring-brand-400/0 transition duration-200 placeholder:text-slate-400 placeholder:font-normal focus:border-brand-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-brand-400/35"
              />
            </motion.div>
          </form>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {accessToken && walletBal !== null ? (
              <Link
                to="/wallet"
                className="inline-flex max-w-[6rem] items-center gap-1 rounded-full border border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900 shadow-sm transition duration-200 hover:border-emerald-300 hover:shadow-md sm:max-w-none sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-xs"
                title="Wallet balance"
              >
                <Wallet className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <span className="tabular-nums">₹{walletBal.toFixed(0)}</span>
              </Link>
            ) : null}

            <IconBadge count={wishlistCount}>
              <Link to="/wishlist" className={iconBtn} aria-label="Wishlist">
                <Heart className="h-[1.15rem] w-[1.15rem]" />
              </Link>
            </IconBadge>

            <IconBadge count={cartCount}>
              <Link to="/cart" className={iconBtn} aria-label="Shopping cart">
                <ShoppingBag className="h-[1.15rem] w-[1.15rem]" />
              </Link>
            </IconBadge>

            {accessToken ? (
              <div className="relative pl-0.5" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((o) => !o)}
                  className={`${iconBtn} w-auto gap-1.5 px-2.5 sm:px-3`}
                  aria-expanded={accountOpen}
                  aria-haspopup="true"
                  aria-label="Account menu"
                >
                  <UserRound className="h-[1.15rem] w-[1.15rem]" />
                  <ChevronDown className={`hidden h-3.5 w-3.5 text-slate-400 transition sm:block ${accountOpen ? 'rotate-180' : ''}`} />
                </button>
                {accountOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-56 origin-top-right animate-fadeInUp rounded-2xl border border-slate-200/90 bg-white py-2 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5"
                    role="menu"
                  >
                    <div className="border-b border-slate-100 px-4 py-2.5">
                      <p className="truncate text-sm font-bold text-slate-900">{user?.name}</p>
                      <p className="truncate text-xs text-slate-500">Signed in</p>
                    </div>
                    <Link
                      to="/orders"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      <LayoutGrid className="h-4 w-4 text-slate-400" />
                      My orders
                    </Link>
                    <Link
                      to="/wallet"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Wallet className="h-4 w-4 text-slate-400" />
                      Wallet
                    </Link>
                    <Link
                      to="/wallet/withdraw"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      Withdrawal
                    </Link>
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/referral"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      Network &amp; tree
                    </Link>
                    {user?.role === 'admin' ? (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Admin
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <Link to="/login" className={`${iconBtn} sm:hidden`} aria-label="Sign in">
                  <UserRound className="h-[1.15rem] w-[1.15rem]" />
                </Link>
                <Link
                  to="/login"
                  className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-brand-900/25 transition duration-200 hover:from-brand-500 hover:to-indigo-500 hover:shadow-lg sm:inline-flex"
                >
                  <UserRound className="h-4 w-4 opacity-90" />
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>

        <form onSubmit={submitSearch} className="mx-auto mt-3 max-w-7xl px-3 md:hidden sm:px-4">
          <motion.div
            className="relative origin-center"
            animate={{ scale: reduceMotion ? 1 : searchFocused ? 1.01 : 1 }}
            transition={{ type: 'tween', duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search products, brands…"
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none ring-brand-400/0 transition duration-200 placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-400/35"
            />
          </motion.div>
        </form>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[min(100%,21rem)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <Link to="/" className="flex items-center gap-2" onClick={() => setDrawer(false)}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-md">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="text-lg font-extrabold text-slate-900">Vivan</span>
              </Link>
              <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => setDrawer(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {accessToken && walletBal !== null ? (
                <Link
                  to="/wallet"
                  className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"
                  onClick={() => setDrawer(false)}
                >
                  <span className="inline-flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Wallet balance
                  </span>
                  <span className="tabular-nums">₹{walletBal.toFixed(0)}</span>
                </Link>
              ) : null}
              <nav className="flex flex-col gap-0.5 text-sm font-medium text-slate-800">
                <NavLink to="/" end className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                  Home
                </NavLink>
                <NavLink to="/products" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                  Shop all
                </NavLink>
                <p className="mt-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Categories</p>
                {STOREFRONT_CATEGORIES.map((c) => (
                  <NavLink
                    key={c.slug}
                    to={`/products?slug=${c.slug}`}
                    className="rounded-xl px-3 py-2.5 transition hover:bg-brand-50"
                    onClick={() => setDrawer(false)}
                  >
                    {c.name}
                  </NavLink>
                ))}
                <NavLink
                  to="/products?sort=discount"
                  className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                  onClick={() => setDrawer(false)}
                >
                  Deals
                </NavLink>
                <NavLink to="/track-order" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                  Track order
                </NavLink>
                {accessToken ? (
                  <>
                    <p className="mt-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Account</p>
                    <NavLink to="/orders" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                      Orders
                    </NavLink>
                    <NavLink to="/wallet" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                      Wallet
                    </NavLink>
                    <NavLink to="/wallet/withdraw" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                      Withdrawal
                    </NavLink>
                    <NavLink to="/dashboard" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                      Dashboard
                    </NavLink>
                    <NavLink to="/referral" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                      Network &amp; tree
                    </NavLink>
                  </>
                ) : null}
                {user?.role === 'admin' ? (
                  <NavLink to="/admin" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                    Admin
                  </NavLink>
                ) : null}
                <p className="mt-3 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Saved</p>
                <NavLink to="/cart" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                  Cart{cartCount ? ` (${cartCount})` : ''}
                </NavLink>
                <NavLink to="/wishlist" className="rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => setDrawer(false)}>
                  Wishlist{wishlistCount ? ` (${wishlistCount})` : ''}
                </NavLink>
              </nav>
            </div>
            <div className="border-t border-slate-100 p-4">
              {accessToken ? (
                <button type="button" onClick={handleLogout} className="w-full rounded-full bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
                  Log out
                </button>
              ) : (
                <Link
                  to="/login"
                  className="block w-full rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 py-3 text-center text-sm font-bold text-white shadow-md"
                  onClick={() => setDrawer(false)}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
