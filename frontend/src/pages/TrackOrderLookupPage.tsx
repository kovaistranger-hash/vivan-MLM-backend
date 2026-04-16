import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function TrackOrderLookupPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = orderNumber.trim();
    if (!n) return;
    navigate(`/orders/track/${encodeURIComponent(n)}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Track your order</h1>
        <p className="mt-2 text-sm text-slate-500">Enter the order number from your confirmation email.</p>
      </div>
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Order number</label>
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="e.g. VIV-10042"
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none ring-brand-200 focus:ring-2"
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-brand-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
        >
          Track
        </button>
      </form>
      <p className="text-center text-sm text-slate-500">
        <Link to="/orders" className="font-semibold text-brand-700 hover:underline">
          View my orders
        </Link>
      </p>
    </div>
  );
}
