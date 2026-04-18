/**
 * Phase 1 seed: roles, demo users, brands, categories, products.
 * Run: npm run seed (from backend/)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initDB, pool, execute, query } from './db/mysql.js';

async function roleId(slug: string) {
  const rows = await query<{ id: number }[]>('SELECT id FROM roles WHERE slug = :slug LIMIT 1', { slug });
  return rows[0]?.id;
}

async function upsertUser(email: string, name: string, password: string, roleSlug: string) {
  const rid = await roleId(roleSlug);
  if (!rid) throw new Error(`Role ${roleSlug} missing after schema bootstrap`);

  const existing = await query<{ id: number }[]>('SELECT id FROM users WHERE email = :email LIMIT 1', { email });
  const hash = await bcrypt.hash(password, 10);
  if (existing[0]) {
    await execute('UPDATE users SET password_hash = :hash, role_id = :rid, name = :name WHERE id = :id', {
      hash,
      rid,
      name,
      id: existing[0].id
    });
    await execute(
      `INSERT IGNORE INTO binary_carry (user_id, left_profit_carry, right_profit_carry) VALUES (:uid, 0, 0)`,
      { uid: existing[0].id }
    );
    return existing[0].id;
  }
  const res = await execute(
    `INSERT INTO users (role_id, email, password_hash, name, phone, is_active)
     VALUES (:rid, :email, :hash, :name, NULL, 1)`,
    { rid, email, hash, name }
  );
  const newId = Number(res.insertId);
  await execute(
    `INSERT IGNORE INTO binary_carry (user_id, left_profit_carry, right_profit_carry) VALUES (:uid, 0, 0)`,
    { uid: newId }
  );
  return newId;
}

async function ensureBrand(name: string, slug: string) {
  const rows = await query<{ id: number }[]>('SELECT id FROM brands WHERE slug = :slug LIMIT 1', { slug });
  if (rows[0]) {
    await execute(
      `UPDATE brands
       SET name = :name, logo_url = NULL, is_active = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      { id: rows[0].id, name }
    );
    return rows[0].id;
  }

  const res = await execute(
    `INSERT INTO brands (name, slug, logo_url, is_active) VALUES (:name, :slug, NULL, 1)`,
    { name, slug }
  );
  return Number(res.insertId);
}

async function ensureCategory(input: {
  name: string;
  slug: string;
  parentSlug?: string;
  sortOrder: number;
  description?: string;
}) {
  const existing = await query<{ id: number }[]>('SELECT id FROM categories WHERE slug = :slug LIMIT 1', {
    slug: input.slug
  });

  let parentId: number | null = null;
  if (input.parentSlug) {
    const parentRows = await query<{ id: number }[]>('SELECT id FROM categories WHERE slug = :slug LIMIT 1', {
      slug: input.parentSlug
    });
    parentId = parentRows[0]?.id ?? null;
  }

  if (existing[0]) {
    await execute(
      `UPDATE categories
       SET parent_id = :parentId,
           name = :name,
           description = :description,
           image_url = NULL,
           meta_title = :metaTitle,
           meta_description = :metaDescription,
           sort_order = :sortOrder,
           is_active = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        id: existing[0].id,
        parentId,
        name: input.name,
        description: input.description ?? null,
        metaTitle: `${input.name} | Vivan`,
        metaDescription: `Shop ${input.name} on Vivan.`,
        sortOrder: input.sortOrder
      }
    );
    return existing[0].id;
  }

  const res = await execute(
    `INSERT INTO categories (parent_id, name, slug, description, image_url, meta_title, meta_description, sort_order, is_active)
     VALUES (:parentId, :name, :slug, :description, NULL, :metaTitle, :metaDescription, :sortOrder, 1)`,
    {
      parentId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      metaTitle: `${input.name} | Vivan`,
      metaDescription: `Shop ${input.name} on Vivan.`,
      sortOrder: input.sortOrder
    }
  );
  return Number(res.insertId);
}

async function ensureProduct(row: {
  categorySlug: string;
  brandSlug?: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  mrp: number;
  sale: number;
  bv: number;
  pv: number;
  gstRate: number;
  stock: number;
  image: string;
  featured?: boolean;
  newArrival?: boolean;
  bestseller?: boolean;
}) {
  const existing = await query<{ id: number }[]>('SELECT id FROM products WHERE slug = :slug LIMIT 1', { slug: row.slug });
  const cat = await query<{ id: number }[]>('SELECT id FROM categories WHERE slug = :slug LIMIT 1', { slug: row.categorySlug });
  const categoryId = cat[0]?.id ?? null;

  let brandId: number | null = null;
  if (row.brandSlug) {
    const b = await query<{ id: number }[]>('SELECT id FROM brands WHERE slug = :slug LIMIT 1', { slug: row.brandSlug });
    brandId = b[0]?.id ?? null;
  }

  const payload = {
    categoryId,
    brandId,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    shortDescription: row.shortDescription,
    longDescription: `Original Vivan catalog copy for ${row.name}. Ingredients, usage, and compliance details belong here.`,
    mrp: row.mrp,
    sale: row.sale,
    bv: row.bv,
    pv: row.pv,
    gstRate: row.gstRate,
    stock: row.stock,
    image: row.image,
    featured: row.featured ? 1 : 0,
    newArrival: row.newArrival ? 1 : 0,
    bestseller: row.bestseller ? 1 : 0
  };

  if (existing[0]) {
    await execute(
      `UPDATE products
       SET category_id = :categoryId,
           brand_id = :brandId,
           name = :name,
           sku = :sku,
           short_description = :shortDescription,
           long_description = :longDescription,
           mrp_price = :mrp,
           sale_price = :sale,
           bv = :bv,
           pv = :pv,
           gst_rate = :gstRate,
           stock_qty = :stock,
           image_url = :image,
           gallery_json = NULL,
           is_active = 1,
           is_featured = :featured,
           is_new_arrival = :newArrival,
           is_bestseller = :bestseller,
           deleted_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        ...payload,
        id: existing[0].id
      }
    );
    return existing[0].id;
  }

  const res = await execute(
    `INSERT INTO products (
      category_id, brand_id, name, slug, sku, short_description, long_description,
      mrp_price, sale_price, bv, pv, gst_rate, stock_qty, image_url, gallery_json,
      is_active, is_featured, is_new_arrival, is_bestseller
    ) VALUES (
      :categoryId, :brandId, :name, :slug, :sku, :shortDescription, :longDescription,
      :mrp, :sale, :bv, :pv, :gstRate, :stock, :image, NULL,
      1, :featured, :newArrival, :bestseller
    )`,
    payload
  );
  return Number(res.insertId);
}

async function main() {
  await initDB();

  await upsertUser('admin@vivan.local', 'Vivan Admin', 'Admin123!', 'admin');
  await upsertUser('member@vivan.local', 'Vivan Member', 'Member123!', 'customer');

  await ensureBrand('VivCare Labs', 'vivcare-labs');
  await ensureBrand('PureHarvest', 'pureharvest');

  await ensureCategory({
    name: 'Beauty',
    slug: 'beauty',
    sortOrder: 1,
    description: 'Skincare, makeup, and beauty essentials.'
  });
  await ensureCategory({
    name: 'Fashion',
    slug: 'fashion',
    sortOrder: 2,
    description: 'Apparel and accessories for every season.'
  });
  await ensureCategory({
    name: 'Electronics',
    slug: 'electronics',
    sortOrder: 3,
    description: 'Gadgets, audio, and smart everyday tech.'
  });
  await ensureCategory({
    name: 'Home Care',
    slug: 'home-care',
    sortOrder: 4,
    description: 'Cleaning, fragrance, and home essentials.'
  });
  await ensureCategory({
    name: 'Personal Care',
    slug: 'personal-care',
    sortOrder: 5,
    description: 'Hair, bath, and daily hygiene favorites.'
  });

  await execute(
    `UPDATE categories SET is_active = 1, parent_id = NULL
     WHERE slug IN ('beauty','fashion','electronics','home-care','personal-care')`
  );
  await execute(
    `UPDATE categories SET is_active = 0
     WHERE slug NOT IN ('beauty','fashion','electronics','home-care','personal-care')`
  );

  await ensureProduct({
    categorySlug: 'personal-care',
    brandSlug: 'vivcare-labs',
    name: 'Aurum Daily Serum',
    slug: 'aurum-daily-serum',
    sku: 'VIV-PCS-001',
    shortDescription: 'Lightweight hydration with botanical extracts.',
    mrp: 1299,
    sale: 999,
    bv: 45,
    pv: 30,
    gstRate: 18,
    stock: 120,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80',
    featured: true,
    newArrival: true
  });

  await ensureProduct({
    categorySlug: 'beauty',
    brandSlug: 'vivcare-labs',
    name: 'Lumiere Tinted Moisturizer SPF 30',
    slug: 'lumiere-tinted-moisturizer',
    sku: 'VIV-BTY-002',
    shortDescription: 'Sheer coverage with a dewy, skin-first finish.',
    mrp: 1499,
    sale: 1199,
    bv: 50,
    pv: 35,
    gstRate: 18,
    stock: 90,
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80',
    featured: true,
    bestseller: true
  });

  await ensureProduct({
    categorySlug: 'fashion',
    brandSlug: 'pureharvest',
    name: 'Meridian Linen Shirt',
    slug: 'meridian-linen-shirt',
    sku: 'VIV-FAS-010',
    shortDescription: 'Breathable weave with a tailored relaxed fit.',
    mrp: 2499,
    sale: 1999,
    bv: 65,
    pv: 48,
    gstRate: 12,
    stock: 60,
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80',
    bestseller: true,
    newArrival: true
  });

  await ensureProduct({
    categorySlug: 'electronics',
    brandSlug: 'vivcare-labs',
    name: 'Pulse Wireless Earbuds',
    slug: 'pulse-wireless-earbuds',
    sku: 'VIV-ELC-021',
    shortDescription: 'ANC-ready drivers with all-day battery life.',
    mrp: 4999,
    sale: 3999,
    bv: 120,
    pv: 90,
    gstRate: 18,
    stock: 75,
    image: 'https://images.unsplash.com/photo-1590658260037-6b121765e1a1?w=800&q=80',
    featured: true,
    newArrival: true
  });

  await ensureProduct({
    categorySlug: 'electronics',
    brandSlug: 'pureharvest',
    name: 'Nimbus Portable Charger 20K',
    slug: 'nimbus-portable-charger',
    sku: 'VIV-ELC-033',
    shortDescription: 'USB-C PD fast charge for phones and tablets.',
    mrp: 2999,
    sale: 2199,
    bv: 75,
    pv: 55,
    gstRate: 18,
    stock: 140,
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&q=80',
    bestseller: true
  });

  await ensureProduct({
    categorySlug: 'home-care',
    brandSlug: 'vivcare-labs',
    name: 'Nocturne Room Mist',
    slug: 'nocturne-room-mist',
    sku: 'VIV-HOM-009',
    shortDescription: 'Soft cedar and citrus for evening wind-down.',
    mrp: 649,
    sale: 549,
    bv: 18,
    pv: 14,
    gstRate: 18,
    stock: 150,
    image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&q=80',
    featured: true
  });

  await ensureProduct({
    categorySlug: 'personal-care',
    brandSlug: 'pureharvest',
    name: 'SilkRestore Hair Mask',
    slug: 'silkrestore-hair-mask',
    sku: 'VIV-PC-044',
    shortDescription: 'Weekly deep treatment for frizz-prone hair.',
    mrp: 799,
    sale: 649,
    bv: 24,
    pv: 18,
    gstRate: 18,
    stock: 200,
    image: 'https://images.unsplash.com/photo-1526947425960-945c224e4884?w=800&q=80',
    newArrival: true,
    bestseller: true
  });

  await ensureProduct({
    categorySlug: 'fashion',
    brandSlug: 'vivcare-labs',
    name: 'Stride Everyday Sneaker',
    slug: 'stride-everyday-sneaker',
    sku: 'VIV-FAS-055',
    shortDescription: 'Cushioned sole with premium knit upper.',
    mrp: 4299,
    sale: 3499,
    bv: 95,
    pv: 70,
    gstRate: 18,
    stock: 55,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
    featured: true
  });

  const allowedCats = await query<{ id: number; slug: string }[]>(
    `SELECT id, slug FROM categories
     WHERE slug IN ('beauty','fashion','electronics','home-care','personal-care') AND is_active = 1`
  );
  const beautyRow = allowedCats.find((r) => r.slug === 'beauty');
  const allowedIds = allowedCats.map((r) => r.id);
  if (beautyRow && allowedIds.length) {
    const ph = allowedIds.map(() => '?').join(',');
    await pool.execute(
      `UPDATE products SET category_id = ? WHERE category_id IS NULL OR category_id NOT IN (${ph})`,
      [beautyRow.id, ...allowedIds]
    );
  }

  await execute(`INSERT IGNORE INTO compensation_settings (id) VALUES (1)`);

  console.log('Seed complete.');
  console.log('Admin: admin@vivan.local / Admin123!');
  console.log('Member: member@vivan.local / Member123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
