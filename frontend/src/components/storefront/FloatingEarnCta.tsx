import { Link, useLocation } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

export default function FloatingEarnCta() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname === '/referral' || pathname === '/dashboard') {
    return null;
  }

  return (
    <Link
      to="/dashboard"
      className="fixed bottom-20 right-4 z-[45] flex items-center gap-2 rounded-full border border-emerald-400/50 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition duration-300 hover:scale-[1.03] hover:shadow-xl hover:shadow-emerald-900/35 md:bottom-8 md:right-6"
      aria-label="Start earning with referrals"
    >
      <TrendingUp className="h-4 w-4 shrink-0" />
      <span className="max-w-[9rem] leading-tight sm:max-w-none">Start Earning</span>
    </Link>
  );
}
