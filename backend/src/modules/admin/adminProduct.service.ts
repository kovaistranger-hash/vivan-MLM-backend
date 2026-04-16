import { execute, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  ensureUniqueSku,
  ensureUniqueSlug,
  generateSku,
  nextSkuSequenceForCategoryCode,
  resolveCategoryCodeForSku,
  slugifyName
} from './productIdentifiers.js';

const LOW_STOCK_THRESHOLD = 10;

export type AdminProductPayload = {
  category_id?: number | null;
  brand_id?: number | null;
  name: string;
  slug: string;
  sku?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  mrp_price: number;
  sale_price: number;
  bv: number;
  pv: number;
  gst_rate: number;
  stock_qty: number;
  image_url?: string | null;
  gallery_json?: unknown[] | null;
  is_active: boolean;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_bestseller: boolean;
};

export async function adminListProducts(params: {
  search?: string;
  page: number;
  pageSize: number;
  includeDeleted?: boolean;
  categoryId?: number;
  isActive?: 'all' | '1' | '0';
  lowStockOnly?: boolean;
}) {
  const where: string[] = ['1=1'];
  const values: Record<string, unknown> = {
    limit: params.pageSize,
    offset: (params.page - 1) * params.pageSize
  };
  if (!params.includeDeleted) where.push('p.deleted_at IS NULL');
  if (params.search) {
    where.push('(p.name LIKE :search OR p.sku LIKE :search OR p.slug LIKE :search)');
    values.search = `%${params.search}%`;
  }
  if (params.categoryId) {
    where.push('p.category_id = :categoryId');
    values.categoryId = params.categoryId;
  }
  if (params.isActive && params.isActive !== 'all') {
    where.push('p.is_active = :isActive');
    values.isActive = params.isActive === '1' ? 1 : 0;
  }
  if (params.lowStockOnly) {
    where.push('p.stock_qty < :lowStockT');
    values.lowStockT = LOW_STOCK_THRESHOLD;
  }
  const sql = `
    SELECT p.*, c.name AS category_name, b.name AS brand_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.id DESC
    LIMIT :limit OFFSET :offset
  `;
  const items = await query<any[]>(sql, values);
  const { limit, offset, ...countVals } = values;
  const countRows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM products p WHERE ${where.join(' AND ')}`,
    countVals
  );
  const total = Number(countRows[0]?.total || 0);
  return { items, total, lowStockThreshold: LOW_STOCK_THRESHOLD };
}

export async function adminGetProduct(id: number) {
  const rows = await query<any[]>(
    `SELECT p.*, c.name AS category_name, b.name AS brand_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

export async function adminSuggestProductIdentifiers(input: {
  name?: string;
  categoryId?: number;
  excludeProductId?: number;
}) {
  const name = input.name?.trim() ?? '';
  const suggestedSlug = name ? await ensureUniqueSlug(slugifyName(name), input.excludeProductId) : '';

  const code = await resolveCategoryCodeForSku(input.categoryId ?? null);
  const seq = await nextSkuSequenceForCategoryCode(code, input.excludeProductId);
  const suggestedSku = generateSku({ categoryCode: code, existingCount: seq });

  return { suggestedSlug, suggestedSku };
}

function galleryToDb(v: unknown[] | null | undefined) {
  if (!v || !v.length) return null;
  return JSON.stringify(v);
}

export async function adminCreateProduct(input: AdminProductPayload) {
  const slug = await ensureUniqueSlug(input.slug);
  const sku = await ensureUniqueSku(input.sku ?? null);
  const res = await execute(
    `INSERT INTO products (
      category_id, brand_id, name, slug, sku, short_description, long_description,
      mrp_price, sale_price, bv, pv, gst_rate, stock_qty, image_url, gallery_json,
      is_active, is_featured, is_new_arrival, is_bestseller
    ) VALUES (
      :categoryId, :brandId, :name, :slug, :sku, :shortDescription, :longDescription,
      :mrpPrice, :salePrice, :bv, :pv, :gstRate, :stockQty, :imageUrl, :galleryJson,
      :isActive, :isFeatured, :isNewArrival, :isBestseller
    )`,
    {
      categoryId: input.category_id ?? null,
      brandId: input.brand_id ?? null,
      name: input.name,
      slug,
      sku,
      shortDescription: input.short_description ?? null,
      longDescription: input.long_description ?? null,
      mrpPrice: input.mrp_price,
      salePrice: input.sale_price,
      bv: input.bv,
      pv: input.pv,
      gstRate: input.gst_rate,
      stockQty: input.stock_qty,
      imageUrl: input.image_url || null,
      galleryJson: galleryToDb(input.gallery_json ?? null),
      isActive: input.is_active ? 1 : 0,
      isFeatured: input.is_featured ? 1 : 0,
      isNewArrival: input.is_new_arrival ? 1 : 0,
      isBestseller: input.is_bestseller ? 1 : 0
    }
  );
  return Number(res.insertId);
}

export async function adminUpdateProduct(id: number, input: AdminProductPayload) {
  const existing = await adminGetProduct(id);
  if (!existing) throw new ApiError(404, 'Product not found');
  if (existing.deleted_at) throw new ApiError(400, 'Product is archived');

  const slug = await ensureUniqueSlug(input.slug, id);
  const sku = await ensureUniqueSku(input.sku ?? null, id);

  await execute(
    `UPDATE products SET
      category_id = :categoryId,
      brand_id = :brandId,
      name = :name,
      slug = :slug,
      sku = :sku,
      short_description = :shortDescription,
      long_description = :longDescription,
      mrp_price = :mrpPrice,
      sale_price = :salePrice,
      bv = :bv,
      pv = :pv,
      gst_rate = :gstRate,
      stock_qty = :stockQty,
      image_url = :imageUrl,
      gallery_json = :galleryJson,
      is_active = :isActive,
      is_featured = :isFeatured,
      is_new_arrival = :isNewArrival,
      is_bestseller = :isBestseller,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = :id`,
    {
      id,
      categoryId: input.category_id ?? null,
      brandId: input.brand_id ?? null,
      name: input.name,
      slug,
      sku,
      shortDescription: input.short_description ?? null,
      longDescription: input.long_description ?? null,
      mrpPrice: input.mrp_price,
      salePrice: input.sale_price,
      bv: input.bv,
      pv: input.pv,
      gstRate: input.gst_rate,
      stockQty: input.stock_qty,
      imageUrl: input.image_url || null,
      galleryJson: galleryToDb(input.gallery_json ?? null),
      isActive: input.is_active ? 1 : 0,
      isFeatured: input.is_featured ? 1 : 0,
      isNewArrival: input.is_new_arrival ? 1 : 0,
      isBestseller: input.is_bestseller ? 1 : 0
    }
  );
}

export async function adminSoftDeleteProduct(id: number) {
  const existing = await adminGetProduct(id);
  if (!existing) throw new ApiError(404, 'Product not found');
  if (existing.deleted_at) return;
  const newSlug = `${String(existing.slug).slice(0, 120)}-d-${id}`;
  await execute('UPDATE products SET deleted_at = NOW(), slug = :slug, is_active = 0 WHERE id = :id', { slug: newSlug, id });
  await execute('DELETE FROM cart_items WHERE product_id = :id', { id });
}

export async function adminLowStockCount() {
  const rows = await query<{ c: number }[]>(
    `SELECT COUNT(*) AS c FROM products WHERE deleted_at IS NULL AND is_active = 1 AND stock_qty < :t`,
    { t: LOW_STOCK_THRESHOLD }
  );
  return Number(rows[0]?.c || 0);
}

export async function adminPatchProductFlags(
  id: number,
  flags: { is_active?: boolean; is_featured?: boolean; is_new_arrival?: boolean; is_bestseller?: boolean }
) {
  const existing = await adminGetProduct(id);
  if (!existing) throw new ApiError(404, 'Product not found');
  if (existing.deleted_at) throw new ApiError(400, 'Product is archived');

  const sets: string[] = [];
  const vals: Record<string, unknown> = { id };

  if (flags.is_active !== undefined) {
    sets.push('is_active = :isActive');
    vals.isActive = flags.is_active ? 1 : 0;
  }
  if (flags.is_featured !== undefined) {
    sets.push('is_featured = :isFeatured');
    vals.isFeatured = flags.is_featured ? 1 : 0;
  }
  if (flags.is_new_arrival !== undefined) {
    sets.push('is_new_arrival = :isNew');
    vals.isNew = flags.is_new_arrival ? 1 : 0;
  }
  if (flags.is_bestseller !== undefined) {
    sets.push('is_bestseller = :isBest');
    vals.isBest = flags.is_bestseller ? 1 : 0;
  }
  if (!sets.length) return;

  await execute(`UPDATE products SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = :id`, vals);
}
