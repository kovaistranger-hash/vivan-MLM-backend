/** Public storefront only surfaces these top-level categories (order preserved). */
export const STOREFRONT_CATEGORY_SLUGS = [
  'beauty',
  'fashion',
  'electronics',
  'home-care',
  'personal-care'
] as const;

export type StorefrontCategorySlug = (typeof STOREFRONT_CATEGORY_SLUGS)[number];

export function storefrontCategorySlugSqlList(): string {
  return STOREFRONT_CATEGORY_SLUGS.map((s) => `'${s}'`).join(', ');
}
