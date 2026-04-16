import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { getOrCreateWallet, creditWallet, debitWallet } from '../wallet/wallet.service.js';
import { ensureReferralSchemaExists } from './schema.service.js';
import {
  getCompensationSettings,
  getCompensationSettingsForUpdate,
  serializeSettingsSnapshot,
  type CompensationSettingsRow
} from './compensationSettings.service.js';
import { env } from '../../config/env.js';
import { computeOptimizedBinaryRateDecimal } from './optimizer.service.js';
import { logger } from '../../utils/logger.js';
import { createNotification } from '../notifications/notification.service.js';

function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function snapshotString(s: CompensationSettingsRow) {
  return JSON.stringify(serializeSettingsSnapshot(s));
}

/** India business date for daily binary cap (IST calendar date). */
export async function getIndiaDateString(c: PoolConnection): Promise<string> {
  const [rows]: any = await c.query(
    `SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')) AS d`
  );
  return String(rows[0]?.d || '');
}

function paymentEligibleForCommissions(order: any): boolean {
  if (String(order.payment_status) === 'paid') return true;
  const method = String(order.payment_method || '').toLowerCase();
  if (method === 'cod') return String(order.status) === 'delivered';
  return false;
}

function statusEligibleForTrigger(order: any, trigger: 'paid' | 'delivered'): boolean {
  const st = String(order.status);
  if (trigger === 'delivered') return st === 'delivered';
  return ['paid', 'packed', 'shipped', 'delivered'].includes(st);
}

