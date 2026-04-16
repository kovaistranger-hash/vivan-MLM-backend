import { z } from 'zod';
export const adminRecalculateCommissionsSchema = z.object({
    force: z.boolean().optional()
});
export const placeBinaryBodySchema = z.object({
    childReferralCode: z.string().trim().min(4).max(20),
    parentReferralCode: z.string().trim().min(4).max(20),
    side: z.enum(['left', 'right'])
});
