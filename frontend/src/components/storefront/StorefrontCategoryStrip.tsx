import type { ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { api } from '../../services/api';
import { STOREFRONT_CATEGORIES } from '../../config/storefrontCatalog';

type ApiCat = { id: number; slug: string };

const STRIP_HIDDEN = new Set(['/login', '/register', '/checkout']);

const pillSpring = { type: 'spring' as const, stiffness: 420, damping: 34 };

function PillLink({
  to,
  active,
  children
}: {
  to: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link to={to} className="relative inline-flex rounded-full">
      {active ? (
        <motion.span
          layoutId="storefrontCategoryPill"
          className="absolute inset-0 rounded-full bg-indigo-600 shadow"
          transition={pillSpring}
        />
      ) : null}
      <span
        className={`relative z-10 inline-flex shrink-0 snap-start items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition ${
          active ? 'text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
        }`}
      >
        {children}
      </span>
    </Link>
  );
}

export default function StorefrontCategoryStrip() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const [apiCats, setApiCats] = useState<ApiCat[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/categories')
      .then((r) => {
        if (cancelled) return;
        const list = (r.data.categories || []) as { id: number; slug: string }[];
        setApiCats(list.map((c) => ({ id: c.id, slug: c.slug })));
      })
      .catch(() => {
        if (!cancelled) setApiCats([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slugFromQuery = searchParams.get('slug');
  const categoryId = searchParams.get('categoryId');
  const search = searchParams.get('search');

  const resolvedSlug = useMemo(() => {
    if (slugFromQuery) return slugFromQuery;
    if (categoryId && apiCats.length) {
      const id = Number(categoryId);
      return apiCats.find((c) => c.id === id)?.slug ?? null;
    }
    return null;
  }, [slugFromQuery, categoryId, apiCats]);

  const onProducts = pathname === '/products';

  const allActive =
    onProducts &&
    !slugFromQuery &&
    !categoryId &&
    !search &&
    !searchParams.get('minPrice') &&
    !searchParams.get('maxPrice') &&
    !searchParams.get('minBv') &&
    !searchParams.get('maxBv');

  const storefrontSlugs = new Set<string>(STOREFRONT_CATEGORIES.map((c) => c.slug));
  const categoryActive = (slug: string) =>
    onProducts && resolvedSlug === slug && storefrontSlugs.has(slug) && !search;

  if (STRIP_HIDDEN.has(pathname)) {
    return null;
  }

  return (
    <div className="w-full border-b border-gray-200 bg-gray-50">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Shop</span>

        <LayoutGroup>
          <div className="scrollbar-hide flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scroll-smooth whitespace-nowrap">
            <PillLink to="/products" active={!!allActive}>
              All
            </PillLink>
            {STOREFRONT_CATEGORIES.map((c) => {
              const row = apiCats.find((x) => x.slug === c.slug);
              const to = row ? `/products?categoryId=${row.id}` : `/products?slug=${c.slug}`;
              const active = categoryActive(c.slug);
              return (
                <PillLink key={c.slug} to={to} active={active}>
                  {c.name}
                </PillLink>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </div>
  );
}
