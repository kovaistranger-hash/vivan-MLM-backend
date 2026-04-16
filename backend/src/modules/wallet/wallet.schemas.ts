import { z } from 'zod';

const moneyPositive = z.coerce
  .number()
  .positive('Amount must be positive')
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === Math.round(Number(n.toFixed(2)) * 100), {
    message: 'Use at most 2 decimal places'
  });

export const walletUseBodySchema = z.object({
  amount: moneyPositive,
  pincode: z.string().trim().min(3).max(12)
});

export const walletTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const adminWalletListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const adminWalletAdjustBodySchema = z.object({
  amount: moneyPositive,
  description: z.string().trim().min(1).max(255)
});

export const adminWalletRefundBodySchema = z.object({
  amount: moneyPositive,
  description: z.string().trim().min(1).max(255),
  reference_type: z.string().trim().min(1).max(50),
  reference_id: z.coerce.number().int().positive()
});
