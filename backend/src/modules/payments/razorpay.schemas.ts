import { z } from 'zod';

export const rzpCreateOrderSchema = z.object({
  orderId: z.coerce.number().int().positive()
});

export const rzpVerifySchema = z.object({
  localOrderId: z.coerce.number().int().positive(),
  razorpayOrderId: z.string().min(4),
  razorpayPaymentId: z.string().min(4),
  razorpaySignature: z.string().min(4)
});
