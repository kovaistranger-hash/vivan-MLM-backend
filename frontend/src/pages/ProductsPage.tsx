import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { api } from '../services/api';
import ProductCard, { ProductCardModel } from '../components/ProductCard';
import SkeletonGrid from '../components/SkeletonGrid';
import StaggerGrid from '../components/motion/StaggerGrid';
import { filterStorefrontCategories, STOREFRONT_CATEGORIES } from '../config/storefrontCatalog';

type Category = { id: number; name: string; slug: string };

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ProductCardModel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [suggestions, setSuggestions] = useState<ProductCardModel[]>([]);
  const [mobileFilters, setMobileFilters] = useState(false);

  const page = Number(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const slug = searchParams.get('slug') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const sort = searchParams.get('sort') || 'newest';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const minBv = searchParams.get('minBv') || '';
  const maxBv = searchParams.get('maxBv') || '';

  const queryObject = useMemo(
    () => ({
      page,
      pageSize: 12,
      search: search || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      sort,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      minBv: minBv ? Number(minBv) : undefined,
      maxBv: maxBv ? Number(maxBv) : undefined
    }),
    [page, search, categoryId, sort, minPrice, maxPrice, minBv, maxBv]
  );

  useEffect(() => {
    api.get('/categories').then((res) => {
      const raw = res.data.categories || [];
      setCategories(filterStorefrontCategories(raw));
    });
  }, []);

  useEffect(() => {
    if (!slug || !categories.length) return;
    const row = categories.find((c) => c.slug === slug);
    if (!row) {
      const next = new URLSearchParams(searchParams);
      next.delete('slug');
      setSearchParams(next, { replace: true });
      return;
    }
    if (searchParams.get('categoryId') !== String(row.id)) {
      const next = new URLSearchParams(searchParams);
      next.set('categoryId', String(row.id));
      next.delete('slug');
      next.delete('page');
      setSearchParams(next, { replace: true });
    }
  }, [slug, categories, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get('/products', { params: queryObject });
        if (cancelled) return;
        setProducts(res.data.products || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [queryObject]);

  useEffect(() => {
    let handle: number | undefined;
    if (!search.trim()) {
      setSuggestions([]);
      return;
    }
    handle = window.setTimeout(async () => {
      const res = await api.get('/products/autocomplete', { params: { q: search } });
      setSuggestions(res.data.suggestions || []);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  }

  function clearCategory() {
    const next = new URLSearchParams(searchParams);
    next.delete('categoryId');
    next.delete('slug');
    next.delete('page');
    setSearchParams(next);
  }

  const filterAside = (
    <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between md:hidden">
        <span className="text-sm font-semibold text-slate-900">Filters</span>
        <button type="button" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={() => setMobileFilters(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
        <input
          value={search}
          onChange={(e) => updateParam('search', e.target.value)}
          placeholder="Search catalog"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm outline-none ring-brand-200 focus:bg-white focus:ring-2"
        />
        {suggestions.length ? (
          <div className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.id}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
                onClick={() => updateParam('search', s.name)}
              >
                <span>{s.name}</span>
                <span className="text-xs text-slate-400">₹{Number(s.sale_price).toFixed(0)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
        <select
          value={categoryId}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            if (!e.target.value) {
              next.delete('categoryId');
              next.delete('slug');
            } else {
              next.set('categoryId', e.target.value);
              next.delete('slug');
            }
            next.delete('page');
            setSearchParams(next);
          }}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-200"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Min price</label>
          <input
            value={minPrice}
            onChange={(e) => updateParam('minPrice', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Max price</label>
          <input
            value={maxPrice}
            onChange={(e) => updateParam('maxPrice', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Min BV</label>
          <input
            value={minBv}
            onChange={(e) => updateParam('minBv', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Max BV</label>
          <input
            value={maxBv}
            onChange={(e) => updateParam('maxBv', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm"
            inputMode="decimal"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</label>
        <select
          value={sort}
          onChange={(e) => updateParam('sort', e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-200"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name_asc">Name A–Z</option>
          <option value="bv_desc">BV: high to low</option>
          <option value="discount">Highest discount</option>
        </select>
      </div>
    </aside>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Shop</h1>
          <p className="mt-2 text-sm text-slate-500">Filter by category, price, BV, and sort — same powerful catalog tools.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm md:hidden"
          onClick={() => setMobileFilters(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clearCategory}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            !categoryId ? 'bg-brand-700 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-300'
          }`}
        >
          All
        </button>
        {STOREFRONT_CATEGORIES.map((c) => {
          const row = categories.find((x) => x.slug === c.slug);
          const active = row && categoryId === String(row.id);
          const to = row ? `/products?categoryId=${row.id}` : `/products?slug=${c.slug}`;
          return (
            <Link
              key={c.slug}
              to={to}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? 'bg-brand-700 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-300'
              }`}
            >
              {c.name}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        <span>
          {loading ? 'Loading…' : `${products.length} product${products.length === 1 ? '' : 's'} on this page`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sort</span>
          <select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="name_asc">Name A–Z</option>
            <option value="bv_desc">BV</option>
            <option value="discount">Discount</option>
          </select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
        <div className="hidden lg:block">{filterAside}</div>

        {mobileFilters ? (
          <div className="fixed inset-0 z-[90] md:hidden">
            <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={() => setMobileFilters(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
              <div className="p-4">{filterAside}</div>
            </div>
          </div>
        ) : null}

        <div className="space-y-8">
          {loading ? (
            <SkeletonGrid />
          ) : products.length ? (
            <StaggerGrid className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" stagger={0.04}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </StaggerGrid>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
              <p className="text-lg font-semibold text-slate-800">No products match</p>
              <p className="mt-2 max-w-md text-sm text-slate-500">Try clearing filters or exploring another category.</p>
              <button
                type="button"
                onClick={clearCategory}
                className="mt-6 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Reset category
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-6">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateParam('page', String(page - 1))}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => updateParam('page', String(page + 1))}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
