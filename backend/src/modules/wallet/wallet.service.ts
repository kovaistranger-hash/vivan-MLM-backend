import type { PoolConnection } from 'mysql2/promise';
import { pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';

export type WalletTxType =
  | 'credit'
  | 'debit'
  | 'refund'
  | 'admin_credit'
  | 'admin_debit'
  | 'order_payment'
  | 'order_refund'
  | 'commission_credit'
  | 'bonus_credit'
  | 'withdrawal_hold'
  | 'withdrawal_paid'
  | 'withdrawal_reversed'
  | 'withdrawal_cancelled';

function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export async function getOrCreateWallet(
  userId: number,
  conn?: PoolConnection
): Promise<{ id: number; balance: number; held_balance: number; is_active: number; is_locked?: number }> {
  const run = async (c: PoolConnection) => {
    const [rows]: any = await c.query(
      'SELECT id, balance, held_balance, is_active, COALESCE(is_locked, 0) AS is_locked FROM wallets WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (rows[0])
      return { ...rows[0], held_balance: Number(rows[0].held_balance ?? 0), is_locked: Number(rows[0].is_locked ?? 0) };
    try {
      const [ins]: any = await c.query(
        'INSERT INTO wallets (user_id, balance, held_balance, is_active, is_locked, checkout_intent_amount) VALUES (?, 0, 0, 1, 0, 0)',
        [userId]
      );
      return { id: ins.insertId, balance: 0, held_balance: 0, is_active: 1, is_locked: 0 };
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        const [again]: any = await c.query(
          'SELECT id, balance, held_balance, is_active, COALESCE(is_locked, 0) AS is_locked FROM wallets WHERE user_id = ? LIMIT 1',
          [userId]
        );
        if (again[0])
          return { ...again[0], held_balance: Number(again[0].held_balance ?? 0), is_locked: Number(again[0].is_locked ?? 0) };
      }
      throw e;
    }
  };
  if (conn) return run(conn);
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const w = await run(c);
    await c.commit();
    return w;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function getWalletBalance(userId: number): Promise<number> {
  const w = await getOrCreateWallet(userId);
  return roundMoney(Number(w.balance));
}

async function insertLedgerRow(
  c: PoolConnection,
  input: {
    walletId: number;
    userId: number;
    type: WalletTxType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    referenceType?: string | null;
    referenceId?: number | null;
    description?: string | null;
    metadata?: unknown;
    createdBy?: number | null;
  }
): Promise<number> {
  const [res]: any = await c.query(
    `INSERT INTO wallet_transactions (
      wallet_id, user_id, type, amount, balance_before, balance_after,
      reference_type, reference_id, description, metadata_json, created_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.walletId,
      input.userId,
      input.type,
      input.amount,
      input.balanceBefore,
      input.balanceAfter,
      input.referenceType ?? null,
      input.referenceId ?? null,
      input.description ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.createdBy ?? null
    ]
  );
  return Number(res.insertId);
}

export async function creditWallet(
  c: PoolConnection,
  userId: number,
  amount: number,
  type: WalletTxType,
  opts: {
    referenceType?: string | null;
    referenceId?: number | null;
    description?: string | null;
    metadata?: unknown;
    createdBy?: number | null;
  }
): Promise<{ balanceAfter: number; walletTransactionId: number }> {
  const amt = roundMoney(amount);
  if (amt <= 0) throw new ApiError(400, 'Credit amount must be positive');

  const [wRows]: any = await c.query(
    'SELECT id, balance, held_balance, is_active, COALESCE(is_locked, 0) AS is_locked FROM wallets WHERE user_id = ? FOR UPDATE',
    [userId]
  );
  if (!wRows[0]) throw new ApiError(400, 'Wallet not found');
  if (!wRows[0].is_active) throw new ApiError(400, 'Wallet is disabled');

  const locked = Number(wRows[0].is_locked ?? 0) === 1;
  if (locked) {
    const inbound: WalletTxType[] = [
      'commission_credit',
      'bonus_credit',
      'refund',
      'admin_credit',
      'order_refund',
      'credit'
    ];
    if (!inbound.includes(type)) {
      throw new ApiError(403, 'Wallet is frozen for compliance review. Credits are restricted; contact support.');
    }
  }

  const before = roundMoney(Number(wRows[0].balance));
  const after = roundMoney(before + amt);
  await c.query('UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [after, wRows[0].id]);
  const walletTransactionId = await insertLedgerRow(c, {
    walletId: wRows[0].id,
    userId,
    type,
    amount: amt,
    balanceBefore: before,
    balanceAfter: after,
    referenceType: opts.referenceType,
    referenceId: opts.referenceId,
    description: opts.description,
    metadata: opts.metadata,
    createdBy: opts.createdBy
  });
  return { balanceAfter: after, walletTransactionId };
}

export async function debitWallet(
  c: PoolConnection,
  userId: number,
  amount: number,
  type: WalletTxType,
  opts: {
    referenceType?: string | null;
    referenceId?: number | null;
    description?: string | null;
    metadata?: unknown;
    createdBy?: number | null;
    allowNegative?: boolean;
  }
) {
  const amt = roundMoney(amount);
  if (amt <= 0) throw new ApiError(400, 'Debit amount must be positive');

  const [wRows]: any = await c.query(
    'SELECT id, balance, held_balance, is_active, COALESCE(is_locked, 0) AS is_locked FROM wallets WHERE user_id = ? FOR UPDATE',
    [userId]
  );
  if (!wRows[0]) throw new ApiError(400, 'Wallet not found');
  if (!wRows[0].is_active) throw new ApiError(400, 'Wallet is disabled');

  const locked = Number(wRows[0].is_locked ?? 0) === 1;
  if (locked && !(type === 'admin_debit' && opts.createdBy != null)) {
    throw new ApiError(403, 'Wallet is frozen for compliance review. Outgoing debits are blocked.');
  }

  const before = roundMoney(Number(wRows[0].balance));
  const after = roundMoney(before - amt);
  if (after < 0 && !opts.allowNegative) {
    throw new ApiError(400, 'Insufficient wallet balance');
  }

  await c.query('UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [after, wRows[0].id]);
  await insertLedgerRow(c, {
    walletId: wRows[0].id,
    userId,
    type,
    amount: amt,
    balanceBefore: before,
    balanceAfter: after,
    referenceType: opts.referenceType,
    referenceId: opts.referenceId,
    description: opts.description,
    metadata: opts.metadata,
    createdBy: opts.createdBy
  });
  return after;
}

export async function refundToWallet(
  c: PoolConnection,
  userId: number,
  amount: number,
  opts: {
    referenceType?: string | null;
    referenceId?: number | null;
    description?: string | null;
    metadata?: unknown;
    createdBy?: number | null;
  }
) {
  return (await creditWallet(c, userId, amount, 'refund', opts)).balanceAfter;
}

/** Credits wallet using `order_refund` type (preferred for order-linked refunds). */
export async function creditOrderRefundToWallet(
  c: PoolConnection,
  userId: number,
  amount: number,
  opts: {
    orderId: number;
    description?: string | null;
    metadata?: unknown;
    createdBy?: number | null;
  }
) {
  const amt = roundMoney(amount);
  if (amt <= 0) throw new ApiError(400, 'Refund amount must be positive');

  const [dup]: any = await c.query(
    `SELECT id FROM wallet_transactions WHERE reference_type = 'order' AND reference_id = ? AND type = 'order_refund' LIMIT 1`,
    [opts.orderId]
  );
  if (dup[0]) throw new ApiError(400, 'This order was already refunded to wallet');

  return (
    await creditWallet(c, userId, amt, 'order_refund', {
      referenceType: 'order',
      referenceId: opts.orderId,
      description: opts.description ?? `Refund to wallet for order #${opts.orderId}`,
      metadata: opts.metadata,
      createdBy: opts.createdBy
    })
  ).balanceAfter;
}

