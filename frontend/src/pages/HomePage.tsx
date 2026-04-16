import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  Star,
  Sparkles,
  Lock,
  BadgeCheck,
  TrendingUp,
  Users,
  Share2,
  GitBranch,
  Wallet,
  Banknote
} from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner';
import ProductCard, { ProductCardModel } from '../components/ProductCard';
import SkeletonGrid from '../components/SkeletonGrid';
import FadeInSection from '../components/motion/FadeInSection';
import StaggerGrid from '../components/motion/StaggerGrid';
import { STOREFRONT_CATEGORIES, filterStorefrontCategories } from '../config/storefrontCatalog';
import { useAuthStore } from '../stores/authStore';

type Category = { id: number; name: string; slug: string; description?: string | null };
type Banner = { id: number; title: string; subtitle: string | null; image_url: string; link_url: string | null };

/** Full-bleed breakout from the storefront main max-width + horizontal padding */
const FULL_BLEED =
  'relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen max-w-[100vw] shrink-0';

const testimonials = [
  { name: 'Ananya R.', text: 'Immaculate packaging and fast delivery. The serum has been a staple in my routine.', rating: 5 },
  { name: 'Karan M.', text: 'Checkout was smooth and GST breakdown was clear. Will shop electronics here again.', rating: 5 },
  { name: 'Priya S.', text: 'Love the curation—feels premium without the usual ecommerce clutter.', rating: 4 }
];

