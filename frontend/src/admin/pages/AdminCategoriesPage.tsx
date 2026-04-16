import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';

type Cat = { id: number; name: string; slug: string; is_active: number; parent_id: number | null };

export default function AdminCategoriesPage() {
  const [rows, setRows] = useState<Cat[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', is_active: true, parent_id: '' as string | number });
  const [editId, setEditId] = useState<number | null>(null);

  function load() {
    api.get('/admin/categories').then((r) => setRows(r.data.categories || []));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    try {
      await api.post('/admin/categories', {
        name: form.name,
        slug: form.slug.trim().toLowerCase(),
        is_active: form.is_active,
        parent_id: form.parent_id === '' ? null : Number(form.parent_id)
      });
      toast.success('Category created');
      setForm({ name: '', slug: '', is_active: true, parent_id: '' });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  async function saveEdit() {
    if (!editId) return;
    try {
      await api.put(`/admin/categories/${editId}`, {
        name: form.name,
        slug: form.slug.trim().toLowerCase(),
        is_active: form.is_active,
        parent_id: form.parent_id === '' ? null : Number(form.parent_id)
      });
      toast.success('Updated');
      setEditId(null);
      setForm({ name: '', slug: '', is_active: true, parent_id: '' });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  function startEdit(c: Cat) {
    setEditId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      is_active: !!c.is_active,
      parent_id: c.parent_id ?? ''
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
        <p className="text-sm text-slate-500">Optional parent for subcategories.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (editId) void saveEdit();
          else void create();
        }}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-slate-800">{editId ? `Edit #${editId}` : 'Create category'}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input required placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
            <option value="">No parent</option>
            {rows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
        <div className="flex gap-2">
          <button type="submit" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
            {editId ? 'Save changes' : 'Create'}
          </button>
          {editId ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm"
              onClick={() => {
                setEditId(null);
                setForm({ name: '', slug: '', is_active: true, parent_id: '' });
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Parent</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2 text-slate-600">{c.slug}</td>
                <td className="px-4 py-2 text-slate-500">{(c as any).parent_name || '—'}</td>
                <td className="px-4 py-2">{c.is_active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2 text-right">
                  <button type="button" className="text-brand-700 hover:underline" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
