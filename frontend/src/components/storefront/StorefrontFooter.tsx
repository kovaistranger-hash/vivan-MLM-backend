import { Link } from 'react-router-dom';
import { Globe, Send, Rss, AtSign, ShieldCheck, CreditCard } from 'lucide-react';
import { STOREFRONT_CATEGORIES } from '../../config/storefrontCatalog';

const social = [
  { icon: Globe, href: '#', label: 'Web' },
  { icon: Send, href: '#', label: 'Newsletter' },
  { icon: Rss, href: '#', label: 'Feed' },
  { icon: AtSign, href: '#', label: 'Contact' }
];

export default function StorefrontFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-brand-950/40 to-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400/90">Trust &amp; transparency</p>
              <p className="mt-2 text-lg font-semibold text-white sm:text-xl">Shop with confidence. Earn with clarity.</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Every order is backed by secure payments, clear GST documentation, and a support team that answers. Your wallet
                and referral earnings are visible in real time—no guesswork.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/60 px-5 py-4">
              <ShieldCheck className="h-10 w-10 shrink-0 text-emerald-400" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-bold text-white">100% secure checkout</p>
                <p className="text-xs text-slate-400">Encrypted · Refund-ready policies</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-14">
          <div className="space-y-4">
            <Link to="/" className="inline-block text-xl font-bold tracking-tight text-white">
              Vivan
            </Link>
            <p className="text-sm leading-relaxed text-slate-400">
              Premium essentials across beauty, fashion, electronics, and home—curated for quality, transparent pricing, and
              a seamless checkout experience.
            </p>
            <div className="flex gap-2">
              {social.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-slate-400 transition hover:border-brand-400 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Shop categories</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {STOREFRONT_CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link to={`/products?slug=${c.slug}`} className="text-slate-400 transition hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Useful links</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to="/about" className="text-slate-400 transition hover:text-white">
                  About us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-400 transition hover:text-white">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-slate-400 transition hover:text-white">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-slate-400 transition hover:text-white">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="text-slate-400 transition hover:text-white">
                  Refund policy
                </Link>
              </li>
              <li>
                <Link to="/shipping-policy" className="text-slate-400 transition hover:text-white">
                  Shipping policy
                </Link>
              </li>
              <li>
                <Link to="/income-disclaimer" className="text-slate-400 transition hover:text-white">
                  Income disclaimer
                </Link>
              </li>
              <li>
                <Link to="/kyc-policy" className="text-slate-400 transition hover:text-white">
                  KYC policy
                </Link>
              </li>
              <li>
                <Link to="/grievance" className="text-slate-400 transition hover:text-white">
                  Grievance
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Account</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to="/login" className="text-slate-400 transition hover:text-white">
                  Login
                </Link>
              </li>
              <li>
                <Link to="/orders" className="text-slate-400 transition hover:text-white">
                  Orders
                </Link>
              </li>
              <li>
                <Link to="/wallet" className="text-slate-400 transition hover:text-white">
                  Wallet
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-slate-400 transition hover:text-white">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/wallet/withdraw" className="text-slate-400 transition hover:text-white">
                  Withdrawal
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-400 transition hover:text-white">
                  Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 space-y-8 border-t border-slate-800 pt-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10">
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">We accept</p>
              <div className="mt-4 flex flex-wrap items-center justify-start gap-2 sm:gap-2.5">
                {['UPI', 'Visa', 'Mastercard', 'RuPay', 'Net Banking'].map((label) => (
                  <span
                    key={label}
                    className="inline-flex min-h-[2.25rem] items-center rounded-lg border border-slate-700 bg-slate-800/90 px-3.5 py-1.5 text-center text-xs font-semibold tracking-wide text-slate-100"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col justify-center border-t border-slate-800 pt-8 sm:border-t-0 sm:pt-0 lg:max-w-md lg:border-l lg:border-t-0 lg:pl-10">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-5 py-4">
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Payments you already trust</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-100/85">
                    Cards, UPI, and net banking with industry-standard encryption. GST-ready invoices on every eligible purchase.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 border-t border-slate-800 pt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">© {new Date().getFullYear()} Vivan. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
              <span>PCI-aware flows · Razorpay-ready integration</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
