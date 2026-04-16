import { z } from 'zod';

const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const moneyPositive = z.coerce
  .number()
  .positive('Amount must be positive')
  .refine((n) => Number.isFinite(n) && Math.round(n * 100) === Math.round(Number(n.toFixed(2)) * 100), {
    message: 'Use at most 2 decimal places'
  });

const optionalTrim = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? undefined : String(v).trim()))
  .optional();

export const bankAccountBodySchema = z
  .object({
    account_holder_name: z.string().trim().min(2).max(120),
    bank_name: z.string().trim().min(2).max(120),
    account_number: optionalTrim.transform((v) => (v === '' ? undefined : v)),
    ifsc_code: optionalTrim
      .transform((v) => (v === '' ? undefined : v?.toUpperCase()))
      .optional(),
    branch_name: optionalTrim,
    upi_id: optionalTrim,
    is_default: z.boolean().optional()
  })
  .superRefine((data, ctx) => {
    const hasBank = !!(data.account_number && data.ifsc_code);
    const hasUpi = !!(data.upi_id && data.upi_id.length > 0);
    if (!hasBank && !hasUpi) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide bank account + IFSC or a UPI ID' });
      return;
    }
    if (data.ifsc_code && !ifscRegex.test(data.ifsc_code)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ifsc_code'], message: 'Invalid IFSC format' });
    }
    if (data.account_number && data.account_number.length < 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['account_number'],
        message: 'Account number must be at least 9 digits'
      });
    }
    if (data.account_number && !data.ifsc_code) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ifsc_code'], message: 'IFSC is required with account number' });
    }
    if (data.ifsc_code && !data.account_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['account_number'],
        message: 'Account number is required with IFSC'
      });
    }
  });

export const withdrawalCreateBodySchema = z.object({
  bankAccountId: z.coerce.number().int().positive(),
  amount: moneyPositive,
  notes: z.string().trim().max(500).optional().nullable()
});

export const withdrawalListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const adminWithdrawalListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'paid', 'rejected', 'cancelled']).optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: z.string().trim().max(32).optional(),
  to: z.string().trim().max(32).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

export const adminWithdrawalRemarksSchema = z.object({
  remarks: z.string().trim().max(500).optional().nullable()
});

export const withdrawalSettingsPutSchema = z
  .object({
    min_withdrawal_amount: moneyPositive,
    max_withdrawal_amount: moneyPositive.nullable().optional(),
    withdrawal_fee_type: z.enum(['fixed', 'percentage']),
    withdrawal_fee_value: z.coerce.number().nonnegative(),
    kyc_required: z.boolean(),
    auto_approve: z.boolean(),
    allow_upi: z.boolean(),
    allow_bank_transfer: z.boolean(),
    one_pending_request_only: z.boolean()
  })
  .superRefine((data, ctx) => {
    if (!data.allow_upi && !data.allow_bank_transfer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one payout method must be enabled' });
    }
    if (
      data.max_withdrawal_amount != null &&
      data.max_withdrawal_amount < data.min_withdrawal_amount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['max_withdrawal_amount'],
        message: 'Max must be greater than or equal to min'
      });
    }
    if (data.withdrawal_fee_type === 'percentage' && data.withdrawal_fee_value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['withdrawal_fee_value'],
        message: 'Percentage fee cannot exceed 100'
      });
    }
  });
