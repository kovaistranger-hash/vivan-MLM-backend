import { z } from 'zod';

export const checkoutSchema = z.object({
  shippingName: z.string().trim().min(2).max(120),
  shippingPhone: z.string().trim().min(8).max(20),
  shippingAddress1: z.string().trim().min(5).max(255),
  shippingAddress2: z.string().trim().max(255).optional(),
  shippingCity: z.string().trim().min(2).max(100),
  shippingState: z.string().trim().min(2).max(100),
  shippingPincode: z.string().trim().min(4).max(20),
  paymentMethod: z.enum(['cod', 'online']),
  customerGstin: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().trim().max(20).optional()
  ),
  walletAmount: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
    z.number().nonnegative().max(1_000_000_000).optional()
  )
});

export const checkoutPreviewQuerySchema = z.object({
  pincode: z.string().trim().min(3).max(12),
  walletAmount: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
    z.number().nonnegative().max(1_000_000_000).optional()
  )
});
