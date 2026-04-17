import { pool } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { getOrCreateWallet, creditWallet, debitWallet } from '../wallet/wallet.service.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
import { getCompensationSettings, getCompensationSettingsForUpdate, serializeSettingsSnapshot } from './compensationSettings.service.js';
import { env } from '../../config/env.js';
import { computeOptimizedBinaryRateDecimal } from './optimizer.service.js';
function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function snapshotString(s) {
    return JSON.stringify(serializeSettingsSnapshot(s));
}
/** India business date for daily binary cap (IST calendar date). */
export async function getIndiaDateString(c) {
    const [rows] = await c.query(`SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')) AS d`);
    return String(rows[0]?.d || '');
}
function paymentEligibleForCommissions(order) {
    if (String(order.payment_status) === 'paid')
        return true;
    const method = String(order.payment_method || '').toLowerCase();
    if (method === 'cod')
        return String(order.status) === 'delivered';
    return false;
}
function statusEligibleForTrigger(order, trigger) {
    const st = String(order.status);
    if (trigger === 'delivered')
        return st === 'delivered';
    return ['paid', 'packed', 'shipped', 'delivered'].includes(st);
}
function computeDirectCommission(profit, s) {
    if (!s.direct_income_enabled)
        return 0;
    let v = s.direct_income_type === 'fixed'
        ? round2(Number(s.direct_income_value))
        : round2((profit * Number(s.direct_income_value)) / 100);
    if (s.max_direct_income_per_order != null) {
        const cap = round2(Number(s.max_direct_income_per_order));
        v = round2(Math.min(v, cap));
    }
    return round2(Math.max(0, v));
}
/**
 * Single decimal rate applied to matched carry (e.g. 0.10 for 10%).
 * Uses `binary_percentage` only — never sum left+right leg % (that double-counts).
 */
export function binaryCommissionRate(s) {
    const pct = Number(s.binary_percentage);
    if (Number.isFinite(pct) && pct >= 0) {
        return round2(pct / 100);
    }
    return round2(Math.min(Number(s.binary_left_percentage), Number(s.binary_right_percentage)) / 100);
}
/**
 * Admin-configured rate, optionally replaced by the payout optimizer (capped at 12% decimal and never above settings).
 */
