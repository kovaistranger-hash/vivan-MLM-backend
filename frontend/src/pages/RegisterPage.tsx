import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    sponsorReferralCode: ''
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        sponsorReferralCode: form.sponsorReferralCode.trim() || undefined,
        acceptedTerms: true as const
      });
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      toast.success('Account created');
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Join Vivan</h1>
        <p className="mt-2 text-sm text-slate-500">
          Create your account. If someone invited you, add their referral code below. Binary placement is done later from{' '}
          <Link to="/referral" className="font-semibold text-brand-700 hover:underline">
            Referrals
          </Link>
          .
        </p>
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          Full name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Phone (optional)
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Sponsor referral code (optional)
          <input
            value={form.sponsorReferralCode}
            onChange={(e) => setForm({ ...form, sponsorReferralCode: e.target.value.toUpperCase() })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase outline-none ring-brand-200 focus:ring"
            placeholder="e.g. ABCD12EF"
          />
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" className="font-semibold text-brand-700 hover:underline" target="_blank" rel="noreferrer">
              Terms
            </Link>
            ,{' '}
            <Link to="/privacy" className="font-semibold text-brand-700 hover:underline" target="_blank" rel="noreferrer">
              Privacy
            </Link>
            ,{' '}
            <Link
              to="/income-disclaimer"
              className="font-semibold text-brand-700 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Income disclaimer
            </Link>
            , and confirm I am joining for genuine product use; I understand earnings are not guaranteed.
          </span>
        </label>
        <button
          type="submit"
          disabled={submitting || !acceptedTerms}
          className="w-full rounded-full bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? 'Creating...' : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link className="font-semibold text-brand-700 hover:text-brand-900" to="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
