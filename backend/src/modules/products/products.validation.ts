import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  description: z.string().max(5000).optional().default(""),
  short_description: z.string().max(500).optional().default(""),
  sku: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().default("General"),
  subcategory: z.string().max(100).optional().default(""),
  brand: z.string().max(100).optional().default(""),
  image_url: z.string().url("Image URL must be valid").optional().nullable(),
  gallery_urls: z.array(z.string().url("Gallery image must be a valid URL")).optional().default([]),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  mrp: z.coerce.number().min(0, "MRP must be 0 or more"),
  stock: z.coerce.number().int().min(0, "Stock must be 0 or more").default(0),
  status: z.enum(["draft", "active", "inactive"]).default("active"),
  is_featured: z.coerce.boolean().optional().default(false)
});

export const updateProductSchema = createProductSchema.partial();

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().optional().default(""),
  category: z.string().optional().default(""),
  status: z.enum(["draft", "active", "inactive"]).optional(),
  featured: z.coerce.boolean().optional()
});
