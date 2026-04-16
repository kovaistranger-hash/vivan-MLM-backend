import { query } from '../../db/mysql.js';
import { adminLowStockCount } from './adminProduct.service.js';
import { adminWalletDashboardStats } from '../wallet/adminWallet.service.js';
export async function getAdminDashboardMetrics() {
    const [users, products, ordersAgg, pendingOrders, wallet, deliveredRevenueRow, commissionPayoutRow, userGrowthRows, topEarnersRows, binaryHealthRow] = await Promise.all([
        query('SELECT COUNT(*) AS c FROM users'),
        query('SELECT COUNT(*) AS c FROM products WHERE deleted_at IS NULL'),
        query('SELECT COUNT(*) AS c, COALESCE(SUM(total_amount),0) AS revenue FROM orders'),
        query(`SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'`),
        adminWalletDashboardStats(),
        query(`SELECT COALESCE(SUM(subtotal), 0) AS revenue FROM orders WHERE status = 'delivered'`),
        query(`SELECT COALESCE(SUM(wallet_amount), 0) AS payout FROM commission_transactions`),
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
       FROM binary_carry`)
    ]);
    const lowStock = await adminLowStockCount();
    const deliveredRevenue = Number(deliveredRevenueRow[0]?.revenue ?? 0);
    const totalCommissionPayout = Number(commissionPayoutRow[0]?.payout ?? 0);
    const grossPlatformProfit = deliveredRevenue - totalCommissionPayout;
    const marginPercent = deliveredRevenue > 0 ? Math.round((10000 * grossPlatformProfit) / deliveredRevenue) / 100 : null;
    const userGrowth = (userGrowthRows || []).map((r) => ({
        date: typeof r.d === 'string' ? r.d : String(r.d).slice(0, 10),
        count: Number(r.c)
    }));
    const topEarners = (topEarnersRows || []).map((r) => ({
        userId: Number(r.user_id),
        email: String(r.email),
        income: Number(r.income ?? 0)
    }));
    const bh = binaryHealthRow[0];
    const binaryCarry = {
        leftTotal: Number(bh?.left_total ?? 0),
        rightTotal: Number(bh?.right_total ?? 0)
    };
    return {
        totalUsers: Number(users[0].c),
        totalProducts: Number(products[0].c),
        totalOrders: Number(ordersAgg[0].c),
        totalRevenue: Number(ordersAgg[0].revenue),
        pendingOrders: Number(pendingOrders[0].c),
        lowStockProducts: lowStock,
        wallet: {
            totalBalanceHeld: wallet.totalBalanceHeld,
            lifetimeCredits: wallet.lifetimeCredits,
            lifetimeDebits: wallet.lifetimeDebits,
            recentActivity: wallet.recentActivity
        },
        investor: {
            deliveredOrderRevenue: deliveredRevenue,
            totalCommissionWalletPayout: totalCommissionPayout,
            grossPlatformProfit,
            marginPercent,
            userGrowthLast30Days: userGrowth,
            topCommissionEarners: topEarners,
            binaryCarryTotals: binaryCarry
        }
    };
}
