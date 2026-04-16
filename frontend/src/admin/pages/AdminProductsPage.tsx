import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';

const PLACEHOLDER = 'https://placehold.co/80x80/png?text=Vivan';

export default function AdminProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const page = Number(searchParams.get('page') || '1');
  const categoryId = searchParams.get('categoryId') || '';
  const isActive = searchParams.get('isActive') || 'all';
  const lowStock = searchParams.get('lowStock') || '';

  const [data, setData] = useState<{ products: any[]; pagination: any; lowStockThreshold?: number } | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const searchInput = useRef<HTMLInputElement>(null);

  const qs = useMemo(
    () => ({
      search: search || undefined,
      page,
      pageSize: 15,
      categoryId: categoryId ? Number(categoryId) : undefined,
      isActive: isActive === 'all' ? undefined : (isActive as '1' | '0'),
      lowStock: lowStock === '1' ? '1' : undefined
    }),
    [search, page, categoryId, isActive, lowStock]
  );

  useEffect(() => {
    api.get('/admin/categories').then((r) => setCategories(r.data.categories || []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/admin/products', { params: qs })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qs]);

  async function softDelete(id: number) {
    if (!confirm('Archive this product? It will disappear from the storefront.')) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success('Product archived');
      setData((d) =>
        d
          ? {
              ...d,
              products: d.products.filter((p: { id: number }) => p.id !== id)
            }
          : d
      );
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Delete failed');
    }
  }

  async function patchFlag(id: number, patch: Record<string, boolean>) {
    try {
      await api.patch(`/admin/products/${id}/flags`, patch);
      setData((d) =>
        d
          ? {
              ...d,
              products: d.products.map((p: any) => (p.id === id ? { ...p, ...patch } : p))
            }
          : d
      );
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Update failed');
    }
  }

  function setParam(key: string, value: string) {
    const n = new URLSearchParams(searchParams);
    if (value) n.set(key, value);
    else n.delete(key);
    n.delete('page');
    setSearchParams(n);
  }

  function setSearch(v: string) {
    setParam('search', v);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">Search, filter, quick flags, and archive catalog items.</p>
        </div>
        <Link
          to="/admin/products/new"
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          New product
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          ref={searchInput}
          placeholder="Search name, SKU, slug…"
          defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearch((e.target as HTMLInputElement).value);
          }}
          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={categoryId}
          onChange={(e) => setParam('categoryId', e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={isActive} onChange={(e) => setParam('isActive', e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="all">Active: any</option>
          <option value="1">Active only</option>
          <option value="0">Inactive</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={lowStock === '1'} onChange={(e) => setParam('lowStock', e.target.checked ? '1' : '')} />
          Low stock
        </label>
        <button
          type="button"
          onClick={() => setSearch(searchInput.current?.value || '')}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
        >
          Search
        </button>
        <button type="button" onClick={() => setSearchParams(new URLSearchParams())} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          Reset
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3"> </th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Stock</th>
                <th className="px-3 py-3">Flags</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.products || []).map((p: any, rowIdx: number) => {
                const low = data?.lowStockThreshold != null && Number(p.stock_qty) < Number(data.lowStockThreshold);
                return (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(rowIdx, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
                    className={p.deleted_at ? 'bg-slate-50 opacity-70' : low ? 'bg-amber-50/40' : ''}
                  >
                    <td className="px-3 py-2">
                      <img src={p.image_url || PLACEHOLDER} alt="" className="h-12 w-12 rounded-lg border border-slate-100 object-cover" />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="px-3 py-2 text-slate-600">{p.category_name || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{p.sku || '—'}</td>
                    <td className="px-3 py-2">₹{Number(p.sale_price).toFixed(0)}</td>
                    <td className="px-3 py-2">
                      {p.stock_qty}
                      {low ? <span className="ml-1 text-xs text-amber-700">low</span> : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1 text-[11px]">
                        <button
                          type="button"
                          title="Active"
                          onClick={() => patchFlag(p.id, { is_active: !p.is_active })}
                          className={`rounded-full px-2 py-0.5 font-medium ${p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          title="Featured"
                          onClick={() => patchFlag(p.id, { is_featured: !p.is_featured })}
                          className={`rounded-full px-2 py-0.5 font-medium ${p.is_featured ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-600'}`}
                        >
                          F
                        </button>
                        <button
                          type="button"
                          title="Bestseller"
                          onClick={() => patchFlag(p.id, { is_bestseller: !p.is_bestseller })}
                          className={`rounded-full px-2 py-0.5 font-medium ${p.is_bestseller ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-600'}`}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          title="New"
                          onClick={() => patchFlag(p.id, { is_new_arrival: !p.is_new_arrival })}
                          className={`rounded-full px-2 py-0.5 font-medium ${p.is_new_arrival ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'}`}
                        >
                          N
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link to={`/admin/products/${p.id}/edit`} className="text-brand-700 hover:underline">
                        Edit
                      </Link>
                      {!p.deleted_at ? (
                        <button type="button" className="ml-3 text-red-600 hover:underline" onClick={() => softDelete(p.id)}>
                          Archive
                        </button>
                      ) : null}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {data?.pagination ? (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              <span>
                Page {data.pagination.page} / {data.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40"
                  onClick={() => {
                    const n = new URLSearchParams(searchParams);
                    n.set('page', String(page - 1));
                    setSearchParams(n);
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= (data.pagination.totalPages || 1)}
                  className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40"
                  onClick={() => {
                    const n = new URLSearchParams(searchParams);
                    n.set('page', String(page + 1));
                    setSearchParams(n);
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
