import { query } from '../../db/mysql.js';
import { ensureReferralSchemaExists } from './schema.service.js';
/** Same shape as `getBinarySummaryForUser` when there is no carry/daily/commission data. */
export function zeroBinarySummaryPayload() {
    return {
        leftCarry: 0,
        rightCarry: 0,
        carryUpdatedAt: null,
        todayBinaryPaid: 0,
        todayCeilingBlocked: 0,
        summaryDate: '',
        lifetimeDirectReferralInr: 0,
        lifetimeBinaryMatchInr: 0,
        lifetimeCeilingBlockedInr: 0
    };
}
/** BV carry, daily caps, and lifetime commission totals for MLM / profile UIs. */
export async function getBinarySummaryForUser(userId) {
    await ensureReferralSchemaExists();
    const carryRows = await query(`SELECT left_profit_carry, right_profit_carry, updated_at FROM binary_carry WHERE user_id = :u LIMIT 1`, { u: userId });
    const carry = carryRows[0] || { left_profit_carry: 0, right_profit_carry: 0, updated_at: null };
    const indiaDateRows = await query(`SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')) AS d`);
    const d = indiaDateRows[0]?.d || '';
    const dailyRows = await query(`SELECT binary_paid_total, ceiling_blocked_total, updated_at FROM binary_daily_summary WHERE user_id = :u AND summary_date = :d LIMIT 1`, { u: userId, d });
    const daily = dailyRows[0] || { binary_paid_total: 0, ceiling_blocked_total: 0 };
    const sums = await query(`SELECT
       COALESCE(SUM(CASE WHEN commission_type = 'direct_referral' THEN wallet_amount ELSE 0 END),0) AS direct_total,
       COALESCE(SUM(CASE WHEN commission_type = 'binary_match' THEN wallet_amount ELSE 0 END),0) AS binary_total,
       COALESCE(SUM(CASE WHEN commission_type = 'binary_ceiling_hold' THEN ceiling_blocked_amount ELSE 0 END),0) AS ceiling_blocked_alltime
     FROM commission_transactions WHERE user_id = :u`, { u: userId });
    const w = sums[0] || {};
    return {
        leftCarry: Number(carry.left_profit_carry || 0),
        rightCarry: Number(carry.right_profit_carry || 0),
        carryUpdatedAt: carry.updated_at,
        todayBinaryPaid: Number(daily.binary_paid_total || 0),
        todayCeilingBlocked: Number(daily.ceiling_blocked_total || 0),
        summaryDate: d,
        lifetimeDirectReferralInr: Number(w.direct_total || 0),
        lifetimeBinaryMatchInr: Number(w.binary_total || 0),
        lifetimeCeilingBlockedInr: Number(w.ceiling_blocked_alltime || 0)
    };
}
