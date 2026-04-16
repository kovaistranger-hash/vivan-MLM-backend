import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../services/api';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-sm leading-relaxed text-slate-600 shadow-sm">
        {children}
      </div>
      <Link to="/" className="text-sm font-semibold text-brand-700 hover:underline">
        Back to home
      </Link>
    </div>
  );
}

export function AboutPage() {
  return (
    <Shell title="About us">
      <p>
        Vivan is a premium ecommerce destination focused on beauty, fashion, electronics, home care, and personal care. We
        combine curated products with transparent pricing and a smooth checkout experience.
      </p>
    </Shell>
  );
}

export function ContactPage() {
  return (
    <Shell title="Contact">
      <p>
        Email us at <strong>care@vivan.local</strong> or call support between 10am-7pm IST. For order issues, include your
        order number.
      </p>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Privacy policy">
      <p>
        We collect account and order data needed to fulfill purchases and improve our service. Payment details are handled by
        our payment partners; we do not store card numbers on Vivan servers.
      </p>
    </Shell>
  );
}

export function TermsPage() {
  return (
    <Shell title="Terms of use">
      <p>
        By using Vivan you agree to our policies and acceptable use guidelines. Product availability and prices may change
        without notice; confirmed orders are honored at the price shown at checkout.
      </p>
      <p className="mt-4">
        Where referral or team features are offered, they are ancillary to genuine product sales and service usage. Vivan does
        not promote or reward income based solely on recruitment. Commissions and incentives, where applicable, are linked to
        qualifying purchases and documented in your wallet and order history.
      </p>
      <p className="mt-4 text-xs text-slate-500">
        For consumer grievances in India, use the{' '}
        <Link to="/grievance" className="font-semibold text-brand-700 hover:underline">
          grievance form
        </Link>
        . We acknowledge complaints in line with applicable consumer-protection timelines.
      </p>
    </Shell>
  );
}

export function RefundPolicyPage() {
  return (
    <Shell title="Refund policy">
      <p>
        Eligible returns may be refunded to the original payment method or as store credit per admin approval. Digital goods
        and hygiene items may be non-returnable where required by law.
      </p>
    </Shell>
  );
}

export function ShippingPolicyPage() {
  return (
    <Shell title="Shipping policy">
      <p>
        Standard delivery timelines are shown at checkout based on your pincode. Free shipping may apply on qualifying orders
        as promoted on the storefront.
      </p>
    </Shell>
  );
}

export function IncomeDisclaimerPage() {
  return (
    <Shell title="Income disclaimer">
      <p>
        Vivan does not guarantee any income. Earnings depend on individual effort, sales performance, and team-building
        activities tied to genuine product movement. The company strictly prohibits compensation based solely on recruitment
        without product sales or qualifying service usage.
      </p>
      <p className="mt-4 text-xs text-slate-500">
        Past results are not indicative of future earnings. Refer to your dashboard and official statements for actual
        credits and payouts.
      </p>
    </Shell>
  );
}

export function KycPolicyPage() {
  return (
    <Shell title="KYC policy">
      <p>
        Know Your Customer (KYC) checks help us meet regulatory and risk requirements for wallet withdrawals, referral payouts,
        and fraud prevention. You may be asked for identity and address proof; we store documents securely and use them only
        for verification and legal compliance.
      </p>
      <p className="mt-4">
        Higher withdrawal amounts may require stronger verification (for example PAN and liveness checks). You can submit or
        update KYC from the <Link to="/kyc">KYC</Link> page after signing in.
      </p>
    </Shell>
  );
}

export function GrievancePage() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/complaints', { message: message.trim() });
      toast.success('Complaint submitted. Our team will review it.');
      setMessage('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Could not submit. Please sign in and try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Grievance / complaint</h1>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-sm leading-relaxed text-slate-600 shadow-sm">
        <p>
          Use this form for order, refund, wallet, or conduct-related issues. Signed-in customers can submit directly; if you
          are not signed in, please <Link to="/login">log in</Link> first so we can link the grievance to your account.
        </p>
        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Describe your issue (min. 10 characters)
            <textarea
              required
              minLength={10}
              maxLength={8000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
            />
          </label>
          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {sending ? 'Submitting…' : 'Submit grievance'}
          </button>
        </form>
      </div>
      <Link to="/" className="text-sm font-semibold text-brand-700 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
