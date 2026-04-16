import { pool, query } from '../../db/mysql.js';
import { creditWallet, getOrCreateWallet } from '../wallet/wallet.service.js';
import { getCompensationSettings, getCompensationSettingsForUpdate } from './compensationSettings.service.js';
import { getIndiaDateString, resolveEffectiveBinaryCommissionRate } from './commission.service.js';
import { ensureReferralSchemaExists } from './referralSchema.service.js';
/** Max gross (₹) for a single cron match slice (before TDS/admin); additional clamp via `daily_binary_ceiling` room. */
const CRON_MAX_GROSS_PER_MATCH = 10000;
const TDS_RATE = 0.05;
const ADMIN_RATE = 0.05;
function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
async function ensureBinaryDailyRow(c, userId, summaryDate) {
    await c.query(`INSERT IGNORE INTO binary_daily_summary (user_id, summary_date, binary_paid_total, ceiling_blocked_total)
     VALUES (?, ?, 0, 0)`, [userId, summaryDate]);
}
/**
 * One user’s IST-day cron binary slice: idempotent via `binary_payout_logs`, wallet via `creditWallet`, carry in SQL.
 */
async function runBinaryPayoutForUser(userId) {
    if (!Number.isFinite(userId) || userId <= 0)
        return 'skipped_no_room';
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        const payoutDate = await getIndiaDateString(c);
        const [bcRows] = await c.query(`SELECT left_profit_carry, right_profit_carry FROM binary_carry WHERE user_id = ? FOR UPDATE`, [userId]);
        const [dup] = await c.query(`SELECT id FROM binary_payout_logs WHERE user_id = ? AND payout_date = ? LIMIT 1`, [userId, payoutDate]);
        if (dup[0]) {
            await c.commit();
            return 'skipped_already';
        }
        const s = await getCompensationSettingsForUpdate(c);
        if (!Number(s.binary_income_enabled) || !Number(s.carry_forward_enabled)) {
            await c.commit();
            return 'skipped_settings';
        }
        const bc = bcRows[0];
        if (!bc) {
            await c.commit();
            return 'skipped_no_room';
        }
        const L = round2(Number(bc.left_profit_carry));
        const R = round2(Number(bc.right_profit_carry));
        const match = round2(Math.min(L, R));
        if (match <= 0) {
            await c.commit();
            return 'skipped_no_room';
        }
        const rate = await resolveEffectiveBinaryCommissionRate(s);
        let gross = round2(match * rate);
        if (gross <= 0) {
            await c.commit();
            return 'skipped_no_room';
        }
        gross = round2(Math.min(gross, CRON_MAX_GROSS_PER_MATCH));
        const [paidLogRows] = await c.query(`SELECT COALESCE(SUM(net_wallet_amount), 0) AS paid FROM binary_payout_logs WHERE user_id = ? AND payout_date = ?`, [userId, payoutDate]);
        const paidFromCronToday = round2(Number(paidLogRows[0]?.paid ?? 0));
        const dailyCap = round2(Number(s.daily_binary_ceiling));
        const room = round2(Math.max(0, dailyCap - paidFromCronToday));
        gross = round2(Math.min(gross, room));
        if (gross <= 0) {
            await c.commit();
            return 'skipped_no_room';
        }
        const tds = round2(gross * TDS_RATE);
        const adminFee = round2(gross * ADMIN_RATE);
        const net = round2(gross - tds - adminFee);
        if (net <= 0) {
            await c.commit();
            return 'skipped_no_room';
        }
        await getOrCreateWallet(userId, c);
        const { walletTransactionId } = await creditWallet(c, userId, net, 'commission_credit', {
            referenceType: 'binary_cron_payout',
            referenceId: userId,
            description: `Binary cron payout (match ₹${match}, gross ₹${gross}, IST ${payoutDate})`
        });
        await c.query(`UPDATE binary_carry SET
         left_profit_carry = ROUND(GREATEST(0, left_profit_carry - ?), 2),
         right_profit_carry = ROUND(GREATEST(0, right_profit_carry - ?), 2),
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`, [match, match, userId]);
        await c.query(`INSERT INTO binary_payout_logs (
         user_id, payout_date, matched_bv, gross_income, tds_amount, admin_fee, net_wallet_amount, wallet_transaction_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [userId, payoutDate, match, gross, tds, adminFee, net, walletTransactionId]);
        await ensureBinaryDailyRow(c, userId, payoutDate);
        await c.query(`UPDATE binary_daily_summary SET binary_paid_total = binary_paid_total + ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND summary_date = ?`, [net, userId, payoutDate]);
        await c.commit();
        return 'paid';
    }
    catch (e) {
        await c.rollback();
        console.error('[binary] runBinaryPayoutForUser', userId, e);
        return 'error';
    }
    finally {
        c.release();
    }
}
/**
 * Production cron binary payout: keyset-batched scan of `binary_carry`, one match per user per IST day.
 * Rate from `resolveEffectiveBinaryCommissionRate` (optional payout optimizer), caps, TDS/admin, `binary_payout_logs` idempotency.
 */
export async function processBinaryPayout(opts) {
    await ensureReferralSchemaExists();
    const summary = {
        eligible: 0,
        paid: 0,
        skippedAlreadyToday: 0,
        skippedNoRoomOrZero: 0,
        errors: 0,
        skippedSettings: false
    };
    let peek;
    try {
        peek = await getCompensationSettings();
    }
    catch {
        summary.skippedSettings = true;
        return summary;
    }
    if (!peek.binary_income_enabled || !peek.carry_forward_enabled) {
        summary.skippedSettings = true;
        return summary;
    }
    const [eligibleRow] = await query(`SELECT COUNT(*) AS c FROM binary_carry
     WHERE left_profit_carry > 0 AND right_profit_carry > 0`);
    summary.eligible = Number(eligibleRow?.c ?? 0);
    const simFlag = ['1', 'true', 'yes'].includes(String(process.env.BINARY_PAYOUT_SIMULATION || '').toLowerCase());
    if (simFlag) {
        console.log('[binary] BINARY_PAYOUT_SIMULATION: skipping wallet/carry updates, eligible=', summary.eligible);
        return summary;
    }
    const rawBatch = opts?.batchSize ?? Number(process.env.BINARY_CRON_BATCH_SIZE);
    const batchSize = Math.min(5000, Math.max(50, Number.isFinite(rawBatch) && rawBatch > 0 ? rawBatch : 1000));
    let afterId = 0;
    for (;;) {
        const rows = await query(`SELECT user_id FROM binary_carry
       WHERE left_profit_carry > 0 AND right_profit_carry > 0 AND user_id > ?
       ORDER BY user_id ASC
       LIMIT ?`, [afterId, batchSize]);
        if (!rows.length)
            break;
        afterId = Number(rows[rows.length - 1].user_id);
        for (const row of rows) {
            const userId = Number(row.user_id);
            const r = await runBinaryPayoutForUser(userId);
            if (r === 'paid')
                summary.paid++;
            else if (r === 'skipped_already')
                summary.skippedAlreadyToday++;
            else if (r === 'skipped_settings')
                summary.skippedSettings = true;
            else if (r === 'error')
                summary.errors++;
            else
                summary.skippedNoRoomOrZero++;
        }
    }
    return summary;
}
/**
 * Cron entry: runs {@link processBinaryPayout} (match-based gross, carry reduction, wallet ledger, payout log, IST idempotency).
 */
export async function processBinary() {
    const detail = await processBinaryPayout({
        batchSize: Number(process.env.BINARY_CRON_BATCH_SIZE || 1000)
    });
    console.log('[cron] processBinaryPayout detail', detail);
    return {
        usersProcessed: detail.paid,
        skippedSettings: detail.skippedSettings
    };
}