export async function listWalletTransactions(params: {
  userId: number;
  page: number;
  pageSize: number;
}) {
  const limit = params.pageSize;
  const offset = (params.page - 1) * limit;
  const items = await query<any[]>(
    `SELECT * FROM wallet_transactions WHERE user_id = :userId
     ORDER BY id DESC LIMIT :limit OFFSET :offset`,
    { userId: params.userId, limit, offset }
  );
  const countRows = await query<{ total: number }[]>(
    'SELECT COUNT(*) AS total FROM wallet_transactions WHERE user_id = :userId',
    { userId: params.userId }
  );
  const total = Number(countRows[0]?.total ?? 0);
  return { items, total };
}

export async function setCheckoutIntent(userId: number, amount: number, maxAllowable: number, balance: number) {
  const w = await getOrCreateWallet(userId);
  if (Number(w.is_locked ?? 0) === 1) {
    throw new ApiError(403, 'Wallet is frozen for compliance review.');
  }
  const want = roundMoney(amount);
  const maxA = roundMoney(maxAllowable);
  const bal = roundMoney(balance);
  if (want < 0) throw new ApiError(400, 'Amount cannot be negative');
  if (want > bal) throw new ApiError(400, 'Amount exceeds wallet balance');
  if (want > maxA) throw new ApiError(400, 'Amount exceeds payable total');
  const applied = Math.min(want, maxA, bal);
  await query(
    'UPDATE wallets SET checkout_intent_amount = :a, updated_at = CURRENT_TIMESTAMP WHERE user_id = :u',
    { a: applied, u: userId }
  );
  return applied;
}

