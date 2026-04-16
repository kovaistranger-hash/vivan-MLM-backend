import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { toast } from 'sonner';
import PageTransition from '../components/motion/PageTransition';
import Sidebar from '@/components/admin/Sidebar';

export default function AdminLayout() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);

  async function logout() {
    const refreshToken = localStorage.getItem('vivan_refresh_token');
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      /* ignore */
    }
    clearSession();
    toast.success('Signed out');
    navigate('/admin/login');
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-white to-violet-50/50">
      <Sidebar onLogout={logout} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md md:hidden">
          <span className="bg-gradient-to-r from-slate-900 to-violet-700 bg-clip-text font-semibold text-transparent">
            Vivan Admin
          </span>
          <button type="button" onClick={logout} className="text-sm font-medium text-rose-600">
            Log out
          </button>
        </header>
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200/80 bg-white/70 px-3 py-2 backdrop-blur md:hidden">
          <NavLink to="/admin" end className="rounded-lg bg-slate-900/5 px-2 py-1 text-[11px] font-medium text-slate-700">
            Home
          </NavLink>
          <NavLink to="/admin/orders" className="rounded-lg bg-slate-900/5 px-2 py-1 text-[11px] font-medium text-slate-700">
            Orders
          </NavLink>
          <NavLink to="/admin/wallets" className="rounded-lg bg-slate-900/5 px-2 py-1 text-[11px] font-medium text-slate-700">
            Wallets
          </NavLink>
          <NavLink to="/admin/commissions" className="rounded-lg bg-slate-900/5 px-2 py-1 text-[11px] font-medium text-slate-700">
            Commissions
          </NavLink>
        </div>
        <main className="flex-1 overflow-auto p-4 md:p-10">
          <PageTransition tone="admin" />
        </main>
      </div>
    </div>
  );
}
