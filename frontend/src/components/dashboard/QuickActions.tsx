import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, TrendingUp, UserPlus, Wallet } from 'lucide-react';

const btn =
  'flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.98]';

function QuickActionsInner() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
      <h3 className="text-lg font-bold text-slate-900">Quick actions</h3>
      <p className="mt-1 text-sm text-slate-500">Move faster toward payouts and growth.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link to="/referral" className={`${btn} bg-gradient-to-br from-violet-600 to-violet-800`}>
          <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
          Invite team
        </Link>
        <Link to="/wallet/withdraw" className={`${btn} bg-gradient-to-br from-emerald-500 to-emerald-700`}>
          <Wallet className="h-4 w-4 shrink-0" aria-hidden />
          Withdraw
        </Link>
        <Link to="/wallet" className={`${btn} bg-gradient-to-br from-sky-500 to-sky-700`}>
          <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
          View income
        </Link>
        <Link to="/contact" className={`${btn} bg-gradient-to-br from-slate-700 to-slate-900`}>
          <Headphones className="h-4 w-4 shrink-0" aria-hidden />
          Support
        </Link>
      </div>
    </div>
  );
}

export default memo(QuickActionsInner);
