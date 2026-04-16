import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

type Settings = Record<string, any>;

export default function AdminCompensationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Settings | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    api
      .get('/admin/compensation-settings')
      .then((r) => {
        const s = r.data.settings;
        setForm({
          welcome_bonus_enabled: !!s.welcome_bonus_enabled,
          welcome_bonus_amount: Number(s.welcome_bonus_amount),
          direct_income_enabled: !!s.direct_income_enabled,
          direct_income_type: s.direct_income_type,
          direct_income_value: Number(s.direct_income_value),
          trigger_stage: s.trigger_stage,
          max_direct_income_per_order:
            s.max_direct_income_per_order === null || s.max_direct_income_per_order === ''
              ? null
              : Number(s.max_direct_income_per_order),
          binary_income_enabled: !!s.binary_income_enabled,
          binary_percentage: Number(
            s.binary_percentage ??
              Math.min(Number(s.binary_left_percentage), Number(s.binary_right_percentage))
          ),
          binary_left_percentage: Number(s.binary_left_percentage),
          binary_right_percentage: Number(s.binary_right_percentage),
          carry_forward_enabled: !!s.carry_forward_enabled,
          daily_binary_ceiling: Number(s.daily_binary_ceiling),
          binary_ceiling_behavior: s.binary_ceiling_behavior,
          refund_reversal_enabled: !!s.refund_reversal_enabled,
          minimum_order_profit: Number(s.minimum_order_profit)
        });
      })
      .catch(() => toast.error('Could not load settings'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    setErrors([]);
    try {
      await api.put('/admin/compensation-settings', form);
      toast.success('Compensation settings saved');
    } catch (e: any) {
      const msg = e.response?.data?.message;
      const det = e.response?.data?.errors;
      if (Array.isArray(det)) setErrors(det.map((x: any) => String(x.message || x)));
      else if (msg) setErrors([msg]);
      else setErrors(['Save failed']);
      toast.error(msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Compensation settings</h1>
          <p className="text-sm text-slate-500">Controls welcome bonus, direct referral, binary matching, and safeguards.</p>
        </div>
        <Link to="/admin/binary-carry" className="text-sm text-brand-700 hover:underline">
          Binary carry →
        </Link>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <ul className="list-inside list-disc">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Welcome bonus</h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.welcome_bonus_enabled}
              onChange={(e) => setForm({ ...form, welcome_bonus_enabled: e.target.checked })}
            />
            Enabled
          </label>
          <label className="block text-sm text-slate-700">
            Amount (INR)
            <input
              type="number"
              min={0}
              step={1}
              value={form.welcome_bonus_amount}
              onChange={(e) => setForm({ ...form, welcome_bonus_amount: Number(e.target.value) })}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Direct referral income</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.direct_income_enabled}
              onChange={(e) => setForm({ ...form, direct_income_enabled: e.target.checked })}
            />
            Enabled
          </label>
          <label className="block text-sm text-slate-700">
            Type
            <select
              value={form.direct_income_type}
              onChange={(e) => setForm({ ...form, direct_income_type: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="percentage">Percentage of order profit</option>
              <option value="fixed">Fixed INR per order</option>
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Value {form.direct_income_type === 'percentage' ? '(%, e.g. 30)' : '(INR)'}
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.direct_income_value}
              onChange={(e) => setForm({ ...form, direct_income_value: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Trigger stage
            <select
              value={form.trigger_stage}
              onChange={(e) => setForm({ ...form, trigger_stage: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="delivered">When order is delivered (COD or paid)</option>
              <option value="paid">When online payment is captured (may run before delivery)</option>
            </select>
          </label>
          <label className="block text-sm text-slate-700 sm:col-span-2">
            Max direct income per order (INR, optional)
            <input
              type="number"
              min={0}
              step={1}
              placeholder="No cap"
              value={form.max_direct_income_per_order ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  max_direct_income_per_order: e.target.value === '' ? null : Number(e.target.value)
                })
              }
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Binary matching income</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.binary_income_enabled}
              onChange={(e) => setForm({ ...form, binary_income_enabled: e.target.checked })}
            />
            Binary income enabled
          </label>
          <label className="block text-sm text-slate-700 sm:col-span-2">
            Binary match rate (% of matched carry volume, single rate — not left+right combined)
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.binary_percentage}
              onChange={(e) => {
                const v = Number(e.target.value);
                setForm({
                  ...form,
                  binary_percentage: v,
                  binary_left_percentage: v,
                  binary_right_percentage: v
                });
              }}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.carry_forward_enabled}
              onChange={(e) => setForm({ ...form, carry_forward_enabled: e.target.checked })}
            />
            Carry forward (binary volume accumulates across orders)
          </label>
          <label className="block text-sm text-slate-700">
            Daily binary ceiling (INR / user / IST day)
            <input
              type="number"
              min={0}
              step={1}
              value={form.daily_binary_ceiling}
              onChange={(e) => setForm({ ...form, daily_binary_ceiling: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Ceiling overflow behavior
            <select
              value={form.binary_ceiling_behavior}
              onChange={(e) => setForm({ ...form, binary_ceiling_behavior: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="hold_unpaid">Hold as ceiling record (auditable)</option>
              <option value="discard_unpaid">Discard unpaid overflow (no hold row)</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Safeguards</h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.refund_reversal_enabled}
              onChange={(e) => setForm({ ...form, refund_reversal_enabled: e.target.checked })}
            />
            Reverse commissions when an order is cancelled / returned
          </label>
          <label className="block text-sm text-slate-700">
            Minimum order profit (INR) to qualify for commissions
            <input
              type="number"
              min={0}
              step={1}
              value={form.minimum_order_profit}
              onChange={(e) => setForm({ ...form, minimum_order_profit: Number(e.target.value) })}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
