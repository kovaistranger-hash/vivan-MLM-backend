import { NavLink } from 'react-router-dom';
import { Home, LayoutGrid, Heart, ShoppingBag, Wallet } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const item =
  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-slate-500 transition-colors';
const active = 'text-brand-700 [&>svg]:text-brand-700';

export default function MobileBottomNav() {
  const { accessToken } = useAuthStore();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.15)] backdrop-blur-md md:hidden"
      aria-label="Primary mobile"
    >
      <div className="mx-auto flex max-w-lg">
        <NavLink to="/" end className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <Home className="h-5 w-5" />
          Home
        </NavLink>
        <NavLink to="/products" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <LayoutGrid className="h-5 w-5" />
          Shop
        </NavLink>
        <NavLink to="/wishlist" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <Heart className="h-5 w-5" />
          Saved
        </NavLink>
        <NavLink to="/cart" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <ShoppingBag className="h-5 w-5" />
          Cart
        </NavLink>
        <NavLink
          to={accessToken ? '/wallet' : '/login'}
          className={({ isActive }) => `${item} ${isActive ? active : ''}`}
        >
          <Wallet className="h-5 w-5" />
          {accessToken ? 'Wallet' : 'Account'}
        </NavLink>
      </div>
    </nav>
  );
}
