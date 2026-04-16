import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { toast } from 'sonner';

type Banner = { id: number; title: string; subtitle: string | null; image_url: string; link_url: string | null; sort_order: number; is_active: number };

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    link_url: '',
    sort_order: 0,
    is_active: true
  });
  const [editId, setEditId] = useState<number | null>(null);

  function load() {
    api.get('/admin/banners').then((r) => setBanners(r.data.banners || []));
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      subtitle: form.subtitle || null,
      image_url: form.image_url,
      link_url: form.link_url || null,
      sort_order: form.sort_order,
      is_active: form.is_active
    };
    try {
      if (editId) {
        await api.put(`/admin/banners/${editId}`, payload);
        toast.success('Banner updated');
      } else {
        await api.post('/admin/banners', payload);
        toast.success('Banner created');
      }
      setEditId(null);
      setForm({ title: '', subtitle: '', image_url: '', link_url: '', sort_order: 0, is_active: true });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this banner?')) return;
    try {
      await api.delete(`/admin/banners/${id}`);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  }

  function startEdit(b: Banner) {
    setEditId(b.id);
    setForm({
      title: b.title,
      subtitle: b.subtitle || '',
      image_url: b.image_url,
      link_url: b.link_url || '',
      sort_order: b.sort_order,
      is_active: !!b.is_active
    });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Banners</h1>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{editId ? `Edit banner #${editId}` : 'New banner'}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input placeholder="Subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input required placeholder="Image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input placeholder="Link URL" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input type="number" placeholder="Sort order" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="rounded-lg border px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
        <div className="flex gap-2">
          <button type="submit" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
            {editId ? 'Save' : 'Create'}
          </button>
          {editId ? (
            <button
              type="button"
              className="rounded-full border px-4 py-2 text-sm"
              onClick={() => {
                setEditId(null);
                setForm({ title: '', subtitle: '', image_url: '', link_url: '', sort_order: 0, is_active: true });
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {banners.map((b) => (
          <div key={b.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <img src={b.image_url} alt="" className="h-36 w-full object-cover" />
            <div className="p-4 text-sm">
              <p className="font-semibold text-slate-900">{b.title}</p>
              {b.subtitle ? <p className="text-slate-500">{b.subtitle}</p> : null}
              <div className="mt-2 flex gap-2">
                <button type="button" className="text-brand-700 hover:underline" onClick={() => startEdit(b)}>
                  Edit
                </button>
                <button type="button" className="text-red-600 hover:underline" onClick={() => remove(b.id)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
