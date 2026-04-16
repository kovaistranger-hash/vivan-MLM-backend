import { z } from 'zod';
export const productListQuerySchema = z.object({
    search: z.string().trim().max(120).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    minBv: z.coerce.number().nonnegative().optional(),
    maxBv: z.coerce.number().nonnegative().optional(),
    featured: z.enum(['1', '0', 'true', 'false']).optional(),
    newArrival: z.enum(['1', '0', 'true', 'false']).optional(),
    bestseller: z.enum(['1', '0', 'true', 'false']).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'name_asc', 'bv_desc', 'discount']).optional(),
    page: z.coerce.number().int().positive().max(10_000).optional(),
    pageSize: z.coerce.number().int().positive().max(60).optional()
});
