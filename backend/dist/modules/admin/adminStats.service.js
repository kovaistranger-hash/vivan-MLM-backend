import { query } from '../../db/mysql.js';
export async function getAdminStatsPayload() {
    const [revenueRow, payoutRow, growthRows, topEarnersRows, binaryRow, recentTx] = await Promise.all([
        query(`SELECT COALESCE(SUM(subtotal), 0) AS total FROM orders WHERE status = 'delivered'`),
        query(`SELECT COALESCE(SUM(wallet_amount), 0) AS total FROM commission_transactions`),
        query(`SELECT DATE(created_at) AS d, COUNT(*) AS c
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY d ASC`),
        query(`SELECT ct.user_id AS user_id, u.email AS email, COALESCE(SUM(ct.wallet_amount), 0) AS income
       FROM commission_transactions ct
       INNER JOIN users u ON u.id = ct.user_id
       GROUP BY ct.user_id, u.email
       ORDER BY income DESC
       LIMIT 10`),
        query(`SELECT COALESCE(SUM(left_profit_carry), 0) AS left_total,
              COALESCE(SUM(right_profit_carry), 0) AS right_total
       FROM binary_carry`),
        query(`SELECT t.id, t.user_id, u.email AS user_email, t.type, t.amount, t.created_at
       FROM wallet_transactions t
       INNER JOIN users u ON u.id = t.user_id
       ORDER BY t.id DESC
       LIMIT 20`)
    ]);
    const revenue = Number(revenueRow[0]?.total ?? 0);
    const payout = Number(payoutRow[0]?.total ?? 0);
    const profit = revenue - payout;
    const margin = revenue > 0 ? Math.round((10000 * profit) / revenue) / 100 : null;
    const growth = (growthRows || []).map((r) => ({
        date: typeof r.d === 'string' ? r.d : String(r.d).slice(0, 10),
        users: Number(r.c)
    }));
    const topEarners = (topEarnersRows || []).map((r) => ({
        userId: Number(r.user_id),
        email: String(r.email),
        income: Number(r.income ?? 0)
    }));
    const bh = binaryRow[0];
    const binaryHealth = {
        leftTotal: Number(bh?.left_total ?? 0),
        rightTotal: Number(bh?.right_total ?? 0)
    };
    const recentTransactions = (recentTx || []).map((t) => ({
        id: Number(t.id),
        userId: Number(t.user_id),
        userEmail: String(t.user_email),
        type: String(t.type),
        amount: Number(t.amount),
        createdAt: typeof t.created_at === 'string' ? t.created_at : String(t.created_at)
    }));
    return {
        revenue,
        payout,
        profit,
        margin,
        growth,
        topEarners,
        binaryHealth,
        recentTransactions
    };
}
