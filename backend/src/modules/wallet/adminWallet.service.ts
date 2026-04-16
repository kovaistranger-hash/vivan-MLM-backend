import { pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { creditWallet, debitWallet, getOrCreateWallet } from './wallet.service.js';

export async function adminListWallets(params: { search?: string; page: number; pageSize: number }) {
  const where = [`r.slug = 'customer'`];
  const vals: Record<string, unknown> = {
    limit: params.pageSize,
    offset: (params.page - 1) * params.pageSize
  };
  if (params.search) {
    where.push('(u.name LIKE :s OR u.email LIKE :s)');
    vals.s = `%${params.search}%`;
  }
  const sql = `
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      u.email AS user_email,
      COALESCE(w.id, 0) AS id,
      COALESCE(w.balance, 0) AS balance,
      COALESCE(w.held_balance, 0) AS held_balance,
      COALESCE(w.is_active, 1) AS is_active,
      COALESCE(w.is_locked, 0) AS is_locked
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY u.id DESC
    LIMIT :limit OFFSET :offset`;
  const items = await query<any[]>(sql, vals);
  const { limit, offset, ...countVals } = vals;
  const countRows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE ${where.join(' AND ')}`,
    countVals
  );
  return { items, total: Number(countRows[0]?.total || 0) };
}

export async function adminGetWalletDetail(userId: number) {
  await getOrCreateWallet(userId);
  const walletRows = await query<any[]>(
    `SELECT w.*, u.name AS user_name, u.email AS user_email
     FROM wallets w INNER JOIN users u ON u.id = w.user_id
     WHERE w.user_id = :u LIMIT 1`,
    { u: userId }
  );
  if (!walletRows[0]) throw new ApiError(404, 'Wallet not found for this user');
  const txs = await query<any[]>(
    `SELECT * FROM wallet_transactions WHERE user_id = :u ORDER BY id DESC LIMIT 250`,
    { u: userId }
  );
  return { wallet: walletRows[0], transactions: txs };
}

export async function adminCreditUserWallet(userId: number, adminId: number, amount: number, description: string) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    await getOrCreateWallet(userId, c);
    await creditWallet(c, userId, amount, 'admin_credit', { description, createdBy: adminId });
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function adminDebitUserWallet(userId: number, adminId: number, amount: number, description: string) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    await getOrCreateWallet(userId, c);
    await debitWallet(c, userId, amount, 'admin_debit', { description, createdBy: adminId });
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function adminUnlockWalletFraudLock(userId: number) {
  await query(`UPDATE wallets SET is_locked = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = :u`, { u: userId });
}

export async function adminManualRefundToWallet(
  userId: number,
  adminId: number,
  amount: number,
  description: string,
  referenceType: string,
  referenceId: number
) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    await getOrCreateWallet(userId, c);
    await creditWallet(c, userId, amount, 'refund', {
      referenceType,
      referenceId,
      description,
      createdBy: adminId
    });
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function adminWalletDashboardStats() {
  const [bal, cred, deb] = await Promise.all([
    query<{ s: number }[]>('SELECT COALESCE(SUM(balance),0) AS s FROM wallets'),
    query<{ s: number }[]>(
      `SELECT COALESCE(SUM(amount),0) AS s FROM wallet_transactions WHERE type IN ('credit','admin_credit','refund','order_refund','commission_credit','bonus_credit')`
    ),
    query<{ s: number }[]>(
      `SELECT COALESCE(SUM(amount),0) AS s FROM wallet_transactions WHERE type IN ('debit','admin_debit','order_payment')`
    )
  ]);
  const recent = await query<any[]>(
    `SELECT t.*, u.email AS user_email, u.name AS user_name
     FROM wallet_transactions t
     INNER JOIN users u ON u.id = t.user_id
     ORDER BY t.id DESC LIMIT 12`
  );
  return {
    totalBalanceHeld: Number(bal[0]?.s || 0),
    lifetimeCredits: Number(cred[0]?.s || 0),
    lifetimeDebits: Number(deb[0]?.s || 0),
    recentActivity: recent
  };
}
