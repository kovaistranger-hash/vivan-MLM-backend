import { motion } from 'framer-motion';
import { Link, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Wallet,
  Banknote,
  Settings2,
  Users,
  Receipt,
  CalendarDays,
  SlidersHorizontal,
  PenLine,
  GitBranch,
  ImageIcon,
  MapPin,
  LogOut,
  Store,
  ShieldAlert,
  FileCheck
} from 'lucide-react';
import { durations, easings } from '@/components/motion/motionTokens';

const linkBase =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200';

function navClass({ isActive }: { isActive: boolean }) {
  return `${linkBase} ${
    isActive
      ? 'bg-white/10 text-white shadow-inner shadow-black/20 ring-1 ring-white/10'
      : 'text-slate-400 hover:bg-white/5 hover:text-white'
  }`;
}

type SidebarProps = {
  onLogout: () => void;
};

/** Dark premium admin navigation (desktop). */
export default function Sidebar({ onLogout }: SidebarProps) {
  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white shadow-2xl shadow-slate-900/50 md:flex">
      <div className="border-b border-white/10 px-5 py-6">
        <Link to="/admin" className="block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">Operations</p>
          <h1 className="mt-1 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            Vivan Admin
          </h1>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        <NavLink to="/admin" end className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <LayoutDashboard className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Dashboard
          </motion.span>
        </NavLink>
        <NavLink to="/admin/products" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <Package className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Products
          </motion.span>
        </NavLink>
        <NavLink to="/admin/categories" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <FolderTree className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Categories
          </motion.span>
        </NavLink>
        <NavLink to="/admin/orders" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <ShoppingBag className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Orders
          </motion.span>
        </NavLink>
        <NavLink to="/admin/wallets" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <Wallet className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Wallets
          </motion.span>
        </NavLink>
        <NavLink to="/admin/fraud" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" strokeWidth={1.75} />
            Fraud
          </motion.span>
        </NavLink>
        <NavLink to="/admin/kyc" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <FileCheck className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={1.75} />
            KYC queue
          </motion.span>
        </NavLink>
        <NavLink to="/admin/withdrawals" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <Banknote className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Withdrawals
          </motion.span>
        </NavLink>
        <NavLink to="/admin/withdrawal-settings" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <Settings2 className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            WD settings
          </motion.span>
        </NavLink>
        <NavLink to="/admin/referrals" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <Users className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Referrals
          </motion.span>
        </NavLink>
        <NavLink to="/admin/commissions" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <Receipt className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Commissions
          </motion.span>
        </NavLink>
        <NavLink to="/admin/binary-daily" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <CalendarDays className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Binary daily
          </motion.span>
        </NavLink>
        <NavLink to="/admin/compensation-settings" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Compensation
          </motion.span>
        </NavLink>
        <NavLink to="/admin/commissions/manual-adjustment" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <PenLine className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Manual adj.
          </motion.span>
        </NavLink>
        <NavLink to="/admin/binary-carry" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <GitBranch className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Binary carry
          </motion.span>
        </NavLink>
        <NavLink to="/admin/banners" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <ImageIcon className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Banners
          </motion.span>
        </NavLink>
        <NavLink to="/admin/pincodes" className={navClass}>
          <motion.span className="flex items-center gap-3" whileHover={{ x: 2 }} transition={{ duration: durations.fast, ease: easings.smooth }}>
            <MapPin className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={1.75} />
            Pincodes
          </motion.span>
        </NavLink>

        <div className="my-3 border-t border-white/10" />

        <Link
          to="/"
          className={`${linkBase} text-slate-400 hover:bg-white/5 hover:text-white`}
        >
          <Store className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={1.75} />
          Storefront
        </Link>
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/15 py-2.5 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/30 transition hover:bg-rose-500/25"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </aside>
  );
}
