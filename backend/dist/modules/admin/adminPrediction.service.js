import { query } from '../../db/mysql.js';
const LOOKBACK_DAYS = 7;
const FORECAST_DAYS = 30;
function dayKey(d) {
    if (typeof d === 'string')
        return d.slice(0, 10);
    return d.toISOString().slice(0, 10);
}
export async function getAdminProfitPrediction() {
    const [revRows, payRows] = await Promise.all([
        query(`SELECT DATE(created_at) AS d, COALESCE(SUM(subtotal), 0) AS revenue
       FROM orders
       WHERE status = 'delivered'
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)`, [LOOKBACK_DAYS - 1]),
        query(`SELECT DATE(created_at) AS d, COALESCE(SUM(wallet_amount), 0) AS payout
       FROM commission_transactions
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)`, [LOOKBACK_DAYS - 1])
    ]);
    const revMap = new Map();
    for (const r of revRows || []) {
        revMap.set(dayKey(r.d), Number(r.revenue ?? 0));
    }
    const payMap = new Map();
    for (const r of payRows || []) {
        payMap.set(dayKey(r.d), Number(r.payout ?? 0));
    }
    const allDates = new Set([...revMap.keys(), ...payMap.keys()]);
    const profitTrend = [...allDates]
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
