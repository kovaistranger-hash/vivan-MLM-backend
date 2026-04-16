import { z } from 'zod';

const MAX_PRODUCT_IMAGES = 5;

export const adminProductListQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  includeDeleted: z.enum(['1', '0', 'true', 'false']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  isActive: z.enum(['all', '1', '0']).optional(),
  lowStock: z.enum(['1', '0', 'true', 'false']).optional()
});

export const adminProductSuggestQuerySchema = z.object({
  name: z.string().trim().max(180).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional()
});

export const adminProductBodySchema = z
  .object({
    category_id: z.coerce.number().int().positive().nullable().optional(),
    brand_id: z.coerce.number().int().positive().nullable().optional(),
    name: z.string().trim().min(1).max(180),
    slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i),
    sku: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : String(v).trim()),
      z
        .string()
        .max(100)
        .regex(/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/, 'Use letters, numbers, and hyphens only (e.g. VIV-SUP-001)')
        .optional()
    ),
    short_description: z.string().trim().max(255).nullable().optional(),
    long_description: z.string().trim().max(20000).nullable().optional(),
    mrp_price: z.coerce.number().nonnegative(),
    sale_price: z.coerce.number().nonnegative(),
    bv: z.coerce.number().nonnegative(),
    pv: z.coerce.number().nonnegative(),
    gst_rate: z.coerce.number().min(0).max(100),
    stock_qty: z.coerce.number().int().min(0),
    image_url: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(512).nullable().optional()),
    gallery_json: z.array(z.string().trim().max(512)).max(MAX_PRODUCT_IMAGES).nullable().optional(),
    is_active: z.coerce.boolean(),
    is_featured: z.coerce.boolean(),
    is_new_arrival: z.coerce.boolean(),
    is_bestseller: z.coerce.boolean()
  })
  .superRefine((data, ctx) => {
    const totalImages = (data.image_url ? 1 : 0) + (data.gallery_json?.length ?? 0);
    if (totalImages > MAX_PRODUCT_IMAGES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gallery_json'],
        message: `Maximum ${MAX_PRODUCT_IMAGES} total images including the main image`
      });
    }
  });

export const adminCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i),
  is_active: z.coerce.boolean(),
  parent_id: z.coerce.number().int().positive().nullable().optional()
});

export const adminOrderListQuerySchema = z.object({
  status: z.enum(['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'returned']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const adminOrderStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'returned']),
  refundToWallet: z.coerce.boolean().optional()
});

export const adminBannerBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(255).nullable().optional().or(z.literal('')),
  image_url: z.string().trim().min(1).max(512),
  link_url: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(512).nullable().optional()),
  sort_order: z.coerce.number().int().min(0).max(9999),
  is_active: z.coerce.boolean()
});

export const adminPincodeBodySchema = z.object({
  pincode: z.string().trim().min(3).max(10),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  shipping_charge: z.coerce.number().nonnegative(),
  cod_available: z.coerce.boolean(),
  estimated_days: z.coerce.number().int().min(0).max(60),
  is_active: z.coerce.boolean()
});

export const adminProductFlagsSchema = z
  .object({
    is_active: z.coerce.boolean().optional(),
    is_featured: z.coerce.boolean().optional(),
    is_new_arrival: z.coerce.boolean().optional(),
    is_bestseller: z.coerce.boolean().optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one flag to update' });
