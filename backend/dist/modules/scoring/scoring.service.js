import { execute, query } from '../../db/mysql.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
function clampScore(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
}
function levelFromScore(score) {
    if (score > 70)
        return 'Gold';
    if (score > 40)
        return 'Silver';
    return 'Bronze';
}
export async function calculateUserScore(userId) {
    await ensureReferralSchemaExists();
    const actRows = await query(`SELECT COUNT(*) AS c FROM orders
     WHERE user_id = :u AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, { u: userId });
    const activity = Math.min(25, Number(actRows[0]?.c || 0) * 3);
    const salesRows = await query(`SELECT COALESCE(SUM(subtotal), 0) AS s FROM orders
     WHERE user_id = :u AND status = 'delivered'`, { u: userId });
    const sales = Math.min(25, Number(salesRows[0]?.s || 0) / 10_000);
    const incRows = await query(`SELECT COALESCE(SUM(wallet_amount), 0) AS s FROM commission_transactions WHERE user_id = :u`, { u: userId });
    const earnings = Math.min(30, Number(incRows[0]?.s || 0) / 1000);
    const teamRows = await query('SELECT COUNT(*) AS c FROM referral_users WHERE sponsor_user_id = :u', { u: userId });
    const network = Math.min(20, Number(teamRows[0]?.c || 0));
    const fraudRows = await query(`SELECT risk_score FROM fraud_logs WHERE user_id = :u ORDER BY id DESC LIMIT 1`, { u: userId });
    const fraudPenalty = Math.min(40, Number(fraudRows[0]?.risk_score || 0));
    const score = clampScore(activity + sales + earnings + network - fraudPenalty);
    const level = levelFromScore(score);
    await execute(`INSERT INTO user_scores (user_id, score, level) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score), level = VALUES(level), updated_at = CURRENT_TIMESTAMP`, [userId, score, level]);
    return { score, level };
}
export async function getOrRefreshUserScore(userId) {
    await ensureReferralSchemaExists();
    const rows = await query('SELECT score, level, updated_at FROM user_scores WHERE user_id = :u LIMIT 1', { u: userId });
    const r = rows[0];
    if (r) {
        const t = new Date(r.updated_at).getTime();
        if (Number.isFinite(t) && Date.now() - t < env.scoringCacheTtlMs) {
            return { score: Number(r.score), level: String(r.level) };
        }
    }
    return calculateUserScore(userId);
}
export async function assertWithdrawalScoreAllowed(userId) {
    if (env.scoringMinWithdrawScore <= 0)
        return;
    const { score } = await getOrRefreshUserScore(userId);
    if (score < env.scoringMinWithdrawScore) {
        throw new ApiError(403, `Withdrawal is restricted while your account quality score is below ${env.scoringMinWithdrawScore}. Complete KYC and maintain activity to improve your score.`);
    }
}
