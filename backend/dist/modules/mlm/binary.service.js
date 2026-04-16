import { pool, query } from '../../db/mysql.js';
import { creditWallet, getOrCreateWallet } from '../wallet/wallet.service.js';
import { getCompensationSettings, getCompensationSettingsForUpdate, serializeSettingsSnapshot } from './compensationSettings.service.js';
import { ensureBinaryCarryRow, getIndiaDateString, resolveEffectiveBinaryCommissionRate } from './commission.service.js';
import { ensureReferralSchemaExists } from './schema.service.js';
import { logger } from '../../utils/logger.js';
function isMysqlDuplicateKey(err) {
    return Boolean(err && typeof err === 'object' && 'code' in err && err.code === 'ER_DUP_ENTRY');
}
/** Max gross (₹) for a single cron match slice (before TDS/admin); additional clamp via `daily_binary_ceiling` room. */
const CRON_MAX_GROSS_PER_MATCH = 10000;
const TDS_RATE = 0.05;
const ADMIN_RATE = 0.05;
function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
/**
 * One binary match slice for an ancestor (admin standstill or legacy flows).
 * Order flow must **not** call this — only cron (`processBinaryPayout`) or admin tools.
 *
 * **Transaction:** `c` must already be inside `beginTransaction` / `commit` (or rollback) by the caller.
 */
export async function settleBinaryForAncestor(c, ancestorUserId, orderId, orderNumber, summaryDate, matchEvents, s, snap) {
    if (!s.binary_income_enabled || !s.carry_forward_enabled)
        return;
    const dailyCap = round2(Number(s.daily_binary_ceiling));
    const binaryRate = await resolveEffectiveBinaryCommissionRate(s);
    const discardCeiling = s.binary_ceiling_behavior === 'discard_unpaid';
    await ensureBinaryCarryRow(c, ancestorUserId);
    const [rows] = await c.query('SELECT left_profit_carry, right_profit_carry FROM binary_carry WHERE user_id = ? FOR UPDATE', [ancestorUserId]);
    if (!rows[0])
        return;
    const L = round2(Number(rows[0].left_profit_carry));
    const R = round2(Number(rows[0].right_profit_carry));
    const matched = round2(Math.min(L, R));
    if (matched <= 0)
        return;
    const grossCommission = round2(matched * binaryRate);
    await ensureBinaryDailyRow(c, ancestorUserId, summaryDate);
    const [sumRows] = await c.query(`SELECT binary_paid_total FROM binary_daily_summary WHERE user_id = ? AND summary_date = ? FOR UPDATE`, [ancestorUserId, summaryDate]);
    const paidToday = round2(Number(sumRows[0]?.binary_paid_total ?? 0));
    const room = round2(Math.max(0, dailyCap - paidToday));
    const payNow = round2(Math.min(grossCommission, room));
    const blocked = round2(grossCommission - payNow);
    await c.query(`UPDATE binary_carry SET
       left_profit_carry = ROUND(GREATEST(0, left_profit_carry - ?), 2),
       right_profit_carry = ROUND(GREATEST(0, right_profit_carry - ?), 2),
       updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`, [matched, matched, ancestorUserId]);
    let walletTxId = null;
    if (payNow > 0) {
        await getOrCreateWallet(ancestorUserId, c);
        const { walletTransactionId } = await creditWallet(c, ancestorUserId, payNow, 'commission_credit', {
            referenceType: orderId ? 'order' : 'binary_standstill',
            referenceId: orderId ?? undefined,
            description: orderId
                ? `Binary match commission (order #${orderNumber})`
                : `Binary match settlement (admin standstill #${ancestorUserId})`
        });
        walletTxId = walletTransactionId;
        await c.query(`UPDATE binary_daily_summary SET binary_paid_total = binary_paid_total + ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND summary_date = ?`, [payNow, ancestorUserId, summaryDate]);
        await c.query(`INSERT INTO commission_transactions (
         user_id, order_id, commission_type, gross_amount, amount, wallet_amount, ceiling_blocked_amount, wallet_transaction_id, metadata_json, settings_snapshot_json
       ) VALUES (?, ?, 'binary_match', ?, ?, ?, 0, ?, ?, ?)`, [
            ancestorUserId,
            orderId,
            matched,
            grossCommission,
            payNow,
            walletTxId,
            JSON.stringify({
                summaryDate,
                matchedProfit: matched,
                grossCommission,
                orderNumber
            }),
            snap
        ]);
    }
    if (blocked > 0 && !discardCeiling) {
        await c.query(`INSERT INTO commission_transactions (
         user_id, order_id, commission_type, gross_amount, amount, wallet_amount, ceiling_blocked_amount, wallet_transaction_id, metadata_json, settings_snapshot_json
       ) VALUES (?, ?, 'binary_ceiling_hold', ?, ?, 0, ?, NULL, ?, ?)`, [
            ancestorUserId,
            orderId,
            matched,
            grossCommission,
            blocked,
            JSON.stringify({ summaryDate, matchedProfit: matched, grossCommission, orderNumber }),
            snap
        ]);
        await c.query(`UPDATE binary_daily_summary SET ceiling_blocked_total = ceiling_blocked_total + ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND summary_date = ?`, [blocked, ancestorUserId, summaryDate]);
    }
    matchEvents.push({
        ancestorUserId,
        matchedProfit: matched,
        grossCommission,
        walletPaid: payNow,
        ceilingBlocked: blocked,
        summaryDate
    });
}
async function ensureBinaryDailyRow(c, userId, summaryDate) {
    await c.query(`INSERT IGNORE INTO binary_daily_summary (user_id, summary_date, binary_paid_total, ceiling_blocked_total)
     VALUES (?, ?, 0, 0)`, [userId, summaryDate]);
}
/**
 * One user’s IST-day cron binary slice. **Transaction:** opens its own connection, `beginTransaction` before
 * wallet/carry/log writes, `commit` or full `rollback` (including on `unique_binary` duplicate / race).
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
        logger.info('Binary processed', {
            userId,
            payoutDate,
            matchedBv: match,
            grossInr: gross,
            netWalletInr: net
        });
        return 'paid';
    }
    catch (e) {
        try {
            await c.rollback();
        }
        catch {
            /* ignore rollback errors */
        }
        if (isMysqlDuplicateKey(e)) {
            logger.warn('Binary payout skipped (unique_binary / concurrent cron)', { userId });
            return 'skipped_already';
        }
        logger.error('Binary payout transaction failed', { userId, err: e });
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
        logger.debug('Binary payout simulation: skipping wallet/carry updates', { eligible: summary.eligible });
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
const STANDSTILL_MAX_SLICES = 2;
/**
 * Cron entry: delegates to {@link runBinaryDaily} in `cron.service.ts` (dynamic import avoids circular ESM).
 */
