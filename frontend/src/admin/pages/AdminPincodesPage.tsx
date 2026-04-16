import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';

type PincodeRow = {
  id: number;
  pincode: string;
  city: string;
  state: string;
  shipping_charge: number;
  cod_available: number | boolean;
  estimated_days: number;
  is_active: number | boolean;
};

const emptyForm = {
  pincode: '',
  city: '',
  state: '',
  shipping_charge: 49,
  cod_available: true,
  estimated_days: 3,
  is_active: true
};

export default function AdminPincodesPage() {
  const [rows, setRows] = useState<PincodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/pincodes');
      setRows(data.pincodes || []);
    } catch {
      toast.error('Failed to load pincodes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditingId(0);
    setForm(emptyForm);
  }

  function startEdit(r: PincodeRow) {
    setEditingId(r.id);
    setForm({
      pincode: r.pincode,
      city: r.city,
      state: r.state,
      shipping_charge: Number(r.shipping_charge),
      cod_available: Boolean(r.cod_available),
      estimated_days: Number(r.estimated_days),
      is_active: Boolean(r.is_active)
    });
  }

  function cancelForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save() {
    setSaving(true);
    try {
      if (editingId === 0) {
        await api.post('/admin/pincodes', form);
        toast.success('Pincode added');
      } else if (editingId) {
        await api.put(`/admin/pincodes/${editingId}`, form);
        toast.success('Pincode updated');
      }
      cancelForm();
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this serviceable pincode?')) return;
    try {
      await api.delete(`/admin/pincodes/${id}`);
      toast.success('Deleted');
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Delete failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Serviceable pincodes</h1>
          <p className="text-sm text-slate-500">
            When at least one active row exists, checkout validates the shipping PIN and uses per-zone shipping and COD rules.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Add pincode
        </button>
      </div>

      {editingId !== null ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">{editingId === 0 ? 'New pincode' : `Edit #${editingId}`}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              Pincode
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              City
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              State
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Shipping (₹)
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.shipping_charge}
                onChange={(e) => setForm({ ...form, shipping_charge: Number(e.target.value) })}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              ETA (days)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.estimated_days}
                onChange={(e) => setForm({ ...form, estimated_days: Number(e.target.value) })}
              />
            </label>
            <div className="flex flex-col gap-2 pt-5 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.cod_available} onChange={(e) => setForm({ ...form, cod_available: e.target.checked })} />
                COD allowed
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={cancelForm} className="rounded-full border border-slate-200 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Pincode</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Ship ₹</th>
                <th className="px-4 py-3">COD</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.pincode}</td>
                  <td className="px-4 py-3 text-slate-600">{r.city}</td>
                  <td className="px-4 py-3 text-slate-600">{r.state}</td>
                  <td className="px-4 py-3">₹{Number(r.shipping_charge).toFixed(0)}</td>
                  <td className="px-4 py-3">{r.cod_available ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{r.estimated_days}</td>
                  <td className="px-4 py-3">{r.is_active ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-brand-700 hover:underline" onClick={() => startEdit(r)}>
                      Edit
                    </button>
                    <button type="button" className="ml-3 text-red-600 hover:underline" onClick={() => remove(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
