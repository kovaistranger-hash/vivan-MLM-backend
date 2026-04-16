import { z } from 'zod';
export const compensationSettingsPutSchema = z.object({
    welcome_bonus_enabled: z.boolean(),
    welcome_bonus_amount: z.number().min(0).max(1_000_000),
    direct_income_enabled: z.boolean(),
    direct_income_type: z.enum(['percentage', 'fixed']),
    direct_income_value: z.number().min(0).max(1_000_000),
    trigger_stage: z.enum(['paid', 'delivered']),
    max_direct_income_per_order: z.number().min(0).nullish(),
    binary_income_enabled: z.boolean(),
    /** Single % of matched carry (gross); must match leg columns when saved from admin UI. */
    binary_percentage: z.number().min(0).max(100),
    binary_left_percentage: z.number().min(0).max(100),
    binary_right_percentage: z.number().min(0).max(100),
    carry_forward_enabled: z.boolean(),
    daily_binary_ceiling: z.number().min(0).max(100_000_000),
    binary_ceiling_behavior: z.enum(['hold_unpaid', 'discard_unpaid']),
    refund_reversal_enabled: z.boolean(),
    minimum_order_profit: z.number().min(0).max(1_000_000)
});
export const manualAdjustmentBodySchema = z.object({
    userId: z.number().int().positive(),
    orderId: z.number().int().positive().nullish(),
    adjustmentType: z.string().trim().min(2).max(80),
    amount: z.number().positive(),
    action: z.enum(['credit', 'debit']),
    reason: z.string().trim().min(3).max(500),
    applyToWallet: z.boolean()
});
export const binaryCarryAdjustSchema = z.discriminatedUnion('side', [
    z.object({
        side: z.literal('reset'),
        reason: z.string().trim().min(3).max(500)
    }),
    z.object({
        side: z.enum(['left', 'right']),
        delta: z.coerce.number(),
        reason: z.string().trim().min(3).max(500)
    })
]);
