import { query } from '../../db/mysql.js';

function truthyFlag(v?: string) {
  return v === '1' || v === 'true';
}

function publicCategoryVisibilityClause(alias = 'p') {
  return `(
    ${alias}.category_id IS NULL
    OR EXISTS (
      SELECT 1 FROM categories _cat
      WHERE _cat.id = ${alias}.category_id AND _cat.is_active = 1
    )
  )`;
}

export async function listProducts(params: {
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  minBv?: number;
  maxBv?: number;
  featured?: string;
  newArrival?: string;
  bestseller?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  const where: string[] = ['p.is_active = 1', 'p.deleted_at IS NULL'];
  where.push(publicCategoryVisibilityClause('p'));
  const values: Record<string, unknown> = {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0
  };

  if (params.search) {
    where.push('(p.name LIKE :search OR p.short_description LIKE :search OR p.sku LIKE :search)');
    values.search = `%${params.search}%`;
  }
  if (params.categoryId) {
    where.push('p.category_id = :categoryId');
    values.categoryId = params.categoryId;
  }
  if (typeof params.minPrice === 'number') {
    where.push('p.sale_price >= :minPrice');
    values.minPrice = params.minPrice;
  }
  if (typeof params.maxPrice === 'number') {
    where.push('p.sale_price <= :maxPrice');
    values.maxPrice = params.maxPrice;
  }
  if (typeof params.minBv === 'number') {
    where.push('p.bv >= :minBv');
    values.minBv = params.minBv;
  }
  if (typeof params.maxBv === 'number') {
    where.push('p.bv <= :maxBv');
    values.maxBv = params.maxBv;
  }
  if (truthyFlag(params.featured)) {
    where.push('p.is_featured = 1');
  }
  if (truthyFlag(params.newArrival)) {
    where.push('p.is_new_arrival = 1');
  }
  if (truthyFlag(params.bestseller)) {
    where.push('p.is_bestseller = 1');
  }

  const orderByMap: Record<string, string> = {
    newest: 'p.id DESC',
    price_asc: 'p.sale_price ASC',
    price_desc: 'p.sale_price DESC',
    name_asc: 'p.name ASC',
    bv_desc: 'p.bv DESC',
    discount: '(p.mrp_price - p.sale_price) DESC'
  };
  const orderBy = orderByMap[params.sort || 'newest'] || orderByMap.newest;

  const sql = `
    SELECT p.*, c.name AS category_name, b.name AS brand_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT :limit OFFSET :offset
  `;

  const items = await query<any[]>(sql, values);

  const countSql = `
    SELECT COUNT(*) AS total
    FROM products p
    WHERE ${where.join(' AND ')}
  `;
  const { limit, offset, ...countValues } = values;
  const countRows = await query<{ total: number }[]>(countSql, countValues);
  const total = Number(countRows[0]?.total || 0);

  return { items, total };
}

export async function autocompleteProducts(q: string, limit = 8) {
  if (!q.trim()) return [];
  return query<any[]>(
    `SELECT p.id, p.name, p.slug, p.sale_price, p.mrp_price, p.image_url
     FROM products p
     WHERE p.is_active = 1 AND p.deleted_at IS NULL AND ${publicCategoryVisibilityClause('p')} AND (p.name LIKE :q OR p.sku LIKE :q)
     ORDER BY p.name ASC
     LIMIT :limit`,
    { q: `%${q}%`, limit }
  );
}

export async function getProductBySlug(slug: string) {
  const rows = await query<any[]>(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.slug = :slug AND p.is_active = 1 AND p.deleted_at IS NULL
     LIMIT 1`,
    { slug }
  );
  const product = rows[0] || null;
  if (!product) return null;

  const reviews = await query<any[]>(
    `SELECT r.id, r.rating, r.title, r.body, r.created_at, u.name AS author_name
     FROM product_reviews r
     INNER JOIN users u ON u.id = r.user_id
     WHERE r.product_id = :productId AND r.is_approved = 1
     ORDER BY r.created_at DESC
     LIMIT 50`,
    { productId: product.id }
  );

  const summary = await query<{ avg_rating: string | null; review_count: number }[]>(
    `SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count
     FROM product_reviews
     WHERE product_id = :productId AND is_approved = 1`,
    { productId: product.id }
  );

  const related = await query<any[]>(
    `SELECT p.id, p.name, p.slug, p.sale_price, p.mrp_price, p.image_url, p.bv, p.pv
     FROM products p
     WHERE p.is_active = 1 AND p.deleted_at IS NULL AND ${publicCategoryVisibilityClause('p')}
       AND p.category_id = :categoryId AND p.id <> :productId
     ORDER BY p.is_bestseller DESC, p.id DESC
     LIMIT 6`,
    { categoryId: product.category_id, productId: product.id }
  );

  return {
    ...product,
    reviews,
    reviewSummary: {
      average: summary[0]?.avg_rating ? Number(summary[0].avg_rating) : null,
      count: Number(summary[0]?.review_count || 0)
    },
    relatedProducts: related
  };
}