export async function processBinary() {
    const { runBinaryDaily } = await import('./cron.service.js');
    const detail = await runBinaryDaily();
    logger.info('Binary daily cron finished', detail);
    return {
        usersProcessed: detail.paid,
        skippedSettings: detail.skippedSettings
    };
}
/**
 * Admin: at most {@link STANDSTILL_MAX_SLICES} binary match slices in one transaction (no 100-iteration loop).
 */
export async function runBinaryStandstillForUser(userId) {
    await ensureReferralSchemaExists();
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        const s = await getCompensationSettingsForUpdate(c);
        const snap = JSON.stringify(serializeSettingsSnapshot(s));
        const summaryDate = await getIndiaDateString(c);
        let totalEvents = 0;
        for (let i = 0; i < STANDSTILL_MAX_SLICES; i++) {
            const matchEvents = [];
            await settleBinaryForAncestor(c, userId, null, 'ADMIN', summaryDate, matchEvents, s, snap);
            totalEvents += matchEvents.length;
            if (matchEvents.length === 0)
                break;
        }
        await c.commit();
        return { settled: true, events: totalEvents };
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
}
function round2CarryList(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
/** Admin: paginated binary carry + today’s payout snapshot for support tooling. */
export async function adminBinaryCarryList(params) {
    const settings = await getCompensationSettings();
    const ceilingDefault = round2CarryList(Number(settings.daily_binary_ceiling));
    const indiaRows = await query(`SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')) AS d`);
    const istDate = indiaRows[0]?.d || '';
    const offset = (params.page - 1) * params.pageSize;
    const where = ['1=1'];
    const vals = {
        limit: params.pageSize,
        offset,
        istDate,
        ceilingDefault
    };
    if (params.q?.trim()) {
        where.push('(u.email LIKE :q OR u.name LIKE :q OR CAST(u.id AS CHAR) = :exact)');
        vals.q = `%${params.q.trim()}%`;
        vals.exact = params.q.trim();
    }
    const w = where.join(' AND ');
    const sql = `
    SELECT
      u.id AS user_id,
      u.name,
      u.email,
      COALESCE(bc.left_profit_carry, 0) AS left_profit_carry,
      COALESCE(bc.right_profit_carry, 0) AS right_profit_carry,
      COALESCE(bds.binary_paid_total, 0) AS binary_paid_today,
      COALESCE(bds.ceiling_blocked_total, 0) AS ceiling_blocked_today,
      (
        SELECT COALESCE(SUM(ct.gross_amount), 0)
        FROM commission_transactions ct
        WHERE ct.user_id = u.id
          AND ct.commission_type = 'binary_match'
          AND DATE(CONVERT_TZ(ct.created_at, '+00:00', '+05:30')) = :istDate
      ) AS matched_volume_today
    FROM users u
    LEFT JOIN binary_carry bc ON bc.user_id = u.id
    LEFT JOIN binary_daily_summary bds ON bds.user_id = u.id AND bds.summary_date = :istDate
    INNER JOIN roles r ON r.id = u.role_id AND r.slug = 'customer'
    WHERE ${w}
    ORDER BY u.id DESC
    LIMIT :limit OFFSET :offset
  `;
    const items = await query(sql, vals);
    const { limit, offset: _o, istDate: _d, ceilingDefault: _c, ...countVals } = vals;
    const countRows = await query(`SELECT COUNT(*) AS total FROM users u INNER JOIN roles r ON r.id = u.role_id AND r.slug = 'customer' WHERE ${w}`, countVals);
    const enriched = items.map((row) => {
        const paid = round2CarryList(Number(row.binary_paid_today));
        const rem = round2CarryList(Math.max(0, ceilingDefault - paid));
        return {
            ...row,
            daily_binary_ceiling: ceilingDefault,
            remaining_ceiling_today: rem
        };
    });
    return { items: enriched, total: Number(countRows[0]?.total || 0), ceilingDefault, istDate };
}