function computeDirectCommission(profit: number, s: CompensationSettingsRow): number {
  if (!s.direct_income_enabled) return 0;
  let v =
    s.direct_income_type === 'fixed'
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
export function binaryCommissionRate(s: CompensationSettingsRow): number {
  const pct = Number(s.binary_percentage);
  if (Number.isFinite(pct) && pct >= 0) {
    return round2(pct / 100);
  }
  return round2(
    Math.min(Number(s.binary_left_percentage), Number(s.binary_right_percentage)) / 100
  );
}

/**
 * Admin-configured rate, optionally replaced by the payout optimizer (capped at 12% decimal and never above settings).
 */
export async function resolveEffectiveBinaryCommissionRate(s: CompensationSettingsRow): Promise<number> {
  const settingsRate = binaryCommissionRate(s);
  if (!env.payoutOptimizerEnabled) return settingsRate;
  const optimized = await computeOptimizedBinaryRateDecimal();
  return round2(Math.max(0.05, Math.min(optimized, settingsRate, 0.12)));
}

/**
 * Welcome bonus side effects on `referral_users` / wallet / `commission_transactions`.
 * **Transaction:** `c` must be an open transaction (same pattern as signup in `auth.service`).
 */
export async function grantWelcomeBonusIfNeeded(c: PoolConnection, userId: number) {
  const [rows]: any = await c.query(
    'SELECT welcome_bonus_at FROM referral_users WHERE user_id = ? FOR UPDATE',
    [userId]
  );
  if (!rows[0]) return;
  if (rows[0].welcome_bonus_at) return;

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
  await c.query(
    `INSERT INTO commission_transactions (
       user_id, order_id, commission_type, gross_amount, amount, wallet_amount, ceiling_blocked_amount, wallet_transaction_id, metadata_json, settings_snapshot_json
     ) VALUES (?, NULL, 'welcome_bonus', ?, ?, ?, 0, ?, JSON_OBJECT('currency','INR'), ?)`,
    [userId, amt, amt, amt, walletTransactionId, snap]
  );
  await createNotification(c, userId, `Welcome bonus of ₹${amt} credited to your wallet.`);
  await c.query('UPDATE referral_users SET welcome_bonus_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
}

/** Ensures a `binary_carry` row exists (0,0) for BV / placement logic and commissions. */
export async function ensureBinaryCarryRow(c: PoolConnection, userId: number) {
  await c.query(
    `INSERT IGNORE INTO binary_carry (user_id, left_profit_carry, right_profit_carry) VALUES (?, 0, 0)`,
    [userId]
  );
}

type BinaryAdd = { ancestorUserId: number; leg: 'left' | 'right'; profit: number };

/**
 * Distribute BV (profit) up the binary tree: walk `referral_users` placement links from `userId`,
 * crediting each ancestor's `binary_carry` on the leg where the child sits (replaces `users.parent_id` / `left_bv` model).
 */
/** Max placement hops when rolling BV up the tree (avoids unbounded walks on bad data). */
const MAX_BV_PLACEMENT_DEPTH = 20;

export async function distributeBVConn(c: PoolConnection, userId: number, bv: number): Promise<BinaryAdd[]> {
  const raw = Number(bv);
  if (!Number.isFinite(raw) || raw <= 0) return [];
  /** Single JS rounding for audit JSON only; carry increments use DECIMAL in SQL. */
  const creditedBv = round2(raw);

  const uid = Math.trunc(Number(userId));
  if (!Number.isFinite(uid) || uid <= 0) return [];

  const [chainRows]: any = await c.query(
    `WITH RECURSIVE chain AS (
       SELECT
         ru.placement_parent_user_id AS anc_id,
         ru.placement_side AS leg_side,
         1 AS hop
       FROM referral_users ru
       WHERE ru.user_id = ?

       UNION ALL

       SELECT
         ru.placement_parent_user_id,
         ru.placement_side,
         ch.hop + 1
       FROM referral_users ru
       INNER JOIN chain ch ON ru.user_id = ch.anc_id
       WHERE ch.anc_id IS NOT NULL
         AND ch.leg_side IS NOT NULL
         AND ch.hop < ?
     )
     SELECT anc_id, leg_side, hop
     FROM chain
     WHERE anc_id IS NOT NULL AND leg_side IN ('left','right')
     ORDER BY hop ASC`,
    [uid, MAX_BV_PLACEMENT_DEPTH]
  );

  const rows = Array.isArray(chainRows) ? chainRows : [];
  if (!rows.length) return [];

  const adds: BinaryAdd[] = rows.map((r: { anc_id: number; leg_side: string }) => ({
    ancestorUserId: Number(r.anc_id),
    leg: String(r.leg_side) === 'right' ? ('right' as const) : ('left' as const),
    profit: creditedBv
  }));

  const uniqIds = [...new Set(adds.map((a) => a.ancestorUserId))].filter((id) => Number.isFinite(id) && id > 0);
  if (!uniqIds.length) return [];

  const placeholders = uniqIds.map(() => '(?,0,0)').join(',');
  await c.query(
    `INSERT IGNORE INTO binary_carry (user_id, left_profit_carry, right_profit_carry) VALUES ${placeholders}`,
    uniqIds
  );

  const leftIds = [...new Set(adds.filter((a) => a.leg === 'left').map((a) => a.ancestorUserId))];
  const rightIds = [...new Set(adds.filter((a) => a.leg === 'right').map((a) => a.ancestorUserId))];

  if (leftIds.length) {
    const ph = leftIds.map(() => '?').join(',');
    await c.query(
      `UPDATE binary_carry SET
         left_profit_carry = ROUND(left_profit_carry + CAST(? AS DECIMAL(14,2)), 2),
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id IN (${ph})`,
      [creditedBv, ...leftIds]
    );
  }
  if (rightIds.length) {
    const ph = rightIds.map(() => '?').join(',');
    await c.query(
      `UPDATE binary_carry SET
         right_profit_carry = ROUND(right_profit_carry + CAST(? AS DECIMAL(14,2)), 2),
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id IN (${ph})`,
      [creditedBv, ...rightIds]
    );
  }

  return adds;
}

/** Standalone BV distribution (own transaction). Prefer `distributeBVConn` inside order commission flow. */
export async function distributeBV(userId: number, bv: number): Promise<void> {
  await ensureReferralSchemaExists();
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    await distributeBVConn(c, userId, bv);
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export type ProcessOrderCommissionsResult = {
  processed: boolean;
  reason?: string;
};

/**
 * Commission + BV for one order. **Transaction:** caller must own `beginTransaction` / `commit` on `c`.
 */
export async function processDeliveredOrderCommissionsConn(
  c: PoolConnection,
  orderId: number
): Promise<ProcessOrderCommissionsResult> {
  const [ords]: any = await c.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
  const order = ords[0];
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.commission_processed_at) return { processed: false, reason: 'already_processed' };

  const s = await getCompensationSettingsForUpdate(c);
  const snap = snapshotString(s);

  const profit = round2(Number(order.subtotal || 0));
  const payOk = paymentEligibleForCommissions(order);
  const statusOk = statusEligibleForTrigger(order, s.trigger_stage);

  if (!payOk) {
    await c.query(
      `UPDATE orders SET commission_status = 'skipped_pending_payment', profit_amount = ? WHERE id = ?`,
      [profit, orderId]
    );
    return { processed: false, reason: 'pending_payment' };
  }

  if (!statusOk) {
    return { processed: false, reason: 'wrong_trigger_stage' };
  }

  const minProfit = round2(Number(s.minimum_order_profit));
  if (profit < minProfit) {
    await c.query(
      `UPDATE orders SET commission_processed_at = CURRENT_TIMESTAMP, commission_status = 'skipped_below_min_profit', profit_amount = ? WHERE id = ?`,
      [profit, orderId]
    );
    return { processed: true, reason: 'below_min_profit' };
  }

  if (profit <= 0) {
    await c.query(
      `UPDATE orders SET commission_processed_at = CURRENT_TIMESTAMP, commission_status = 'skipped_zero_profit', profit_amount = 0 WHERE id = ?`,
      [orderId]
    );
    return { processed: true, reason: 'zero_profit' };
  }

  const buyerId = Number(order.user_id);
  const orderNumber = String(order.order_number || orderId);

  const binaryAdds: BinaryAdd[] = [];

  const [refRows]: any = await c.query(
    'SELECT sponsor_user_id FROM referral_users WHERE user_id = ? LIMIT 1',
    [buyerId]
  );
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
    await c.query(
      `INSERT INTO commission_transactions (
         user_id, order_id, commission_type, gross_amount, amount, wallet_amount, ceiling_blocked_amount, wallet_transaction_id, metadata_json, settings_snapshot_json
       ) VALUES (?, ?, 'direct_referral', ?, ?, ?, 0, ?, ?, ?)`,
      [
        sponsorId,
        orderId,
        profit,
        directCommission,
        directCommission,
        walletTransactionId,
        JSON.stringify({ buyerUserId: buyerId, orderNumber }),
        snap
      ]
    );
    await createNotification(
      c,
      sponsorId,
      `Direct referral commission ₹${directCommission} credited (order #${orderNumber}).`
    );
  }

  if (s.binary_income_enabled && s.carry_forward_enabled) {
    const adds = await distributeBVConn(c, buyerId, profit);
    binaryAdds.push(...adds);
  }

  const audit = {
    profit,
    binaryAdds,
    processedAt: new Date().toISOString()
  };

  await c.query(
    `UPDATE orders SET profit_amount = ?, commission_processed_at = CURRENT_TIMESTAMP, commission_status = 'completed', commission_audit_json = ? WHERE id = ?`,
    [profit, JSON.stringify(audit), orderId]
  );

  logger.info('Order commissions processed', { orderId, buyerId, profitInr: profit });
  return { processed: true };
}

/** Loads its own connection and wraps {@link processDeliveredOrderCommissionsConn} in a transaction. */
export async function processDeliveredOrderCommissions(orderId: number): Promise<ProcessOrderCommissionsResult> {
  await ensureReferralSchemaExists();

  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const r = await processDeliveredOrderCommissionsConn(c, orderId);
    await c.commit();
    return r;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

/** Reverses wallet + carry + commission rows for an order. **Transaction:** must run on an open `c`. */
async function reverseCommissionProcessing(c: PoolConnection, orderId: number) {
  const [ords]: any = await c.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
  const order = ords[0];
  if (!order?.commission_processed_at) return;
  const auditRaw = order.commission_audit_json;
  let audit: {
    profit?: number;
    binaryAdds?: BinaryAdd[];
    /** @deprecated Legacy order-flow binary; cron-only now. */
    matchEvents?: Array<{ ancestorUserId: number; matchedProfit: number }>;
  } | null = null;
  try {
    audit = typeof auditRaw === 'string' ? JSON.parse(auditRaw) : auditRaw;
  } catch {
    audit = null;
  }

  const [txRows]: any = await c.query(
    `SELECT * FROM commission_transactions WHERE order_id = ? ORDER BY id DESC`,
    [orderId]
  );

  for (const tx of txRows as any[]) {
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
    let meta: any = {};
    try {
      meta = tx.metadata_json ? (typeof tx.metadata_json === 'string' ? JSON.parse(tx.metadata_json) : tx.metadata_json) : {};
    } catch {
      meta = {};
    }
    const sd = String(meta.summaryDate || '');
    const discarded = Boolean(meta.discarded);
    if (typ === 'binary_match' && sd) {
      const paidPart = walletAmt > 0 ? walletAmt : 0;
      await c.query(
        `UPDATE binary_daily_summary SET
           binary_paid_total = GREATEST(0, binary_paid_total - ?),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND summary_date = ?`,
        [paidPart, Number(tx.user_id), sd]
      );
    }
    if (typ === 'binary_ceiling_hold' && sd && !discarded) {
      const blocked = round2(Number(tx.ceiling_blocked_amount || 0));
      await c.query(
        `UPDATE binary_daily_summary SET
           ceiling_blocked_total = GREATEST(0, ceiling_blocked_total - ?),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND summary_date = ?`,
        [blocked, Number(tx.user_id), sd]
      );
    }
  }

  if (audit?.matchEvents?.length) {
    for (const ev of [...audit.matchEvents].reverse()) {
      const m = round2(Number(ev.matchedProfit || 0));
      if (m <= 0) continue;
      await ensureBinaryCarryRow(c, ev.ancestorUserId);
      await c.query(
        `UPDATE binary_carry SET
           left_profit_carry = left_profit_carry + ?,
           right_profit_carry = right_profit_carry + ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [m, m, ev.ancestorUserId]
      );
    }
  }

  if (audit?.binaryAdds?.length) {
    for (const add of audit.binaryAdds) {
      const p = round2(Number(add.profit || 0));
      if (p <= 0) continue;
      await ensureBinaryCarryRow(c, add.ancestorUserId);
      if (add.leg === 'left') {
        await c.query(
          `UPDATE binary_carry SET left_profit_carry = GREATEST(0, left_profit_carry - ?), updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          [p, add.ancestorUserId]
        );
      } else {
        await c.query(
          `UPDATE binary_carry SET right_profit_carry = GREATEST(0, right_profit_carry - ?), updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          [p, add.ancestorUserId]
        );
      }
    }
  }

  await c.query(`DELETE FROM commission_transactions WHERE order_id = ?`, [orderId]);
  await c.query(
    `UPDATE orders SET commission_processed_at = NULL, commission_status = NULL, commission_audit_json = NULL WHERE id = ?`,
    [orderId]
  );
}

/**
 * Refund path: reverses commissions when settings allow. **Transaction:** `c` must already be in
 * `beginTransaction` (e.g. `adminUpdateOrderStatus`).
 */
export async function reverseOrderCommissionsIfConfigured(c: PoolConnection, orderId: number) {
  const s = await getCompensationSettings();
  if (!s.refund_reversal_enabled) return;
  const [ords]: any = await c.query('SELECT commission_processed_at FROM orders WHERE id = ? FOR UPDATE', [orderId]);
  if (ords[0]?.commission_processed_at) {
    await reverseCommissionProcessing(c, orderId);
  }
}

export async function adminRecalculateOrderCommissions(orderId: number, force: boolean) {
  await ensureReferralSchemaExists();

  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [ords]: any = await c.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!ords[0]) throw new ApiError(404, 'Order not found');
    const st = String(ords[0].status);
    if (st === 'cancelled' || st === 'returned') throw new ApiError(400, 'Invalid order status for commissions');

    if (ords[0].commission_processed_at) {
      if (!force) throw new ApiError(409, 'Commissions already processed. Pass force=true to reverse and re-run.');
      await reverseCommissionProcessing(c, orderId);
    }

    const r = await processDeliveredOrderCommissionsConn(c, orderId);
    await c.commit();
    return r;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