export async function resolveEffectiveBinaryCommissionRate(s) {
    const settingsRate = binaryCommissionRate(s);
    if (!env.payoutOptimizerEnabled)
        return settingsRate;
    const optimized = await computeOptimizedBinaryRateDecimal();
    return round2(Math.max(0.05, Math.min(optimized, settingsRate, 0.12)));
}
export async function grantWelcomeBonusIfNeeded(c, userId) {
    const [rows] = await c.query('SELECT welcome_bonus_at FROM referral_users WHERE user_id = ? FOR UPDATE', [userId]);
    if (!rows[0])
        return;
    if (rows[0].welcome_bonus_at)
        return;
    const s = await getCompensationSettingsForUpdate(c);
    const snap = snapshotString(s);
    if (!s.welcome_bonus_enabled) {
        await c.query('UPDATE referral_users SET welcome_bonus_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
        return;
    }
    await getOrCreateWallet(userId, c);
    const amt = round2(Number(s.welcome_bonus_amount));
    if (amt <= 0) {
        await c.query('UPDATE referral_users SET welcome_bonus_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
        return;
    }
    const { walletTransactionId } = await creditWallet(c, userId, amt, 'bonus_credit', {
        referenceType: 'welcome_bonus',
        referenceId: userId,
        description: `Welcome bonus ₹${amt}`
    });
    await c.query(`INSERT INTO commission_transactions (
       user_id, order_id, commission_type, gross_amount, amount, wallet_amount, ceiling_blocked_amount, wallet_transaction_id, metadata_json, settings_snapshot_json
     ) VALUES (?, NULL, 'welcome_bonus', ?, ?, ?, 0, ?, JSON_OBJECT('currency','INR'), ?)`, [userId, amt, amt, amt, walletTransactionId, snap]);
    await c.query('UPDATE referral_users SET welcome_bonus_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
}
/** Ensures a `binary_carry` row exists (0,0) for BV / placement logic and commissions. */
export async function ensureBinaryCarryRow(c, userId) {
    await c.query(`INSERT IGNORE INTO binary_carry (user_id, left_profit_carry, right_profit_carry) VALUES (?, 0, 0)`, [userId]);
}
/**
 * Distribute BV (profit) up the binary tree: walk `referral_users` placement links from `userId`,
 * crediting each ancestor's `binary_carry` on the leg where the child sits (replaces `users.parent_id` / `left_bv` model).
 */
/** Max placement hops when rolling BV up the tree (avoids unbounded walks on bad data). */
const MAX_BV_PLACEMENT_DEPTH = 20;
export async function distributeBVConn(c, userId, bv) {
    const amount = round2(Number(bv));
    if (amount <= 0)
        return [];
    const adds = [];
    let current = Math.trunc(Number(userId));
    if (!Number.isFinite(current) || current <= 0)
        return [];
    let hops = 0;
    for (;;) {
        if (hops >= MAX_BV_PLACEMENT_DEPTH)
            break;
        const [rows] = await c.query(`SELECT placement_parent_user_id, placement_side FROM referral_users WHERE user_id = ? LIMIT 1`, [current]);
        const ru = rows[0];
        if (!ru)
            break;
        const parentId = ru.placement_parent_user_id != null ? Number(ru.placement_parent_user_id) : null;
        const sideRaw = ru.placement_side;
        if (parentId == null || parentId <= 0 || sideRaw == null)
            break;
        const leg = String(sideRaw) === 'right' ? 'right' : 'left';
        await ensureBinaryCarryRow(c, parentId);
        if (leg === 'left') {
            await c.query(`UPDATE binary_carry SET left_profit_carry = left_profit_carry + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [amount, parentId]);
        }
        else {
            await c.query(`UPDATE binary_carry SET right_profit_carry = right_profit_carry + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [amount, parentId]);
        }
        adds.push({ ancestorUserId: parentId, leg, profit: amount });
        current = parentId;
        hops++;
    }
    return adds;
}
/** Standalone BV distribution (own transaction). Prefer `distributeBVConn` inside order commission flow. */
export async function distributeBV(userId, bv) {
    await ensureReferralSchemaExists();
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        await distributeBVConn(c, userId, bv);
        await c.commit();
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
}
async function settleBinaryForAncestor(c, ancestorUserId, orderId, orderNumber, summaryDate, matchEvents, s, snap) {
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
    await c.query(`INSERT INTO binary_daily_summary (user_id, summary_date, binary_paid_total, ceiling_blocked_total)
     VALUES (?, ?, 0, 0)
     ON DUPLICATE KEY UPDATE user_id = user_id`, [userId, summaryDate]);
}
export async function processDeliveredOrderCommissionsConn(c, orderId) {
    const [ords] = await c.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = ords[0];
    if (!order)
        throw new ApiError(404, 'Order not found');
    if (order.commission_processed_at)
        return { processed: false, reason: 'already_processed' };
    const s = await getCompensationSettingsForUpdate(c);
    const snap = snapshotString(s);
    const profit = round2(Number(order.subtotal || 0));
    const payOk = paymentEligibleForCommissions(order);
    const statusOk = statusEligibleForTrigger(order, s.trigger_stage);
    if (!payOk) {
        await c.query(`UPDATE orders SET commission_status = 'skipped_pending_payment', profit_amount = ? WHERE id = ?`, [profit, orderId]);
        return { processed: false, reason: 'pending_payment' };
    }
    if (!statusOk) {
        return { processed: false, reason: 'wrong_trigger_stage' };
    }
    const minProfit = round2(Number(s.minimum_order_profit));
    if (profit < minProfit) {
        await c.query(`UPDATE orders SET commission_processed_at = CURRENT_TIMESTAMP, commission_status = 'skipped_below_min_profit', profit_amount = ? WHERE id = ?`, [profit, orderId]);
        return { processed: true, reason: 'below_min_profit' };
    }
    if (profit <= 0) {
        await c.query(`UPDATE orders SET commission_processed_at = CURRENT_TIMESTAMP, commission_status = 'skipped_zero_profit', profit_amount = 0 WHERE id = ?`, [orderId]);
        return { processed: true, reason: 'zero_profit' };
    }
    const buyerId = Number(order.user_id);
    const orderNumber = String(order.order_number || orderId);
    const summaryDate = await getIndiaDateString(c);
    const binaryAdds = [];
    const matchEvents = [];
    const [refRows] = await c.query('SELECT sponsor_user_id FROM referral_users WHERE user_id = ? LIMIT 1', [buyerId]);
    const sponsorId = refRows[0]?.sponsor_user_id != null ? Number(refRows[0].sponsor_user_id) : null;
    let directCommission = computeDirectCommission(profit, s);
    const maxOrderWalletShare = Number(process.env.ORDER_MAX_COMMISSION_SHARE_OF_PROFIT ?? '0.6');
    if (Number.isFinite(maxOrderWalletShare) && maxOrderWalletShare > 0) {
        directCommission = round2(Math.min(directCommission, round2(profit * maxOrderWalletShare)));
    }
    if (sponsorId && directCommission > 0) {
        await getOrCreateWallet(sponsorId, c);
        const { walletTransactionId } = await creditWallet(c, sponsorId, directCommission, 'commission_credit', {
            referenceType: 'order',
            referenceId: orderId,
            description: `Direct referral commission (order #${orderNumber})`
        });
        await c.query(`INSERT INTO commission_transactions (
         user_id, order_id, commission_type, gross_amount, amount, wallet_amount, ceiling_blocked_amount, wallet_transaction_id, metadata_json, settings_snapshot_json
       ) VALUES (?, ?, 'direct_referral', ?, ?, ?, 0, ?, ?, ?)`, [
            sponsorId,
            orderId,
            profit,
            directCommission,
            directCommission,
            walletTransactionId,
            JSON.stringify({ buyerUserId: buyerId, orderNumber }),
            snap
        ]);
    }
    if (s.binary_income_enabled && s.carry_forward_enabled) {
        const adds = await distributeBVConn(c, buyerId, profit);
        binaryAdds.push(...adds);
    }
    const audit = {
        profit,
        binaryAdds,
        matchEvents,
        summaryDate,
        processedAt: new Date().toISOString()
    };
    await c.query(`UPDATE orders SET profit_amount = ?, commission_processed_at = CURRENT_TIMESTAMP, commission_status = 'completed', commission_audit_json = ? WHERE id = ?`, [profit, JSON.stringify(audit), orderId]);
    return { processed: true };
}
export async function processDeliveredOrderCommissions(orderId) {
    await ensureReferralSchemaExists();
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        const r = await processDeliveredOrderCommissionsConn(c, orderId);
        await c.commit();
        return r;
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
}
/** Run binary matching for one user (admin tool): one match slice per iteration, bounded passes. */
export async function runBinaryStandstillForUser(userId) {
    await ensureReferralSchemaExists();
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        const s = await getCompensationSettingsForUpdate(c);
        const snap = snapshotString(s);
        const summaryDate = await getIndiaDateString(c);
        let totalEvents = 0;
        for (let i = 0; i < 100; i++) {
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
async function reverseCommissionProcessing(c, orderId) {
    const [ords] = await c.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = ords[0];
    if (!order?.commission_processed_at)
        return;
    const auditRaw = order.commission_audit_json;
    let audit = null;
    try {
        audit = typeof auditRaw === 'string' ? JSON.parse(auditRaw) : auditRaw;
    }
    catch {
        audit = null;
    }
    const [txRows] = await c.query(`SELECT * FROM commission_transactions WHERE order_id = ? ORDER BY id DESC`, [orderId]);
    for (const tx of txRows) {
        const typ = String(tx.commission_type);
        const walletAmt = round2(Number(tx.wallet_amount || 0));
        if (walletAmt > 0 && tx.wallet_transaction_id) {
            await debitWallet(c, Number(tx.user_id), walletAmt, 'admin_debit', {
                description: `Commission reversal (order #${order.order_number}, ${typ})`,
                referenceType: 'order',
                referenceId: orderId
            });
        }
        if (walletAmt < 0 && tx.wallet_transaction_id) {
            await creditWallet(c, Number(tx.user_id), round2(Math.abs(walletAmt)), 'commission_credit', {
                referenceType: 'order',
                referenceId: orderId,
                description: `Commission reversal (order #${order.order_number}, ${typ})`
            });
        }
        let meta = {};
        try {
            meta = tx.metadata_json ? (typeof tx.metadata_json === 'string' ? JSON.parse(tx.metadata_json) : tx.metadata_json) : {};
        }
        catch {
            meta = {};
        }
        const sd = String(meta.summaryDate || '');
        const discarded = Boolean(meta.discarded);
        if (typ === 'binary_match' && sd) {
            const paidPart = walletAmt > 0 ? walletAmt : 0;
            await c.query(`UPDATE binary_daily_summary SET
           binary_paid_total = GREATEST(0, binary_paid_total - ?),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND summary_date = ?`, [paidPart, Number(tx.user_id), sd]);
        }
        if (typ === 'binary_ceiling_hold' && sd && !discarded) {
            const blocked = round2(Number(tx.ceiling_blocked_amount || 0));
            await c.query(`UPDATE binary_daily_summary SET
           ceiling_blocked_total = GREATEST(0, ceiling_blocked_total - ?),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND summary_date = ?`, [blocked, Number(tx.user_id), sd]);
        }
    }
    if (audit?.matchEvents?.length) {
        for (const ev of [...audit.matchEvents].reverse()) {
            const m = round2(Number(ev.matchedProfit || 0));
            if (m <= 0)
                continue;
            await ensureBinaryCarryRow(c, ev.ancestorUserId);
            await c.query(`UPDATE binary_carry SET
           left_profit_carry = left_profit_carry + ?,
           right_profit_carry = right_profit_carry + ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`, [m, m, ev.ancestorUserId]);
        }
    }
    if (audit?.binaryAdds?.length) {
        for (const add of audit.binaryAdds) {
            const p = round2(Number(add.profit || 0));
            if (p <= 0)
                continue;
            await ensureBinaryCarryRow(c, add.ancestorUserId);
            if (add.leg === 'left') {
                await c.query(`UPDATE binary_carry SET left_profit_carry = GREATEST(0, left_profit_carry - ?), updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [p, add.ancestorUserId]);
            }
            else {
                await c.query(`UPDATE binary_carry SET right_profit_carry = GREATEST(0, right_profit_carry - ?), updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [p, add.ancestorUserId]);
            }
        }
    }
    await c.query(`DELETE FROM commission_transactions WHERE order_id = ?`, [orderId]);
    await c.query(`UPDATE orders SET commission_processed_at = NULL, commission_status = NULL, commission_audit_json = NULL WHERE id = ?`, [orderId]);
}
export async function reverseOrderCommissionsIfConfigured(c, orderId) {
    const s = await getCompensationSettings();
    if (!s.refund_reversal_enabled)
        return;
    const [ords] = await c.query('SELECT commission_processed_at FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (ords[0]?.commission_processed_at) {
        await reverseCommissionProcessing(c, orderId);
    }
}
export async function adminRecalculateOrderCommissions(orderId, force) {
    await ensureReferralSchemaExists();
    const c = await pool.getConnection();
    try {
        await c.beginTransaction();
        const [ords] = await c.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
        if (!ords[0])
            throw new ApiError(404, 'Order not found');
        const st = String(ords[0].status);
        if (st === 'cancelled' || st === 'returned')
            throw new ApiError(400, 'Invalid order status for commissions');
        if (ords[0].commission_processed_at) {
            if (!force)
                throw new ApiError(409, 'Commissions already processed. Pass force=true to reverse and re-run.');
            await reverseCommissionProcessing(c, orderId);
        }
        const r = await processDeliveredOrderCommissionsConn(c, orderId);
        await c.commit();
        return r;
    }
    catch (e) {
        await c.rollback();
        throw e;
    }
    finally {
        c.release();
    }
}
