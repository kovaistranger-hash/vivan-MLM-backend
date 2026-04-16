import { pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAuditLog } from '../compliance/auditLog.service.js';
import { onWithdrawalMarkedPaid } from './withdrawalPayout.service.js';
import { evaluateFraudRiskForUser, isWalletFraudLocked } from '../admin/fraud.service.js';
import { assertWithdrawalKycEligible } from '../kyc/kyc.service.js';
import { assertWithdrawalScoreAllowed } from '../scoring/scoring.service.js';
import {
  applyWithdrawalHold,
  applyWithdrawalHoldReleaseToBalance,
  applyWithdrawalPaidRelease,
  getOrCreateWallet
} from './wallet.service.js';
import { createNotification } from '../notifications/notification.service.js';
import { computeWithdrawalFee, type WithdrawalSettingsRow } from './withdrawalSettings.service.js';

function assertBankMatchesSettings(acct: Record<string, unknown>, s: WithdrawalSettingsRow) {
  const bankPair = !!(acct.account_number && acct.ifsc_code);
  const upiOk = !!(acct.upi_id && String(acct.upi_id).trim());
  if (!bankPair && !upiOk) {
    throw new ApiError(400, 'Bank profile must include IFSC + account number and/or UPI ID');
  }
  let ok = false;
  if (s.allow_bank_transfer && bankPair) ok = true;
  if (s.allow_upi && upiOk) ok = true;
  if (!ok) throw new ApiError(400, 'This bank profile does not match allowed withdrawal methods');
}

