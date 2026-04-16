import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

type S = {
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number | null;
  withdrawalFeeType: 'fixed' | 'percentage';
  withdrawalFeeValue: number;
  kycRequired: boolean;
  autoApprove: boolean;
  allowUpi: boolean;
  allowBankTransfer: boolean;
  onePendingRequestOnly: boolean;
};

export default function AdminWithdrawalSettingsPage() {
  const [form, setForm] = useState<S | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/withdrawal-settings')
      .then((r) => setForm(r.data.settings))
      .catch(() => toast.error('Could not load settings'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form) return;
    try {
      await api.put('/admin/withdrawal-settings', {
        min_withdrawal_amount: form.minWithdrawalAmount,
        max_withdrawal_amount: form.maxWithdrawalAmount,
        withdrawal_fee_type: form.withdrawalFeeType,
        withdrawal_fee_value: form.withdrawalFeeValue,
        kyc_required: form.kycRequired,
        auto_approve: form.autoApprove,
        allow_upi: form.allowUpi,
        allow_bank_transfer: form.allowBankTransfer,
        one_pending_request_only: form.onePendingRequestOnly
      });
      toast.success('Saved');
    } catch (e: any) {
      const msg = e.response?.data?.message || e.response?.data?.details;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Validation failed');
    }
  }

  if (loading || !form) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link to="/admin/withdrawals" className="text-sm text-brand-700 hover:underline">
        ← Withdrawals
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">Withdrawal settings</h1>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-xs text-slate-600">
          Min amount
          <input
            type="number"
            step="0.01"
            value={form.minWithdrawalAmount}
            onChange={(e) => setForm({ ...form, minWithdrawalAmount: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-slate-600">
          Max amount (empty = no max)
          <input
            type="number"
            step="0.01"
            value={form.maxWithdrawalAmount ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                maxWithdrawalAmount: e.target.value === '' ? null : Number(e.target.value)
              })
            }
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs text-slate-600">
          Fee type
          <select
            value={form.withdrawalFeeType}
            onChange={(e) => setForm({ ...form, withdrawalFeeType: e.target.value as 'fixed' | 'percentage' })}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="fixed">Fixed (₹)</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </label>
        <label className="block text-xs text-slate-600">
          Fee value
          <input
            type="number"
            step="0.0001"
            value={form.withdrawalFeeValue}
            onChange={(e) => setForm({ ...form, withdrawalFeeValue: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          {(
            [
              ['kycRequired', 'KYC required'],
              ['autoApprove', 'Auto-approve new requests'],
              ['allowUpi', 'Allow UPI payout profiles'],
              ['allowBankTransfer', 'Allow bank transfer profiles'],
              ['onePendingRequestOnly', 'One open request only (pending or approved)']
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>

        <button type="button" onClick={save} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
          Save settings
        </button>
      </div>
    </div>
  );
}