export default function HomePage() {
  const { accessToken } = useAuthStore();
  const [featured, setFeatured] = useState<ProductCardModel[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductCardModel[]>([]);
  const [bestsellers, setBestsellers] = useState<ProductCardModel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [feat, arrivals, best, cats, b] = await Promise.all([
          api.get('/products', { params: { featured: 'true', pageSize: 4 } }),
          api.get('/products', { params: { newArrival: 'true', pageSize: 4 } }),
          api.get('/products', { params: { bestseller: 'true', pageSize: 4 } }),
          api.get('/categories'),
          api.get('/banners').catch(() => ({ data: { banners: [] } }))
        ]);
        if (cancelled) return;
        setFeatured(feat.data.products || []);
        setNewArrivals(arrivals.data.products || []);
        setBestsellers(best.data.products || []);
        setCategories(filterStorefrontCategories(cats.data.categories || []));
        setBanners(b.data.banners || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const earnCta = accessToken ? '/dashboard' : '/register';

  function newsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmail('');
    toast.success('Thanks — you are on the list.');
  }

  return (
    <div className="space-y-0">
      <div className={FULL_BLEED}>
        <section className="border-b border-slate-800/90 bg-gradient-to-r from-slate-950 via-brand-950 to-slate-950 py-2.5 text-center text-xs font-medium text-brand-100/95">
          Earn with referrals · Binary income eligible plans · Withdraw to your bank anytime
        </section>

        <section className="relative min-h-[min(100svh,52rem)] overflow-hidden bg-slate-950 text-white">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/90 to-slate-900" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,rgba(99,102,241,0.28),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_10%_90%,rgba(16,185,129,0.14),transparent_50%)]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 max-w-3xl bg-gradient-to-l from-slate-900/80 to-transparent" />
          <FadeInSection className="relative mx-auto grid w-full max-w-none min-h-[inherit] gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-12 lg:py-20 xl:px-16 2xl:px-24">
            <div className="z-[1] flex max-w-2xl flex-col justify-center space-y-6">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-200/95">
                <Sparkles className="h-3.5 w-3.5" /> Shop smarter. Earn more.
              </p>
              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl xl:text-[3.35rem] xl:leading-[1.05]">
                India&apos;s Smart Shopping Platform
              </h1>
              <p className="max-w-xl text-xl font-medium text-slate-200 sm:text-2xl">Shop. Earn. Grow Your Income.</p>
              <div className="inline-flex w-fit flex-wrap items-center gap-2 rounded-2xl border border-amber-400/45 bg-gradient-to-r from-amber-500/20 to-orange-500/10 px-4 py-2.5 text-sm font-semibold text-amber-50 shadow-inner ring-1 ring-amber-400/20">
                Earn up to 30% + Binary Income
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/products"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-sm font-bold text-brand-900 shadow-xl shadow-black/25 transition duration-200 hover:-translate-y-1 hover:bg-brand-50 hover:shadow-2xl"
                >
                  Shop Now
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={earnCta}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/40 bg-white/5 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:border-white/60 hover:bg-white/15"
                >
                  Start Earning
                  <TrendingUp className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="relative z-[1] flex min-h-[14rem] items-stretch sm:min-h-[18rem] lg:min-h-[22rem]">
              <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/60 ring-1 ring-white/5">
                <img
                  src="https://images.unsplash.com/photo-1607082348824-0a96f2a48b44?w=1200&q=85"
                  alt="Shopping and lifestyle"
                  className="h-full min-h-[16rem] w-full object-cover sm:min-h-[20rem] lg:min-h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-indigo-950/20" />
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur-md sm:bottom-6 sm:left-6 sm:right-6">
                  <p className="text-sm font-semibold text-white">Beauty · Fashion · Electronics · Home Care · Personal Care</p>
                  <p className="mt-1 text-xs text-slate-300">Trusted brands, fast delivery, and rewards that grow with you.</p>
                </div>
              </div>
            </div>
          </FadeInSection>
        </section>
      </div>

      <FadeInSection className="border-b border-slate-200 bg-white py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">Why Choose Vivan</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Truck, title: 'Fast Delivery', body: 'Dispatch-aware timelines and pincode-based ETAs at checkout.' },
              { icon: Lock, title: 'Secure Payments', body: 'Encrypted sessions and trusted payment partners at settlement.' },
              { icon: TrendingUp, title: 'Earn While Shopping', body: 'BV on purchases plus referral & binary income where eligible.' },
              { icon: BadgeCheck, title: 'Trusted Platform', body: 'Transparent pricing, GST-ready invoices, and member-first support.' }
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-2xl border border-slate-200/90 bg-slate-50/50 p-6 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:bg-white hover:shadow-lg lg:text-left"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/25 transition group-hover:scale-105 lg:mx-0">
                  <Icon className="h-7 w-7" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeInSection>

      <FadeInSection className="border-y border-slate-200/90 bg-gradient-to-b from-white via-slate-50/80 to-white py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-brand-700">Social proof</p>
          <h2 className="mt-2 text-center text-2xl font-bold text-slate-900 sm:text-3xl">Built for scale. Trusted by shoppers.</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/25 transition group-hover:scale-105">
                <Users className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <div className="mt-6">
                <p className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">85,000+</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">Registered shoppers &amp; earners on the platform</p>
              </div>
            </div>
            <div className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-700/25 transition group-hover:scale-105">
                <Banknote className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <div className="mt-6">
                <p className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">₹21 Cr+</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">Total referral, binary &amp; wallet payouts to members</p>
              </div>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-slate-500">
            Figures reflect illustrative milestones for marketing; live totals depend on your plan, geography, and payout cycles.
          </p>
        </div>
      </FadeInSection>

      <section className="relative overflow-hidden border-b border-brand-800/30 bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 py-14 text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div className="max-w-xl space-y-4">
            <h2 className="text-3xl font-bold sm:text-4xl">Earn with Vivan</h2>
            <p className="text-sm text-brand-100/90 sm:text-base">
              Turn your network into income—built for modern Indian shoppers who want more than cashback.
            </p>
            <ul className="space-y-3 text-sm sm:text-base">
              <li className="flex items-start gap-3">
                <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <span>
                  <strong className="text-white">Refer &amp; earn</strong> — invite friends and grow your team with transparent
                  tracking.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <span>
                  <strong className="text-white">30% direct income</strong> — competitive direct rewards on qualifying business
                  (plan rules apply).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <span>
                  <strong className="text-white">Binary income system</strong> — balanced volume matched for recurring payouts
                  where enabled.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <span>
                  <strong className="text-white">Withdraw anytime</strong> — wallet balance with secure bank &amp; UPI withdrawals.
                </span>
              </li>
            </ul>
          </div>
          <div className="mt-8 flex shrink-0 justify-center lg:mt-0">
            <Link
              to={earnCta}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-brand-900 shadow-xl transition hover:-translate-y-0.5 hover:bg-emerald-50"
            >
              Start Earning Now
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <FadeInSection className="mx-auto max-w-7xl space-y-6 px-4 py-14 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Shop by category</h2>
            <p className="mt-1 text-sm text-slate-500">Swipe on mobile — tap a card to explore.</p>
          </div>
          <Link to="/products" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
            View all →
          </Link>
        </div>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:thin] snap-x snap-mandatory sm:-mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:gap-5 lg:overflow-visible">
          {STOREFRONT_CATEGORIES.map((c) => {
            const apiCat = catBySlug[c.slug];
            const to = apiCat ? `/products?categoryId=${apiCat.id}` : `/products?slug=${c.slug}`;
            return (
              <Link
                key={c.slug}
                to={to}
                className="group relative aspect-[3/4] min-w-[240px] shrink-0 snap-center overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl sm:min-w-[260px] lg:min-w-0"
              >
                <img
                  src={c.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-900/20" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h3 className="text-xl font-extrabold tracking-tight drop-shadow-md sm:text-2xl">{c.name}</h3>
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-white/95">
                    Shop Now <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </FadeInSection>

      {banners.length ? (
        <section className="border-y border-slate-200 bg-white py-12">
          <div className="mx-auto max-w-7xl space-y-6 px-4">
            <h2 className="text-xl font-bold text-slate-900">Highlights</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {banners.map((b) => {
                const inner = (
                  <div className="min-w-[280px] max-w-sm flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <img src={b.image_url} alt="" className="h-44 w-full object-cover" />
                    <div className="p-4">
                      <p className="font-semibold text-slate-900">{b.title}</p>
                      {b.subtitle ? <p className="mt-1 text-sm text-slate-500">{b.subtitle}</p> : null}
                    </div>
                  </div>
                );
                return b.link_url ? (
                  <a key={b.id} href={b.link_url} className="block">
                    {inner}
                  </a>
                ) : (
                  <div key={b.id}>{inner}</div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <FadeInSection className="mx-auto max-w-7xl space-y-8 px-4 py-14 sm:py-16">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Featured products</h2>
        {loading ? (
          <SkeletonGrid count={4} />
        ) : (
          <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </StaggerGrid>
        )}
      </FadeInSection>

      <section className="border-y border-slate-200 bg-slate-100/80 py-14 sm:py-16">
        <FadeInSection className="mx-auto max-w-7xl space-y-8 px-4">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">New arrivals</h2>
          {loading ? (
            <SkeletonGrid count={4} />
          ) : (
            <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
              {newArrivals.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </StaggerGrid>
          )}
        </FadeInSection>
      </section>

      <FadeInSection className="mx-auto max-w-7xl space-y-8 px-4 py-14 sm:py-16">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Best sellers</h2>
        {loading ? (
          <SkeletonGrid count={4} />
        ) : (
          <StaggerGrid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
            {bestsellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </StaggerGrid>
        )}
      </FadeInSection>

      <section className="bg-brand-900 py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 text-center md:flex-row md:text-left">
          <div className="flex-1 space-y-2">
            <h2 className="text-2xl font-bold sm:text-3xl">Weekend rewards</h2>
            <p className="text-sm text-brand-100/90">Extra savings on select electronics & beauty bundles. Limited time.</p>
          </div>
          <Link
            to="/products?sort=discount"
            className="shrink-0 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-brand-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-50"
          >
            Shop offers
          </Link>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white py-14 sm:py-16">
        <FadeInSection className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">Loved by customers</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-slate-200 bg-slate-50/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex gap-0.5 text-amber-400">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-sm text-slate-600">&ldquo;{t.text}&rdquo;</p>
                <p className="mt-4 text-sm font-semibold text-slate-900">{t.name}</p>
              </div>
            ))}
          </div>
        </FadeInSection>
      </section>

      <section className="border-t border-slate-200 bg-slate-900 py-16 text-white">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold">Join the Vivan list</h2>
          <p className="mt-2 text-sm text-slate-400">Early access to drops, member-only offers, and earning tips.</p>
          <form onSubmit={newsletterSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="flex-1 rounded-2xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-sm text-white outline-none ring-brand-400 focus:ring-2"
            />
            <button
              type="submit"
              className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-brand-900 transition hover:bg-brand-50"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
