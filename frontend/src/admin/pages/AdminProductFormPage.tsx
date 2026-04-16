import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { slugifyName } from '../../utils/slugify';

const PLACEHOLDER = 'https://placehold.co/400x400/png?text=Vivan';
const MAX_PRODUCT_IMAGES = 5;

const empty = {
  category_id: '' as string | number,
  brand_id: '' as string | number,
  name: '',
  slug: '',
  sku: '',
  short_description: '',
  long_description: '',
  mrp_price: 0,
  sale_price: 0,
  bv: 0,
  pv: 0,
  gst_rate: 18,
  stock_qty: 0,
  image_url: '',
  gallery_urls: [] as string[],
  is_active: true,
  is_featured: false,
  is_new_arrival: false,
  is_bestseller: false
};

function parseGallery(p: any): string[] {
  let gj = p.gallery_json;
  if (typeof gj === 'string') {
    try {
      gj = JSON.parse(gj);
    } catch {
      gj = [];
    }
  }
  if (!Array.isArray(gj)) return [];
  return gj.map(String).filter(Boolean);
}

function totalImageCount(imageUrl: string, galleryUrls: string[]) {
  return (imageUrl.trim() ? 1 : 0) + galleryUrls.length;
}

function maxGalleryCount(imageUrl: string) {
  return MAX_PRODUCT_IMAGES - (imageUrl.trim() ? 1 : 0);
}

function galleryLimitMessage(imageUrl: string) {
  const galleryMax = maxGalleryCount(imageUrl);
  return imageUrl.trim()
    ? `Maximum ${MAX_PRODUCT_IMAGES} total images including the main image (${galleryMax} gallery allowed)`
    : `Maximum ${MAX_PRODUCT_IMAGES} total images`;
}

type FieldErrors = Partial<Record<'name' | 'slug' | 'sku' | 'root', string>>;

function flattenFieldErrors(details: unknown): FieldErrors {
  const out: FieldErrors = {};
  const fe = (details as { fieldErrors?: Record<string, string[] | undefined> })?.fieldErrors;
  if (!fe || typeof fe !== 'object') return out;
  for (const [k, v] of Object.entries(fe)) {
    if (Array.isArray(v) && v.length) {
      const msg = v.join(' ');
      if (k === 'name' || k === 'slug' || k === 'sku') out[k] = msg;
      else if (!out.root) out.root = `${k}: ${msg}`;
      else out.root = `${out.root}; ${k}: ${msg}`;
    }
  }
  return out;
}

