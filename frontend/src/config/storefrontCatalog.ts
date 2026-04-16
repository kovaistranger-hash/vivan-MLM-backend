/** Must match backend `STOREFRONT_CATEGORY_SLUGS` ordering. */
export const STOREFRONT_CATEGORY_ORDER = [
  'beauty',
  'fashion',
  'electronics',
  'home-care',
  'personal-care'
] as const;

export type StorefrontCategorySlug = (typeof STOREFRONT_CATEGORY_ORDER)[number];

export type StorefrontCategoryDisplay = {
  slug: StorefrontCategorySlug;
  name: string;
  tagline: string;
  image: string;
};

export const STOREFRONT_CATEGORIES: StorefrontCategoryDisplay[] = [
  {
    slug: 'beauty',
    name: 'Beauty',
    tagline: 'Skincare & glam',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80'
  },
  {
    slug: 'fashion',
    name: 'Fashion',
    tagline: 'Style that fits',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80'
  },
  {
    slug: 'electronics',
    name: 'Electronics',
    tagline: 'Smart picks',
    image: 'https://images.unsplash.com/photo-1498049794561-77880e28766a?w=900&q=80'
  },
  {
    slug: 'home-care',
    name: 'Home Care',
    tagline: 'Fresh spaces',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=900&q=80'
  },
  {
    slug: 'personal-care',
    name: 'Personal Care',
    tagline: 'Daily rituals',
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&q=80'
  }
];

export function filterStorefrontCategories<T extends { slug: string; id: number }>(rows: T[]): T[] {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const out: T[] = [];
  for (const slug of STOREFRONT_CATEGORY_ORDER) {
    const row = bySlug.get(slug);
    if (row) out.push(row);
  }
  return out;
}
