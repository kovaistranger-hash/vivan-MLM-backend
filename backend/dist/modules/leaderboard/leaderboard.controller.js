import { query } from '../../db/mysql.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
export async function getLeaderboard(_req, res) {
    await ensureReferralSchemaExists();
    const rows = await query(`SELECT u.id, u.name, COALESCE(SUM(w.wallet_amount), 0) AS total_income
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id AND r.slug = 'customer'
     INNER JOIN commission_transactions w ON u.id = w.user_id
     GROUP BY u.id, u.name
     ORDER BY total_income DESC
     LIMIT 10`);
    res.json({
        success: true,
        leaderboard: rows.map((r) => ({
            id: r.id,
            name: r.name,
            total_income: Number(r.total_income ?? 0)
        }))
    });
}
