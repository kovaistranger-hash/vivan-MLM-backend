import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';
import FadeInSection from '../../components/motion/FadeInSection';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, user, setSession } = useAuthStore();
  const [email, setEmail] = useState('admin@vivan.local');
  const [password, setPassword] = useState('Admin123!');
  const [busy, setBusy] = useState(false);

  if (accessToken && user?.role === 'admin') {
    const to = (location.state as { from?: string } | null)?.from || '/admin';
    return <Navigate to={to} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.user?.role !== 'admin') {
        toast.error('This account is not an administrator');
        return;
      }
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      toast.success('Welcome');
      navigate('/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <FadeInSection className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Vivan Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Administrator sign-in only.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link to="/" className="text-brand-700 hover:underline">
            Back to store
          </Link>
        </p>
      </FadeInSection>
    </div>
  );
}
