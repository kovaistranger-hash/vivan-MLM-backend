import { query } from '../../db/mysql.js';
import { normalizeReferralUserId } from '../referral/referral.service.js';
import { jsonSafeValue } from '../../utils/jsonSafe.js';
/**
 * Last 30 calendar days that have commission wallet activity, oldest-first for charts.
 */
export async function getIncomeHistory(req, res) {
    const uid = normalizeReferralUserId(req.user.id);
    if (uid == null) {
        res.json(jsonSafeValue({ success: true, series: [] }));
        return;
    }
    const rows = await query(`SELECT dt, income FROM (
       SELECT DATE(created_at) AS dt,
              COALESCE(SUM(CASE WHEN wallet_amount > 0 THEN wallet_amount ELSE 0 END), 0) AS income
       FROM commission_transactions
       WHERE user_id = :uid
       GROUP BY DATE(created_at)
       ORDER BY dt DESC
       LIMIT 30
     ) sub
     ORDER BY dt ASC`, { uid });
    const series = rows.map((r) => {
        const raw = r.dt;
        const dateStr = typeof raw === 'string'
            ? raw.slice(0, 10)
            : raw instanceof Date
                ? raw.toISOString().slice(0, 10)
                : String(raw).slice(0, 10);
        return { date: dateStr, income: Number(r.income ?? 0) };
    });
    res.json(jsonSafeValue({ success: true, series }));
}