export default function AdminProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [form, setForm] = useState(empty);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [galleryUrlInput, setGalleryUrlInput] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const mainInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const slugLockedRef = useRef(false);
  const skuLockedRef = useRef(false);

  useEffect(() => {
    api.get('/admin/categories').then((r) => setCategories(r.data.categories || []));
    api.get('/admin/brands').then((r) => setBrands(r.data.brands || []));
  }, []);

  useEffect(() => {
    if (isNew) {
      slugLockedRef.current = false;
      skuLockedRef.current = false;
    }
  }, [isNew]);

  useEffect(() => {
    if (isNew) return;
    api
      .get(`/admin/products/${id}`)
      .then((res) => {
        const p = res.data.product;
        slugLockedRef.current = true;
        skuLockedRef.current = true;
        setForm({
          category_id: p.category_id ?? '',
          brand_id: p.brand_id ?? '',
          name: p.name,
          slug: p.slug,
          sku: p.sku || '',
          short_description: p.short_description || '',
          long_description: p.long_description || '',
          mrp_price: Number(p.mrp_price),
          sale_price: Number(p.sale_price),
          bv: Number(p.bv),
          pv: Number(p.pv),
          gst_rate: Number(p.gst_rate),
          stock_qty: Number(p.stock_qty),
          image_url: p.image_url || '',
          gallery_urls: parseGallery(p).slice(0, maxGalleryCount(p.image_url || '')),
          is_active: !!p.is_active,
          is_featured: !!p.is_featured,
          is_new_arrival: !!p.is_new_arrival,
          is_bestseller: !!p.is_bestseller
        });
      })
      .catch(() => toast.error('Failed to load product'));
  }, [id, isNew]);

  const fetchSuggest = useCallback(async () => {
    const hasName = form.name.trim().length > 0;
    const hasCat = form.category_id !== '' && form.category_id !== undefined;
    if (!hasName && !hasCat) return;
    if (slugLockedRef.current && skuLockedRef.current) return;

    const params: Record<string, string | number> = {};
    if (hasName) params.name = form.name.trim();
    if (hasCat) params.categoryId = Number(form.category_id);
    if (!isNew && id) params.productId = Number(id);

    const { data } = await api.get<{ suggestedSlug: string; suggestedSku: string }>('/admin/products/suggest-identifiers', {
      params
    });

    setForm((prev) => {
      const next = { ...prev };
      if (!slugLockedRef.current && data.suggestedSlug) {
        next.slug = data.suggestedSlug;
      }
      if (!skuLockedRef.current && data.suggestedSku) {
        next.sku = data.suggestedSku;
      }
      return next;
    });
  }, [form.name, form.category_id, id, isNew]);

  useEffect(() => {
    const hasName = form.name.trim().length > 0;
    const hasCat = form.category_id !== '' && form.category_id !== undefined;
    if (!hasName && !hasCat) return;

    const t = window.setTimeout(() => {
      fetchSuggest().catch(() => {
        /* debounced suggest is best-effort */
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [form.name, form.category_id, fetchSuggest]);

  async function uploadFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/admin/upload/image', fd, {
      onUploadProgress: (ev) => {
        if (ev.total) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
      }
    });
  }

  async function onMainFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setUploadPct(0);
      const { data } = await uploadFile(f);
      setForm((x) => ({ ...x, image_url: data.url }));
      toast.success('Main image uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadPct(null);
    }
  }

  async function onGalleryFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = '';
    if (!files?.length) return;
    const urls: string[] = [];
    try {
      const galleryMax = maxGalleryCount(form.image_url);
      for (const f of Array.from(files)) {
        if (form.gallery_urls.length + urls.length >= galleryMax) {
          toast.message(galleryLimitMessage(form.image_url));
          break;
        }
        setUploadPct(0);
        const { data } = await uploadFile(f);
        urls.push(data.url);
      }
      if (urls.length) {
        setForm((x) => ({
          ...x,
          gallery_urls: [...x.gallery_urls, ...urls].slice(0, maxGalleryCount(x.image_url))
        }));
        toast.success(urls.length > 1 ? `${urls.length} images uploaded` : 'Image uploaded');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadPct(null);
    }
  }

  function appendGalleryUrl() {
    const u = galleryUrlInput.trim();
    if (!u) return;
    if (form.gallery_urls.length >= maxGalleryCount(form.image_url)) {
      toast.error(galleryLimitMessage(form.image_url));
      return;
    }
    setForm((x) => ({ ...x, gallery_urls: [...x.gallery_urls, u] }));
    setGalleryUrlInput('');
  }

  function removeGalleryAt(idx: number) {
    setForm((x) => ({ ...x, gallery_urls: x.gallery_urls.filter((_, i) => i !== idx) }));
  }

  function onNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value;
    setFieldErrors((prev) => ({ ...prev, name: undefined, slug: undefined }));
    setForm((prev) => {
      const next = { ...prev, name };
      if (!slugLockedRef.current) {
        next.slug = slugifyName(name);
      }
      return next;
    });
  }

  function onSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    slugLockedRef.current = true;
    setFieldErrors((er) => ({ ...er, slug: undefined }));
    setForm({ ...form, slug: e.target.value });
  }

  function onSkuChange(e: React.ChangeEvent<HTMLInputElement>) {
    skuLockedRef.current = true;
    setFieldErrors((er) => ({ ...er, sku: undefined }));
    setForm({ ...form, sku: e.target.value });
  }

  async function regenerateSlug() {
    slugLockedRef.current = false;
    setFieldErrors((er) => ({ ...er, slug: undefined }));
    const params: Record<string, string | number> = {};
    if (form.name.trim()) params.name = form.name.trim();
    if (form.category_id !== '') params.categoryId = Number(form.category_id);
    if (!isNew && id) params.productId = Number(id);
    try {
      const { data } = await api.get<{ suggestedSlug: string }>('/admin/products/suggest-identifiers', { params });
      setForm((f) => ({
        ...f,
        slug: data.suggestedSlug || slugifyName(f.name)
      }));
    } catch {
      setForm((f) => ({ ...f, slug: slugifyName(f.name) }));
    }
  }

  async function regenerateSku() {
    skuLockedRef.current = false;
    setFieldErrors((er) => ({ ...er, sku: undefined }));
    const params: Record<string, string | number> = {};
    if (form.name.trim()) params.name = form.name.trim();
    if (form.category_id !== '') params.categoryId = Number(form.category_id);
    if (!isNew && id) params.productId = Number(id);
    try {
      const { data } = await api.get<{ suggestedSku: string }>('/admin/products/suggest-identifiers', { params });
      setForm((f) => ({ ...f, sku: data.suggestedSku || f.sku }));
    } catch {
      toast.error('Could not suggest SKU');
    }
  }

  function buildPayload() {
    return {
      category_id: form.category_id === '' ? null : Number(form.category_id),
      brand_id: form.brand_id === '' ? null : Number(form.brand_id),
      name: form.name,
      slug: form.slug.trim().toLowerCase(),
      sku: form.sku.trim() || null,
      short_description: form.short_description || null,
      long_description: form.long_description || null,
      mrp_price: form.mrp_price,
      sale_price: form.sale_price,
      bv: form.bv,
      pv: form.pv,
      gst_rate: form.gst_rate,
      stock_qty: form.stock_qty,
      image_url: form.image_url || null,
      gallery_json: form.gallery_urls.length ? form.gallery_urls : null,
      is_active: form.is_active,
      is_featured: form.is_featured,
      is_new_arrival: form.is_new_arrival,
      is_bestseller: form.is_bestseller
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      if (totalImageCount(form.image_url, form.gallery_urls) > MAX_PRODUCT_IMAGES) {
        const msg = `Maximum ${MAX_PRODUCT_IMAGES} total images including the main image`;
        setFieldErrors((prev) => ({ ...prev, root: msg }));
        toast.error(msg);
        return;
      }
      const payload = buildPayload();
      if (isNew) {
        await api.post('/admin/products', payload);
        toast.success('Product created');
      } else {
        await api.put(`/admin/products/${id}`, payload);
        toast.success('Product updated');
      }
      navigate('/admin/products');
    } catch (err: any) {
      const status = err.response?.status;
      const details = err.response?.data?.details;
      if (status === 422 && details) {
        setFieldErrors(flattenFieldErrors(details));
      }
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">{isNew ? 'New product' : 'Edit product'}</h1>
        <Link to="/admin/products" className="text-sm text-brand-700 hover:underline">
          Back
        </Link>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {fieldErrors.root ? <p className="text-sm text-red-600">{fieldErrors.root}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Name *
            <input
              required
              value={form.name}
              onChange={onNameChange}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldErrors.name ? 'border-red-500' : ''}`}
            />
            {fieldErrors.name ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.name}</span> : null}
          </label>
          <div className="text-sm font-medium text-slate-700">
            <span>Slug *</span>
            <div className="mt-1 flex gap-2">
              <input
                required
                value={form.slug}
                onChange={onSlugChange}
                className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm ${fieldErrors.slug ? 'border-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={regenerateSlug}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                Regenerate
              </button>
            </div>
            <p className="mt-1 text-xs font-normal text-slate-500">
              Auto-filled from the name (lowercase, hyphens). Edit manually anytime, or use Regenerate to sync from the name and avoid duplicates.
            </p>
            {fieldErrors.slug ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.slug}</span> : null}
          </div>
        </div>
        <div className="text-sm font-medium text-slate-700">
          <span>SKU</span>
          <div className="mt-1 flex gap-2">
            <input
              value={form.sku}
              onChange={onSkuChange}
              placeholder="e.g. VIV-SUP-001"
              className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm ${fieldErrors.sku ? 'border-red-500' : ''}`}
            />
            <button
              type="button"
              onClick={regenerateSku}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              Regenerate
            </button>
          </div>
          <p className="mt-1 text-xs font-normal text-slate-500">
            Format <span className="font-mono">VIV-XXX-001</span> where XXX comes from the category (or GEN). Updates when the name or category changes until you edit it manually.
          </p>
          {fieldErrors.sku ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.sku}</span> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Category
            <select
              value={form.category_id}
              onChange={(e) => {
                setFieldErrors((er) => ({ ...er, sku: undefined }));
                setForm({ ...form, category_id: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Brand
            <select
              value={form.brand_id}
              onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Short description
          <input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Long description
          <textarea rows={4} value={form.long_description} onChange={(e) => setForm({ ...form, long_description: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            MRP
            <input type="number" step="0.01" value={form.mrp_price} onChange={(e) => setForm({ ...form, mrp_price: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Sale price
            <input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            GST % (gst_rate)
            <input type="number" step="0.01" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            BV
            <input type="number" step="0.01" value={form.bv} onChange={(e) => setForm({ ...form, bv: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            PV
            <input type="number" step="0.01" value={form.pv} onChange={(e) => setForm({ ...form, pv: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Stock qty
            <input type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-sm font-semibold text-slate-900">Main image</p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <img src={form.image_url || PLACEHOLDER} alt="" className="h-28 w-28 rounded-lg border border-slate-200 object-cover" />
            <div className="flex flex-col gap-2">
              <input ref={mainInputRef} type="file" accept="image/*" className="hidden" aria-label="Upload main product image" onChange={onMainFileChange} />
              <button
                type="button"
                onClick={() => mainInputRef.current?.click()}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Upload / replace
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                className="text-sm text-red-600 hover:underline"
              >
                Remove main image
              </button>
            </div>
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Or paste image URL
            <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="https://..." />
          </label>
          {uploadPct !== null ? (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-brand-600 transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{uploadPct}%</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-sm font-semibold text-slate-900">Gallery (optional)</p>
          <p className="mt-1 text-xs text-slate-500">
            Up to {MAX_PRODUCT_IMAGES} total images including the main image. {Math.max(0, maxGalleryCount(form.image_url) - form.gallery_urls.length)} gallery slot(s) left.
          </p>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            aria-label="Upload gallery images"
            onChange={onGalleryFilesChange}
          />
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="mt-3 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Upload gallery images
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={galleryUrlInput}
              onChange={(e) => setGalleryUrlInput(e.target.value)}
              className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Image URL"
            />
            <button type="button" onClick={appendGalleryUrl} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              Add URL
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {form.gallery_urls.map((url, idx) => (
              <div key={`${url}-${idx}`} className="relative">
                <img src={url} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                <button
                  type="button"
                  onClick={() => removeGalleryAt(idx)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow"
                  aria-label="Remove"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
            Featured
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_bestseller} onChange={(e) => setForm({ ...form, is_bestseller: e.target.checked })} />
            Bestseller
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_new_arrival} onChange={(e) => setForm({ ...form, is_new_arrival: e.target.checked })} />
            New arrival
          </label>
        </div>
        <button type="submit" disabled={saving} className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save product'}
        </button>
      </form>
    </div>
  );
}
