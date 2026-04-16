import { query } from '../../db/mysql.js';

/** URL slug from product name: lowercase, hyphens, no specials, collapsed hyphens. */
export function slugifyName(name: string): string {
  let s = name.trim().toLowerCase();
  s = s.replace(/[\s_]+/g, '-');
  s = s.replace(/[^a-z0-9-]+/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

function normalizeCategoryCode(code: string): string {
  const c = (code || 'GEN').toUpperCase().replace(/[^A-Z]/g, '');
  return (c + 'GEN').slice(0, 3);
}

/** Build a Vivan SKU: VIV-{3-letter code}-{running number, min 3-digit padding up to 999}. */
export function generateSku(params: { categoryCode: string; existingCount: number }): string {
  const code = normalizeCategoryCode(params.categoryCode || 'GEN');
  const n = Math.max(1, Math.floor(Number(params.existingCount) || 1));
  const tail = n <= 999 ? String(n).padStart(3, '0') : String(n);
  return `VIV-${code}-${tail}`;
}

export function shortCodeFromCategorySlug(slug: string, name: string): string {
  const fromSlug = slug.replace(/-/g, '').replace(/[^a-z0-9]/gi, '');
  if (fromSlug.length >= 3) return fromSlug.slice(0, 3).toUpperCase();
  const fromName = name.replace(/[^a-z0-9]/gi, '');
  if (fromName.length >= 3) return fromName.slice(0, 3).toUpperCase();
  if (fromSlug.length > 0) return (fromSlug + 'XXX').slice(0, 3).toUpperCase();
  if (fromName.length > 0) return (fromName + 'XXX').slice(0, 3).toUpperCase();
  return 'GEN';
}

async function slugRowExists(slug: string, excludeProductId?: number): Promise<boolean> {
  const rows = excludeProductId
    ? await query<{ id: number }[]>(
        'SELECT id FROM products WHERE slug = :slug AND id <> :excludeId AND deleted_at IS NULL LIMIT 1',
        { slug, excludeId: excludeProductId }
      )
    : await query<{ id: number }[]>('SELECT id FROM products WHERE slug = :slug AND deleted_at IS NULL LIMIT 1', { slug });
  return rows.length > 0;
}

/** Resolves slug collisions by appending -2, -3, … (never -1). */
export async function ensureUniqueSlug(slug: string, productId?: number): Promise<string> {
  let base = slugifyName(slug);
  if (!base) base = 'product';

  if (!(await slugRowExists(base, productId))) return base;

  let n = 2;
  while (await slugRowExists(`${base}-${n}`, productId)) {
    n += 1;
  }
  return `${base}-${n}`;
}

async function skuRowExists(sku: string, excludeProductId?: number): Promise<boolean> {
  const rows = excludeProductId
    ? await query<{ id: number }[]>(
        'SELECT id FROM products WHERE sku = :sku AND id <> :excludeId AND deleted_at IS NULL LIMIT 1',
        { sku, excludeId: excludeProductId }
      )
    : await query<{ id: number }[]>('SELECT id FROM products WHERE sku = :sku AND deleted_at IS NULL LIMIT 1', { sku });
  return rows.length > 0;
}

/** If SKU ends with -digits, increment; otherwise append -2, then -3, … */
export function bumpSkuForUniqueness(prev: string): string {
  const m = prev.match(/^(.*-)(\d+)$/);
  if (m) {
    const next = BigInt(m[2]) + 1n;
    return `${m[1]}${next.toString()}`;
  }
  return `${prev}-2`;
}

export async function ensureUniqueSku(sku: string | null | undefined, productId?: number): Promise<string | null> {
  if (sku == null) return null;
  const trimmed = String(sku).trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  while (await skuRowExists(candidate, productId)) {
    candidate = bumpSkuForUniqueness(candidate);
  }
  return candidate;
}

export async function resolveCategoryCodeForSku(categoryId?: number | null): Promise<string> {
  if (!categoryId) return 'GEN';
  const rows = await query<{ slug: string; name: string }[]>(
    'SELECT slug, name FROM categories WHERE id = :id LIMIT 1',
    { id: categoryId }
  );
  const row = rows[0];
  if (!row) return 'GEN';
  return shortCodeFromCategorySlug(row.slug, row.name);
}

/** Next running number for VIV-{code}-* SKUs (optionally ignoring one product row). */
export async function nextSkuSequenceForCategoryCode(
  categoryCode: string,
  excludeProductId?: number
): Promise<number> {
  const code = normalizeCategoryCode(categoryCode);
  const pat = `VIV-${code}-%`;
  const sql = excludeProductId
    ? `SELECT sku FROM products WHERE deleted_at IS NULL AND sku IS NOT NULL AND sku LIKE :pat AND id <> :excludeId`
    : `SELECT sku FROM products WHERE deleted_at IS NULL AND sku IS NOT NULL AND sku LIKE :pat`;
  const rows = await query<{ sku: string }[]>(sql, excludeProductId ? { pat, excludeId: excludeProductId } : { pat });
  let max = 0;
  for (const r of rows) {
    const m = String(r.sku).match(/-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}
