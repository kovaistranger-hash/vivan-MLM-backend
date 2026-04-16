import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('member@vivan.local');
  const [password, setPassword] = useState('Member123!');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      toast.success('Welcome back');
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sign in to Vivan</h1>
        <p className="mt-2 text-sm text-slate-500">Access your cart, orders, and future member tools.</p>
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Signing in...' : 'Continue'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500">
        New here?{' '}
        <Link className="font-semibold text-brand-700 hover:text-brand-900" to="/register">
          Create an account
        </Link>
      </p>
    </div>
  );
}