export async function clearCheckoutIntent(userId: number) {
  await query('UPDATE wallets SET checkout_intent_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = :u', { u: userId });
}

export async function getWalletSummaryForUser(userId: number) {
  const w = await getOrCreateWallet(userId);
  const recent = await query<any[]>(
    `SELECT id, type, amount, balance_after, description, created_at
     FROM wallet_transactions WHERE user_id = :userId ORDER BY id DESC LIMIT 8`,
    { userId }
  );
  return {
    balance: roundMoney(Number(w.balance)),
    heldBalance: roundMoney(Number(w.held_balance ?? 0)),
    isActive: !!w.is_active,
    isLocked: Number((w as { is_locked?: number }).is_locked ?? 0) === 1,
    checkoutIntentAmount: roundMoney(
      Number((await query<any[]>('SELECT checkout_intent_amount AS c FROM wallets WHERE user_id = :u LIMIT 1', { u: userId }))[0]?.c ?? 0)
    ),
    recentTransactions: recent
  };
}

/** Move gross amount from balance into held_balance; ledger: withdrawal_hold. */
export async function applyWithdrawalHold(
  c: PoolConnection,
  userId: number,
  grossAmount: number,
  withdrawalRequestId: number
): Promise<{ walletTransactionId: number; balanceAfter: number }> {
  const gross = roundMoney(grossAmount);
  if (gross <= 0) throw new ApiError(400, 'Invalid withdrawal amount');

  const [wRows]: any = await c.query(
    'SELECT id, balance, held_balance, is_active, COALESCE(is_locked, 0) AS is_locked FROM wallets WHERE user_id = ? FOR UPDATE',
    [userId]
  );
  if (!wRows[0]) throw new ApiError(400, 'Wallet not found');
  if (!wRows[0].is_active) throw new ApiError(400, 'Wallet is disabled');
  if (Number(wRows[0].is_locked ?? 0) === 1) {
    throw new ApiError(403, 'Wallet is frozen for compliance review. Withdrawals are not available.');
  }

  const before = roundMoney(Number(wRows[0].balance));
  const heldBefore = roundMoney(Number(wRows[0].held_balance ?? 0));
  if (before < gross) throw new ApiError(400, 'Insufficient wallet balance');

  const after = roundMoney(before - gross);
  const heldAfter = roundMoney(heldBefore + gross);
  await c.query(
    'UPDATE wallets SET balance = ?, held_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [after, heldAfter, wRows[0].id]
  );
  const walletTransactionId = await insertLedgerRow(c, {
    walletId: wRows[0].id,
    userId,
    type: 'withdrawal_hold',
    amount: gross,
    balanceBefore: before,
    balanceAfter: after,
    referenceType: 'withdrawal',
    referenceId: withdrawalRequestId,
    description: `Withdrawal hold #${withdrawalRequestId}`
  });
  return { walletTransactionId, balanceAfter: after };
}