export async function listUserWithdrawals(userId: number, page: number, pageSize: number) {
  const limit = pageSize;
  const offset = (page - 1) * limit;
  const items = await query<any[]>(
    `SELECT wr.*, ba.bank_name, ba.account_holder_name, ba.account_number, ba.ifsc_code, ba.upi_id
     FROM withdrawal_requests wr
     INNER JOIN bank_accounts ba ON ba.id = wr.bank_account_id
     WHERE wr.user_id = :u
     ORDER BY wr.id DESC
     LIMIT :limit OFFSET :offset`,
    { u: userId, limit, offset }
  );
  const countRows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM withdrawal_requests WHERE user_id = :u`,
    { u: userId }
  );
  return { items, total: Number(countRows[0]?.total ?? 0) };
}

export async function createWithdrawalRequest(
  userId: number,
  input: { bankAccountId: number; amount: number; notes?: string | null }
) {
  const gross = Math.round((Number(input.amount) + Number.EPSILON) * 100) / 100;
  if (gross <= 0) throw new ApiError(400, 'Invalid amount');

  const fraud = await evaluateFraudRiskForUser(userId);
  const FRAUD_WITHDRAW_BLOCK = 70;
  if (fraud.riskScore >= FRAUD_WITHDRAW_BLOCK || (await isWalletFraudLocked(userId))) {
    throw new ApiError(
      403,
      'Withdrawal is not available for this account pending compliance review. Please contact support.'
    );
  }

  await assertWithdrawalKycEligible(userId, gross);
  await assertWithdrawalScoreAllowed(userId);

  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    await getOrCreateWallet(userId, c);

    const [sRows]: any = await c.query('SELECT * FROM withdrawal_settings WHERE id = 1 FOR UPDATE');
    const s = sRows[0] as WithdrawalSettingsRow | undefined;
    if (!s) throw new ApiError(500, 'Withdrawal settings missing');

    const [uRows]: any = await c.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!uRows[0]) throw new ApiError(404, 'User not found');

    const [bRows]: any = await c.query(
      'SELECT * FROM bank_accounts WHERE id = ? AND user_id = ? FOR UPDATE',
      [input.bankAccountId, userId]
    );
    const bank = bRows[0];
    if (!bank) throw new ApiError(404, 'Bank account not found');

    const settingsRow: WithdrawalSettingsRow = {
      id: Number(s.id),
      min_withdrawal_amount: Number(s.min_withdrawal_amount),
      max_withdrawal_amount: s.max_withdrawal_amount != null ? Number(s.max_withdrawal_amount) : null,
      withdrawal_fee_type: s.withdrawal_fee_type,
      withdrawal_fee_value: Number(s.withdrawal_fee_value),
      kyc_required: Number(s.kyc_required),
      auto_approve: Number(s.auto_approve),
      allow_upi: Number(s.allow_upi),
      allow_bank_transfer: Number(s.allow_bank_transfer),
      one_pending_request_only: Number(s.one_pending_request_only),
      updated_at: s.updated_at,
      updated_by: s.updated_by != null ? Number(s.updated_by) : null
    };

    assertBankMatchesSettings(bank, settingsRow);

    if (Number(s.one_pending_request_only) === 1) {
      const [open]: any = await c.query(
        `SELECT id FROM withdrawal_requests
         WHERE user_id = ? AND status IN ('pending','approved') LIMIT 1 FOR UPDATE`,
        [userId]
      );
      if (open[0]) throw new ApiError(400, 'You already have an open withdrawal request');
    }

    if (gross < settingsRow.min_withdrawal_amount) {
      throw new ApiError(400, `Minimum withdrawal is ₹${settingsRow.min_withdrawal_amount}`);
    }
    if (settingsRow.max_withdrawal_amount != null && gross > settingsRow.max_withdrawal_amount) {
      throw new ApiError(400, `Maximum withdrawal is ₹${settingsRow.max_withdrawal_amount}`);
    }

    const { fee, net } = computeWithdrawalFee(gross, settingsRow);
    if (net <= 0) throw new ApiError(400, 'Withdrawal amount too low after fees');

    const [ins]: any = await c.query(
      `INSERT INTO withdrawal_requests (
         user_id, bank_account_id, amount, fee_amount, net_amount, status, notes
       ) VALUES (?,?,?,?,?,'pending',?)`,
      [userId, input.bankAccountId, gross, fee, net, input.notes?.trim() || null]
    );
    const withdrawalId = Number(ins.insertId);

    await applyWithdrawalHold(c, userId, gross, withdrawalId);

    if (Number(s.auto_approve) === 1) {
      await c.query(
        `UPDATE withdrawal_requests SET status = 'approved', processed_by = NULL, processed_at = NOW(), updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'pending'`,
        [withdrawalId]
      );
    }

    await c.commit();
    const autoApproved = Number(s.auto_approve) === 1;
    void createNotification(
      undefined,
      userId,
      autoApproved
        ? `Withdrawal request #${withdrawalId} for ₹${gross} submitted and approved.`
        : `Withdrawal request #${withdrawalId} for ₹${gross} submitted and is pending review.`
    ).catch(() => undefined);
    return getWithdrawalByIdForUser(userId, withdrawalId);
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function cancelWithdrawalRequest(userId: number, withdrawalId: number) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [rows]: any = await c.query(
      'SELECT * FROM withdrawal_requests WHERE id = ? AND user_id = ? FOR UPDATE',
      [withdrawalId, userId]
    );
    const wr = rows[0];
    if (!wr) throw new ApiError(404, 'Withdrawal not found');
    if (wr.status !== 'pending') throw new ApiError(400, 'Only pending withdrawals can be cancelled');

    const gross = Number(wr.amount);
    await applyWithdrawalHoldReleaseToBalance(c, userId, gross, withdrawalId, 'withdrawal_cancelled');

    await c.query(
      `UPDATE withdrawal_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [withdrawalId]
    );
    await c.commit();
    return getWithdrawalByIdForUser(userId, withdrawalId);
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function getWithdrawalByIdForUser(userId: number, id: number) {
  const rows = await query<any[]>(
    `SELECT wr.*, ba.bank_name, ba.account_holder_name, ba.account_number, ba.ifsc_code, ba.upi_id
     FROM withdrawal_requests wr
     INNER JOIN bank_accounts ba ON ba.id = wr.bank_account_id
     WHERE wr.id = :id AND wr.user_id = :u LIMIT 1`,
    { id, u: userId }
  );
  return rows[0] || null;
}

export async function adminListWithdrawals(params: {
  status?: string;
  userId?: number;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}) {
  const where: string[] = ['1=1'];
  const vals: Record<string, unknown> = {
    limit: params.pageSize,
    offset: (params.page - 1) * params.pageSize
  };
  if (params.status) {
    where.push('wr.status = :st');
    vals.st = params.status;
  }
  if (params.userId) {
    where.push('wr.user_id = :uid');
    vals.uid = params.userId;
  }
  if (params.from) {
    where.push('wr.created_at >= :from');
    vals.from = params.from;
  }
  if (params.to) {
    where.push('wr.created_at < DATE_ADD(:to, INTERVAL 1 DAY)');
    vals.to = params.to;
  }
  const w = where.join(' AND ');
  const items = await query<any[]>(
    `SELECT wr.*, u.email AS user_email, u.name AS user_name,
            ba.bank_name, ba.account_holder_name, ba.account_number, ba.ifsc_code, ba.upi_id
     FROM withdrawal_requests wr
     INNER JOIN users u ON u.id = wr.user_id
     INNER JOIN bank_accounts ba ON ba.id = wr.bank_account_id
     WHERE ${w}
     ORDER BY wr.id DESC
     LIMIT :limit OFFSET :offset`,
    vals
  );
  const { limit, offset, ...countVals } = vals;
  const countRows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM withdrawal_requests wr WHERE ${w}`,
    countVals
  );
  return { items, total: Number(countRows[0]?.total ?? 0) };
}

