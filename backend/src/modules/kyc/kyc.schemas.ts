import { z } from 'zod';

export const kycSubmitBodySchema = z.object({
  pan: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .refine((s) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(s), 'Invalid PAN'),
  aadhaar: z
    .string()
    .transform((s) => s.replace(/\D/g, ''))
    .pipe(z.string().length(12, 'Aadhaar must be exactly 12 digits')),
  tier: z.enum(['L1', 'L2'])
});

export const kycAdminDecisionBodySchema = z
  .object({
    status: z.enum(['verified', 'rejected']),
    rejectionReason: z.string().max(500).optional().nullable()
  })
  .refine(
    (d) =>
      d.status !== 'rejected' || !!(d.rejectionReason && String(d.rejectionReason).trim().length > 0),
    'rejectionReason is required when status is rejected'
  );
