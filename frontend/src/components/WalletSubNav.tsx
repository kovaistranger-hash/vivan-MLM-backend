import { NavLink } from 'react-router-dom';

const cls = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-brand-100 text-brand-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

export default function WalletSubNav() {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      <NavLink to="/wallet" end className={cls}>
        Overview
      </NavLink>
      <NavLink to="/wallet/history" className={cls}>
        Ledger history
      </NavLink>
      <NavLink to="/wallet/withdraw" className={cls}>
        Withdraw
      </NavLink>
      <NavLink to="/wallet/bank-accounts" className={cls}>
        Bank accounts
      </NavLink>
    </nav>
  );
}