export async function adminGetWithdrawal(id: number) {
  const rows = await query<any[]>(
    `SELECT wr.*, u.email AS user_email, u.name AS user_name,
            ba.bank_name, ba.account_holder_name, ba.account_number, ba.ifsc_code, ba.upi_id, ba.branch_name
     FROM withdrawal_requests wr
     INNER JOIN users u ON u.id = wr.user_id
     INNER JOIN bank_accounts ba ON ba.id = wr.bank_account_id
     WHERE wr.id = :id LIMIT 1`,
    { id }
  );
  if (!rows[0]) return null;
  const wid = rows[0].user_id;
  await getOrCreateWallet(wid);
  const [wRows]: any = await pool.query(
    'SELECT id, user_id, balance, held_balance, is_active, checkout_intent_amount FROM wallets WHERE user_id = ? LIMIT 1',
    [wid]
  );
  return { withdrawal: rows[0], wallet: wRows[0] || null };
}

export async function adminApproveWithdrawal(withdrawalId: number, adminUserId: number, remarks?: string | null) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [rows]: any = await c.query(
      'SELECT * FROM withdrawal_requests WHERE id = ? FOR UPDATE',
      [withdrawalId]
    );
    const wr = rows[0];
    if (!wr) throw new ApiError(404, 'Withdrawal not found');
    if (wr.status !== 'pending') throw new ApiError(400, 'Only pending requests can be approved');

    const [updAp]: any = await c.query(
      `UPDATE withdrawal_requests SET
         status = 'approved',
         processed_by = ?,
         processed_at = NOW(),
         admin_remarks = COALESCE(?, admin_remarks),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
      [adminUserId, remarks?.trim() || null, withdrawalId]
    );
    if (Number(updAp.affectedRows || 0) !== 1) {
      throw new ApiError(409, 'Withdrawal is not pending or was already processed');
    }
    await c.commit();
    return adminGetWithdrawal(withdrawalId);
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function adminRejectWithdrawal(
  withdrawalId: number,
  adminUserId: number,
  remarks?: string | null
) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [rows]: any = await c.query(
      'SELECT * FROM withdrawal_requests WHERE id = ? FOR UPDATE',
      [withdrawalId]
    );
    const wr = rows[0];
    if (!wr) throw new ApiError(404, 'Withdrawal not found');
    if (wr.status !== 'pending' && wr.status !== 'approved') {
      throw new ApiError(400, 'Request cannot be rejected in its current state');
    }

    const gross = Number(wr.amount);
    const uid = Number(wr.user_id);
    await applyWithdrawalHoldReleaseToBalance(c, uid, gross, withdrawalId, 'withdrawal_reversed');

    const [upd]: any = await c.query(
      `UPDATE withdrawal_requests SET
         status = 'rejected',
         processed_by = ?,
         processed_at = NOW(),
         admin_remarks = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('pending','approved')`,
      [adminUserId, remarks?.trim() || null, withdrawalId]
    );
    if (Number(upd.affectedRows || 0) !== 1) {
      throw new ApiError(409, 'Withdrawal state changed; please refresh');
    }
    await c.commit();
    return adminGetWithdrawal(withdrawalId);
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function adminMarkWithdrawalPaid(withdrawalId: number, adminUserId: number, remarks?: string | null) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [rows]: any = await c.query(
      'SELECT * FROM withdrawal_requests WHERE id = ? FOR UPDATE',
      [withdrawalId]
    );
    const wr = rows[0];
    if (!wr) throw new ApiError(404, 'Withdrawal not found');
    if (wr.status !== 'approved') throw new ApiError(400, 'Only approved requests can be marked paid');

    const gross = Number(wr.amount);
    const net = Number(wr.net_amount);
    const uid = Number(wr.user_id);
    await applyWithdrawalPaidRelease(c, uid, gross, withdrawalId, net);

    const [updPaid]: any = await c.query(
      `UPDATE withdrawal_requests SET
         status = 'paid',
         processed_by = ?,
         processed_at = NOW(),
         admin_remarks = COALESCE(?, admin_remarks),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'approved'`,
      [adminUserId, remarks?.trim() || null, withdrawalId]
    );
    if (Number(updPaid.affectedRows || 0) !== 1) {
      throw new ApiError(409, 'Withdrawal state changed; please refresh');
    }
    await c.commit();
    void createNotification(
      undefined,
      uid,
      `Withdrawal #${withdrawalId} marked paid. Net ₹${net} released from your wallet hold.`
    ).catch(() => undefined);
    void writeAuditLog(`withdrawal_marked_paid:${withdrawalId}`, adminUserId).catch(() => undefined);
    void onWithdrawalMarkedPaid(withdrawalId).catch((err) => console.error('[withdrawalPayout]', err));
    return adminGetWithdrawal(withdrawalId);
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
