import { query } from '../../db/mysql.js';
import { adminLowStockCount } from './adminProduct.service.js';
import { adminWalletDashboardStats } from '../wallet/adminWallet.service.js';

// --- Main dashboard (`GET /admin/dashboard`) ---

export type AdminUserGrowthRow = { date: string; count: number };
export type AdminTopEarnerRow = { userId: number; email: string; income: number };

export async function getAdminDashboardMetrics() {
  const [
    users,
    products,
    ordersAgg,
    pendingOrders,
    wallet,
    deliveredRevenueRow,
    commissionPayoutRow,
    userGrowthRows,
    topEarnersRows,
    binaryHealthRow
  ] = await Promise.all([
    query<Array<{ c: number }>>('SELECT COUNT(*) AS c FROM users'),
    query<Array<{ c: number }>>('SELECT COUNT(*) AS c FROM products WHERE deleted_at IS NULL'),
    query<Array<{ c: number; revenue: string | number }>>(
      'SELECT COUNT(*) AS c, COALESCE(SUM(total_amount),0) AS revenue FROM orders'
    ),
    query<Array<{ c: number }>>(`SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'`),
    adminWalletDashboardStats(),
    query<Array<{ revenue: string | number | null }>>(
      `SELECT COALESCE(SUM(subtotal), 0) AS revenue FROM orders WHERE status = 'delivered'`
    ),
    query<Array<{ payout: string | number | null }>>(
      `SELECT COALESCE(SUM(wallet_amount), 0) AS payout FROM commission_transactions`
    ),
    query<Array<{ d: Date | string; c: number }>>(
      `SELECT DATE(created_at) AS d, COUNT(*) AS c
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY d ASC`
    ),
    query<Array<{ user_id: number; email: string; income: string | number | null }>>(
      `SELECT ct.user_id AS user_id, u.email AS email, COALESCE(SUM(ct.wallet_amount), 0) AS income
       FROM commission_transactions ct
       INNER JOIN users u ON u.id = ct.user_id
       GROUP BY ct.user_id, u.email
       ORDER BY income DESC
       LIMIT 10`
    ),
    query<Array<{ left_total: string | number | null; right_total: string | number | null }>>(
      `SELECT COALESCE(SUM(left_profit_carry), 0) AS left_total,
              COALESCE(SUM(right_profit_carry), 0) AS right_total
       FROM binary_carry`
    )
  ]);

  const lowStock = await adminLowStockCount();

  const deliveredRevenue = Number(deliveredRevenueRow[0]?.revenue ?? 0);
  const totalCommissionPayout = Number(commissionPayoutRow[0]?.payout ?? 0);
  const grossPlatformProfit = deliveredRevenue - totalCommissionPayout;
  const marginPercent =
    deliveredRevenue > 0 ? Math.round((10000 * grossPlatformProfit) / deliveredRevenue) / 100 : null;

  const userGrowth: AdminUserGrowthRow[] = (userGrowthRows || []).map((r) => ({
    date: typeof r.d === 'string' ? r.d : String(r.d).slice(0, 10),
    count: Number(r.c)
  }));

  const topEarners: AdminTopEarnerRow[] = (topEarnersRows || []).map((r) => ({
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

// --- Aggregated stats (`GET /admin/stats`) ---

export type AdminStatsGrowthRow = { date: string; users: number };
export type AdminStatsTopEarner = { userId: number; email: string; income: number };
export type AdminStatsRecentTx = {
  id: number;
  userId: number;
  userEmail: string;
  type: string;
  amount: number;
  createdAt: string;
};

export type AdminStatsPayload = {
  revenue: number;
  payout: number;
  profit: number;
  margin: number | null;
  growth: AdminStatsGrowthRow[];
  topEarners: AdminStatsTopEarner[];
  binaryHealth: { leftTotal: number; rightTotal: number };
  recentTransactions: AdminStatsRecentTx[];
};

export async function getAdminStatsPayload(): Promise<AdminStatsPayload> {
  const [revenueRow, payoutRow, growthRows, topEarnersRows, binaryRow, recentTx] = await Promise.all([
    query<Array<{ total: string | number | null }>>(
      `SELECT COALESCE(SUM(subtotal), 0) AS total FROM orders WHERE status = 'delivered'`
    ),
    query<Array<{ total: string | number | null }>>(
      `SELECT COALESCE(SUM(wallet_amount), 0) AS total FROM commission_transactions`
    ),
    query<Array<{ d: Date | string; c: number }>>(
      `SELECT DATE(created_at) AS d, COUNT(*) AS c
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at)
       ORDER BY d ASC`
    ),
    query<Array<{ user_id: number; email: string; income: string | number | null }>>(
      `SELECT ct.user_id AS user_id, u.email AS email, COALESCE(SUM(ct.wallet_amount), 0) AS income
       FROM commission_transactions ct
       INNER JOIN users u ON u.id = ct.user_id
       GROUP BY ct.user_id, u.email
       ORDER BY income DESC
       LIMIT 10`
    ),
    query<Array<{ left_total: string | number | null; right_total: string | number | null }>>(
      `SELECT COALESCE(SUM(left_profit_carry), 0) AS left_total,
              COALESCE(SUM(right_profit_carry), 0) AS right_total
       FROM binary_carry`
    ),
    query<
      Array<{
        id: number;
        user_id: number;
        user_email: string;
        type: string;
        amount: string | number;
        created_at: Date | string;
      }>
    >(
      `SELECT t.id, t.user_id, u.email AS user_email, t.type, t.amount, t.created_at
       FROM wallet_transactions t
       INNER JOIN users u ON u.id = t.user_id
       ORDER BY t.id DESC
       LIMIT 20`
    )
  ]);

  const revenue = Number(revenueRow[0]?.total ?? 0);
  const payout = Number(payoutRow[0]?.total ?? 0);
  const profit = revenue - payout;
  const margin = revenue > 0 ? Math.round((10000 * profit) / revenue) / 100 : null;

  const growth: AdminStatsGrowthRow[] = (growthRows || []).map((r) => ({
    date: typeof r.d === 'string' ? r.d : String(r.d).slice(0, 10),
    users: Number(r.c)
  }));

  const topEarners: AdminStatsTopEarner[] = (topEarnersRows || []).map((r) => ({
    userId: Number(r.user_id),
    email: String(r.email),
    income: Number(r.income ?? 0)
  }));

  const bh = binaryRow[0];
  const binaryHealth = {
    leftTotal: Number(bh?.left_total ?? 0),
    rightTotal: Number(bh?.right_total ?? 0)
  };

  const recentTransactions: AdminStatsRecentTx[] = (recentTx || []).map((t) => ({
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

// --- Profit forecast (`GET /admin/stats/prediction`) ---

const LOOKBACK_DAYS = 7;
const FORECAST_DAYS = 30;

export type DailyProfitPoint = {
  date: string;
  revenue: number;
  payout: number;
  profit: number;
};

export type AdminPredictionPayload = {
  lookbackDays: number;
  forecastDays: number;
  avgDailyRevenue: number;
  avgDailyPayout: number;
  predictedRevenue: number;
  predictedPayout: number;
  predictedProfit: number;
  profitTrend: DailyProfitPoint[];
};

function dayKey(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export async function getAdminProfitPrediction(): Promise<AdminPredictionPayload> {
  const [revRows, payRows] = await Promise.all([
    query<Array<{ d: Date | string; revenue: string | number | null }>>(
      `SELECT DATE(created_at) AS d, COALESCE(SUM(subtotal), 0) AS revenue
       FROM orders
       WHERE status = 'delivered'
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)`,
      [LOOKBACK_DAYS - 1]
    ),
    query<Array<{ d: Date | string; payout: string | number | null }>>(
      `SELECT DATE(created_at) AS d, COALESCE(SUM(wallet_amount), 0) AS payout
       FROM commission_transactions
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)`,
      [LOOKBACK_DAYS - 1]
    )
  ]);

  const revMap = new Map<string, number>();
  for (const r of revRows || []) {
    revMap.set(dayKey(r.d), Number(r.revenue ?? 0));
  }
  const payMap = new Map<string, number>();
  for (const r of payRows || []) {
    payMap.set(dayKey(r.d), Number(r.payout ?? 0));
  }

  const allDates = new Set<string>([...revMap.keys(), ...payMap.keys()]);
  const profitTrend: DailyProfitPoint[] = [...allDates]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((date) => {
      const revenue = revMap.get(date) ?? 0;
      const payout = payMap.get(date) ?? 0;
      return { date, revenue, payout, profit: revenue - payout };
    });

  const totalRev = [...revMap.values()].reduce((a, b) => a + b, 0);
  const totalPay = [...payMap.values()].reduce((a, b) => a + b, 0);
  const avgDailyRevenue = totalRev / LOOKBACK_DAYS;
  const avgDailyPayout = totalPay / LOOKBACK_DAYS;
  const predictedRevenue = avgDailyRevenue * FORECAST_DAYS;
  const predictedPayout = avgDailyPayout * FORECAST_DAYS;
  const predictedProfit = predictedRevenue - predictedPayout;

  return {
    lookbackDays: LOOKBACK_DAYS,
    forecastDays: FORECAST_DAYS,
    avgDailyRevenue,
    avgDailyPayout,
    predictedRevenue,
    predictedPayout,
    predictedProfit,
    profitTrend
  };
}