/** Release held funds after payout (no change to available balance). */
export async function applyWithdrawalPaidRelease(
  c: PoolConnection,
  userId: number,
  grossHeldAmount: number,
  withdrawalRequestId: number,
  netAmount: number
): Promise<number> {
  const gross = roundMoney(grossHeldAmount);
  const net = roundMoney(netAmount);
  const [wRows]: any = await c.query(
    'SELECT id, balance, held_balance, is_active FROM wallets WHERE user_id = ? FOR UPDATE',
    [userId]
  );
  if (!wRows[0]) throw new ApiError(400, 'Wallet not found');
  const bal = roundMoney(Number(wRows[0].balance));
  const held = roundMoney(Number(wRows[0].held_balance ?? 0));
  if (held < gross) throw new ApiError(400, 'Insufficient held balance');

  const heldAfter = roundMoney(held - gross);
  await c.query(
    'UPDATE wallets SET held_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [heldAfter, wRows[0].id]
  );
  return insertLedgerRow(c, {
    walletId: wRows[0].id,
    userId,
    type: 'withdrawal_paid',
    amount: net,
    balanceBefore: bal,
    balanceAfter: bal,
    referenceType: 'withdrawal',
    referenceId: withdrawalRequestId,
    description: `Withdrawal paid #${withdrawalRequestId} (net ₹${net})`
  });
}

/** Restore gross from hold back to balance (reject or user cancel). */
export async function applyWithdrawalHoldReleaseToBalance(
  c: PoolConnection,
  userId: number,
  grossAmount: number,
  withdrawalRequestId: number,
  ledgerType: 'withdrawal_reversed' | 'withdrawal_cancelled'
): Promise<number> {
  const gross = roundMoney(grossAmount);
  const [wRows]: any = await c.query(
    'SELECT id, balance, held_balance, is_active FROM wallets WHERE user_id = ? FOR UPDATE',
    [userId]
  );
  if (!wRows[0]) throw new ApiError(400, 'Wallet not found');
  const before = roundMoney(Number(wRows[0].balance));
  const held = roundMoney(Number(wRows[0].held_balance ?? 0));
  if (held < gross) throw new ApiError(400, 'Insufficient held balance');

  const after = roundMoney(before + gross);
  const heldAfter = roundMoney(held - gross);
  await c.query(
    'UPDATE wallets SET balance = ?, held_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [after, heldAfter, wRows[0].id]
  );
  return insertLedgerRow(c, {
    walletId: wRows[0].id,
    userId,
    type: ledgerType,
    amount: gross,
    balanceBefore: before,
    balanceAfter: after,
    referenceType: 'withdrawal',
    referenceId: withdrawalRequestId,
    description:
      ledgerType === 'withdrawal_cancelled'
        ? `Withdrawal cancelled #${withdrawalRequestId}`
        : `Withdrawal reversed #${withdrawalRequestId}`
  });
}

export async function hasOrderWalletPayment(orderId: number): Promise<boolean> {
  const rows = await query<{ id: number }[]>(
    `SELECT id FROM wallet_transactions WHERE reference_type = 'order' AND reference_id = :oid AND type = 'order_payment' LIMIT 1`,
    { oid: orderId }
  );
  return rows.length > 0;
}

export async function debitWalletForOrder(
  c: PoolConnection,
  userId: number,
  orderId: number,
  amount: number,
  description: string
) {
  const [dup]: any = await c.query(
    `SELECT id FROM wallet_transactions WHERE reference_type = 'order' AND reference_id = ? AND type = 'order_payment' LIMIT 1 FOR UPDATE`,
    [orderId]
  );
  if (dup[0]) {
    const [b]: any = await c.query('SELECT balance FROM wallets WHERE user_id = ? LIMIT 1', [userId]);
    return roundMoney(Number(b[0]?.balance ?? 0));
  }
  return debitWallet(c, userId, amount, 'order_payment', {
    referenceType: 'order',
    referenceId: orderId,
    description,
    allowNegative: false
  });
}

export async function clearCheckoutIntentConn(c: PoolConnection, userId: number) {
  await c.query('UPDATE wallets SET checkout_intent_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
}
