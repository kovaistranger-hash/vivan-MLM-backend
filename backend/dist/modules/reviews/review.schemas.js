import { z } from 'zod';
export const createReviewSchema = z.object({
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().max(200).optional(),
    body: z.string().trim().max(2000).optional()
});
