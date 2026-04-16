import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';
import WalletSubNav from '../components/WalletSubNav';

type Bank = {
  id: number;
  account_holder_name: string;
  bank_name: string;
  account_number: string | null;
  ifsc_code: string | null;
  branch_name: string | null;
  upi_id: string | null;
  is_default: number;
};

const emptyForm = {
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  branch_name: '',
  upi_id: '',
  is_default: false
};

export default function WalletBankAccountsPage() {
  const { accessToken } = useAuthStore();
  const [items, setItems] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  function load() {
    if (!accessToken) return;
    api
      .get('/wallet/bank-accounts')
      .then((r) => setItems(r.data.bankAccounts || []))
      .catch(() => toast.error('Could not load bank accounts'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [accessToken]);

  function startCreate() {
    setEditingId(0);
    setForm(emptyForm);
  }

  function startEdit(b: Bank) {
    setEditingId(b.id);
    setForm({
      account_holder_name: b.account_holder_name,
      bank_name: b.bank_name,
      account_number: b.account_number || '',
      ifsc_code: b.ifsc_code || '',
      branch_name: b.branch_name || '',
      upi_id: b.upi_id || '',
      is_default: !!b.is_default
    });
  }

  async function save() {
    try {
      if (editingId === 0) {
        await api.post('/wallet/bank-accounts', form);
        toast.success('Bank account added');
      } else if (editingId) {
        await api.put(`/wallet/bank-accounts/${editingId}`, form);
        toast.success('Bank account updated');
      }
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Save failed');
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this bank account?')) return;
    try {
      await api.delete(`/wallet/bank-accounts/${id}`);
      toast.success('Deleted');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Delete failed');
    }
  }

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        <Link className="font-semibold text-brand-700" to="/login">
          Sign in
        </Link>{' '}
        to manage bank accounts.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Bank accounts</h1>
        <p className="mt-1 text-sm text-slate-500">Used for withdrawals. IFSC + account or UPI (per admin settings).</p>
      </div>
      <WalletSubNav />

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startCreate}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Add account
            </button>
            <Link to="/wallet/withdraw" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Request withdrawal
            </Link>
          </div>

          {editingId !== null ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">{editingId === 0 ? 'New account' : 'Edit account'}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-600">
                  Account holder *
                  <input
                    value={form.account_holder_name}
                    onChange={(e) => setForm((f) => ({ ...f, account_holder_name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Bank name *
                  <input
                    value={form.bank_name}
                    onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  Account number
                  <input
                    value={form.account_number}
                    onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  IFSC
                  <input
                    value={form.ifsc_code}
                    onChange={(e) => setForm((f) => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
                  />
                </label>
                <label className="text-xs text-slate-600 md:col-span-2">
                  Branch (optional)
                  <input
                    value={form.branch_name}
                    onChange={(e) => setForm((f) => ({ ...f, branch_name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs text-slate-600 md:col-span-2">
                  UPI ID (optional)
                  <input
                    value={form.upi_id}
                    onChange={(e) => setForm((f) => ({ ...f, upi_id: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                  />
                  Set as default
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={save} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {items.map((b) => (
              <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{b.bank_name}</p>
                    <p className="text-sm text-slate-600">{b.account_holder_name}</p>
                    {b.account_number ? (
                      <p className="mt-1 font-mono text-xs text-slate-500">····{String(b.account_number).slice(-4)}</p>
                    ) : null}
                    {b.ifsc_code ? <p className="font-mono text-xs text-slate-500">{b.ifsc_code}</p> : null}
                    {b.upi_id ? <p className="text-xs text-slate-600">UPI: {b.upi_id}</p> : null}
                  </div>
                  {b.is_default ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Default</span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => startEdit(b)} className="text-sm font-semibold text-brand-700">
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(b.id)} className="text-sm font-semibold text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 && editingId === null ? (
            <p className="text-sm text-slate-500">No bank accounts yet. Add one to withdraw.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
