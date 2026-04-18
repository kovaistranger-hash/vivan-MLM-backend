import { execute, query } from "../../db/db.js";

export type ProductStatus = "draft" | "active" | "inactive";

export type ProductRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  sku: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  image_url: string | null;
  gallery_urls: string | null;
  price: number;
  mrp: number;
  stock: number;
  status: ProductStatus;
  is_featured: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
};

export type ProductInput = {
  name?: string;
  description?: string;
  short_description?: string;
  sku?: string | null;
  category?: string;
  subcategory?: string;
  brand?: string;
  image_url?: string | null;
  gallery_urls?: string[];
  price?: number;
  mrp?: number;
  stock?: number;
  status?: ProductStatus;
  is_featured?: boolean;
};

export async function initProductTables() {
  await execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(220) NOT NULL UNIQUE,
      description TEXT NULL,
      short_description VARCHAR(500) NULL,
      sku VARCHAR(100) NULL,
      category VARCHAR(100) NULL,
      subcategory VARCHAR(100) NULL,
      brand VARCHAR(100) NULL,
      image_url VARCHAR(500) NULL,
      gallery_urls JSON NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      mrp DECIMAL(10,2) NOT NULL DEFAULT 0,
      stock INT NOT NULL DEFAULT 0,
      status ENUM('draft', 'active', 'inactive') NOT NULL DEFAULT 'active',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      created_by INT NULL,
      updated_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_products_category (category),
      INDEX idx_products_status (status),
      INDEX idx_products_featured (is_featured),
      INDEX idx_products_name (name),
      INDEX idx_products_slug (slug)
    )
  `);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function makeUniqueSlug(name: string, excludeId?: number): Promise<string> {
  const baseSlug = slugify(name);
  let slug = baseSlug || `product-${Date.now()}`;
  let counter = 1;

  while (true) {
    const params: unknown[] = [slug];
    let sql = `SELECT id FROM products WHERE slug = ? LIMIT 1`;

    if (excludeId) {
      sql = `SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1`;
      params.push(excludeId);
    }

    const rows = await query<{ id: number }[]>(sql, params);

    if (!rows.length) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

type CreateProductInput = {
  name: string;
  description: string;
  short_description: string;
  sku: string | null;
  category: string;
  subcategory: string;
  brand: string;
  image_url: string | null;
  gallery_urls: string[];
  price: number;
  mrp: number;
  stock: number;
  status: ProductStatus;
  is_featured: boolean;
};

export async function createProduct(input: CreateProductInput, userId?: number) {
  const slug = await makeUniqueSlug(input.name);

  const result = await execute(
    `INSERT INTO products (
      name, slug, description, short_description, sku, category, subcategory, brand,
      image_url, gallery_urls, price, mrp, stock, status, is_featured, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      slug,
      input.description || null,
      input.short_description || null,
      input.sku || null,
      input.category || null,
      input.subcategory || null,
      input.brand || null,
      input.image_url || null,
      JSON.stringify(input.gallery_urls || []),
      input.price,
      input.mrp,
      input.stock,
      input.status,
      input.is_featured ? 1 : 0,
      userId ?? null,
      userId ?? null
    ]
  );

  const row = await findProductById(Number(result.insertId));
  return row ? mapProductResponse(row) : null;
}

export async function updateProduct(id: number, input: ProductInput, userId?: number) {
  const existing = await findProductById(id);
  if (!existing) return null;

  const nextName = input.name ?? existing.name;
  const nextSlug = input.name ? await makeUniqueSlug(input.name, id) : existing.slug;

  await execute(
    `UPDATE products
     SET
       name = ?,
       slug = ?,
       description = ?,
       short_description = ?,
       sku = ?,
       category = ?,
       subcategory = ?,
       brand = ?,
       image_url = ?,
       gallery_urls = ?,
       price = ?,
       mrp = ?,
       stock = ?,
       status = ?,
       is_featured = ?,
       updated_by = ?
     WHERE id = ?`,
    [
      nextName,
      nextSlug,
      input.description ?? existing.description,
      input.short_description ?? existing.short_description,
      input.sku ?? existing.sku,
      input.category ?? existing.category,
      input.subcategory ?? existing.subcategory,
      input.brand ?? existing.brand,
      input.image_url ?? existing.image_url,
      JSON.stringify(input.gallery_urls ?? safeJsonArray(existing.gallery_urls)),
      input.price ?? Number(existing.price),
      input.mrp ?? Number(existing.mrp),
      input.stock ?? existing.stock,
      input.status ?? existing.status,
      input.is_featured !== undefined ? (input.is_featured ? 1 : 0) : existing.is_featured,
      userId ?? null,
      id
    ]
  );

  const updated = await findProductById(id);
  return updated ? mapProductResponse(updated) : null;
}

export async function deleteProduct(id: number) {
  const result = await execute(`DELETE FROM products WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

export async function findProductById(id: number) {
  const rows = await query<ProductRow[]>(
    `SELECT *
     FROM products
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

export async function findProductBySlug(slug: string) {
  const rows = await query<ProductRow[]>(
    `SELECT *
     FROM products
     WHERE slug = ?
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

export async function listProducts(params: {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  status?: ProductStatus;
  featured?: boolean;
  includeInactive?: boolean;
}) {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.search) {
    where.push(`(name LIKE ? OR category LIKE ? OR brand LIKE ? OR sku LIKE ?)`);
    const searchLike = `%${params.search}%`;
    values.push(searchLike, searchLike, searchLike, searchLike);
  }

  if (params.category) {
    where.push(`category = ?`);
    values.push(params.category);
  }

  if (params.featured !== undefined) {
    where.push(`is_featured = ?`);
    values.push(params.featured ? 1 : 0);
  }

  if (params.status) {
    where.push(`status = ?`);
    values.push(params.status);
  } else if (!params.includeInactive) {
    where.push(`status = 'active'`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM products ${whereClause}`,
    values
  );

  const total = Number(countRows[0]?.total) || 0;
  const offset = (params.page - 1) * params.limit;

  const rows = await query<ProductRow[]>(
    `SELECT *
     FROM products
     ${whereClause}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...values, params.limit, offset]
  );

  return {
    items: rows.map(mapProductResponse),
    pagination: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit) || 1
    }
  };
}

export function mapProductResponse(product: ProductRow) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    short_description: product.short_description,
    sku: product.sku,
    category: product.category,
    subcategory: product.subcategory,
    brand: product.brand,
    image_url: product.image_url,
    gallery_urls: safeJsonArray(product.gallery_urls),
    price: Number(product.price),
    mrp: Number(product.mrp),
    stock: product.stock,
    status: product.status,
    is_featured: !!product.is_featured,
    created_by: product.created_by,
    updated_by: product.updated_by,
    created_at: product.created_at,
    updated_at: product.updated_at
  };
}

function safeJsonArray(value: string | null) {
  try {
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
