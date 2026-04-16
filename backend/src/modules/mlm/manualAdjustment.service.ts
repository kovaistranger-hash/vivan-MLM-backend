import type { PoolConnection } from 'mysql2/promise';
import { pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { getOrCreateWallet, creditWallet, debitWallet } from '../wallet/wallet.service.js';
import { getCompensationSettings, serializeSettingsSnapshot } from './compensationSettings.service.js';

function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export async function createManualAdjustment(input: {
  userId: number;
  orderId: number | null;
  adjustmentType: string;
  amount: number;
  action: 'credit' | 'debit';
  reason: string;
  applyToWallet: boolean;
  createdBy: number;
}) {
  const amt = round2(input.amount);
  if (amt <= 0) throw new ApiError(400, 'Amount must be positive');
  if (!input.reason?.trim()) throw new ApiError(400, 'Reason is required');

  const c = await pool.getConnection();
  try {
    await c.beginTransaction();

    const [insAdj]: any = await c.query(
      `INSERT INTO commission_manual_adjustments (
         user_id, order_id, adjustment_type, amount, action, reason, apply_to_wallet, created_by
       ) VALUES (?,?,?,?,?,?,?,?)`,
      [
        input.userId,
        input.orderId,
        input.adjustmentType.trim().slice(0, 80),
        amt,
        input.action,
        input.reason.trim().slice(0, 500),
        input.applyToWallet ? 1 : 0,
        input.createdBy
      ]
    );
    const adjId = Number(insAdj.insertId);

    let walletTxId: number | null = null;
    if (input.applyToWallet) {
      await getOrCreateWallet(input.userId, c);
      const settings = await getCompensationSettings();
      const snap = JSON.stringify(serializeSettingsSnapshot(settings));
      if (input.action === 'credit') {
        const { walletTransactionId } = await creditWallet(c, input.userId, amt, 'commission_credit', {
          referenceType: 'manual_adjustment',
          referenceId: adjId,
          description: `Manual adjustment: ${input.adjustmentType}`,
          metadata: { reason: input.reason },
          createdBy: input.createdBy
        });
        walletTxId = walletTransactionId;
      } else {
        await debitWallet(c, input.userId, amt, 'admin_debit', {
          referenceType: 'manual_adjustment',
          referenceId: adjId,
          description: `Manual adjustment: ${input.adjustmentType}`,
          metadata: { reason: input.reason },
          createdBy: input.createdBy
        });
        const [wrows]: any = await c.query(
          `SELECT id FROM wallet_transactions WHERE user_id = ? AND reference_type = 'manual_adjustment' AND reference_id = ? ORDER BY id DESC LIMIT 1`,
          [input.userId, adjId]
        );
        walletTxId = wrows[0] ? Number(wrows[0].id) : null;
      }

      const walletSigned = input.action === 'credit' ? amt : round2(-amt);
      const [insComm]: any = await c.query(
        `INSERT INTO commission_transactions (
           user_id, order_id, commission_type, gross_amount, amount, wallet_amount, ceiling_blocked_amount,
           wallet_transaction_id, metadata_json, settings_snapshot_json
         ) VALUES (?, ?, 'manual_adjustment', ?, ?, ?, 0, ?, ?, ?)`,
        [
          input.userId,
          input.orderId,
          amt,
          amt,
          walletSigned,
          walletTxId,
          JSON.stringify({
            adjustmentId: adjId,
            adjustmentType: input.adjustmentType,
            reason: input.reason,
            action: input.action
          }),
          snap
        ]
      );
      const commId = Number(insComm.insertId);
      await c.query(`UPDATE commission_manual_adjustments SET wallet_transaction_id = ?, commission_transaction_id = ? WHERE id = ?`, [
        walletTxId,
        commId,
        adjId
      ]);
    }

    await c.commit();
    return { id: adjId };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function listManualAdjustments(params: { page: number; pageSize: number; userId?: number }) {
  const offset = (params.page - 1) * params.pageSize;
  const where = ['1=1'];
  const vals: Record<string, unknown> = { limit: params.pageSize, offset };
  if (params.userId) {
    where.push('m.user_id = :uid');
    vals.uid = params.userId;
  }
  const w = where.join(' AND ');
  const items = await query<any[]>(
    `SELECT m.*, u.email AS user_email, u.name AS user_name, a.email AS created_by_email
     FROM commission_manual_adjustments m
     INNER JOIN users u ON u.id = m.user_id
     INNER JOIN users a ON a.id = m.created_by
     WHERE ${w}
     ORDER BY m.id DESC
     LIMIT :limit OFFSET :offset`,
    vals
  );
  const { limit, offset: _o, ...countVals } = vals;
  const countRows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM commission_manual_adjustments m WHERE ${w}`,
    countVals
  );
  return { items, total: Number(countRows[0]?.total || 0) };
}

export async function createCarryAdjustment(
  c: PoolConnection,
  input: {
    userId: number;
    side: 'left' | 'right' | 'reset';
    delta: number;
    reason: string;
    createdBy: number;
  }
) {
  await c.query(`INSERT IGNORE INTO binary_carry (user_id) VALUES (?)`, [input.userId]);
  const [rows]: any = await c.query('SELECT left_profit_carry, right_profit_carry FROM binary_carry WHERE user_id = ? FOR UPDATE', [
    input.userId
  ]);
  if (!rows[0]) throw new ApiError(404, 'User carry not found');

  let left = round2(Number(rows[0].left_profit_carry));
  let right = round2(Number(rows[0].right_profit_carry));
  const d = round2(input.delta);
  let auditAmount = Math.abs(d);

  if (input.side === 'reset') {
    auditAmount = round2(Math.abs(left) + Math.abs(right));
    left = 0;
    right = 0;
  } else if (input.side === 'left') {
    left = round2(left + d);
  } else {
    right = round2(right + d);
  }

  await c.query(
    `UPDATE binary_carry SET left_profit_carry = ?, right_profit_carry = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    [left, right, input.userId]
  );

  await c.query(
    `INSERT INTO commission_manual_adjustments (
       user_id, order_id, adjustment_type, amount, action, reason, apply_to_wallet, created_by, metadata_json
     ) VALUES (?, NULL, ?, ?, 'credit', ?, 0, ?, ?)`,
    [
      input.userId,
      input.side === 'reset' ? 'binary_carry_reset' : `binary_carry_${input.side}`,
      auditAmount,
      input.reason.slice(0, 500),
      input.createdBy,
      JSON.stringify({ side: input.side, delta: input.delta, leftAfter: left, rightAfter: right })
    ]
  );
}
