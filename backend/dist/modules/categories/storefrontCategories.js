/** Public storefront only surfaces these top-level categories (order preserved). */
export const STOREFRONT_CATEGORY_SLUGS = [
    'beauty',
    'fashion',
    'electronics',
    'home-care',
    'personal-care'
];
export function storefrontCategorySlugSqlList() {
    return STOREFRONT_CATEGORY_SLUGS.map((s) => `'${s}'`).join(', ');
}
