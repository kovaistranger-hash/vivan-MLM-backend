import { z } from 'zod';
export const registerSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(190),
    phone: z.string().trim().max(20).optional(),
    password: z.string().min(8).max(128),
    acceptedTerms: z.literal(true, {
        errorMap: () => ({ message: 'You must accept the terms, privacy policy, and income disclaimer' })
    }),
    sponsorReferralCode: z.string().trim().min(4).max(20).optional(),
    placementParentReferralCode: z.string().trim().min(4).max(20).optional(),
    placementSide: z.enum(['left', 'right']).optional()
});
export const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(128)
});
export const refreshSchema = z.object({
    refreshToken: z.string().min(10).max(512)
});
export const expoPushTokenBodySchema = z.object({
    expoPushToken: z.string().trim().min(20).max(512)
});
