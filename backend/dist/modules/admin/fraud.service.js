import { execute, query } from '../../db/mysql.js';
import { env } from '../../config/env.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
const LOG_THRESHOLD = 50;
const FREEZE_THRESHOLD = 70;
const DEDUPE_MINUTES = 120;
async function columnExists(tableName, columnName) {
    const rows = await query(`SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName AND COLUMN_NAME = :columnName`, { tableName, columnName });
    return Number(rows[0]?.total || 0) > 0;
}
async function sponsorOf(userId) {
    const rows = await query('SELECT sponsor_user_id FROM referral_users WHERE user_id = :u LIMIT 1', { u: userId });
    const v = rows[0]?.sponsor_user_id;
    if (v == null)
        return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
}
async function hasSponsorCycle(userId) {
    const visited = new Set();
    let cur = userId;
    for (let i = 0; i < 100; i++) {
        const sp = await sponsorOf(cur);
        if (sp == null)
            return false;
        if (sp === cur)
            return true;
        if (visited.has(sp))
            return true;
        visited.add(cur);
        cur = sp;
    }
    return false;
}
async function shouldInsertFraudLog(userId, type) {
    const rows = await query(`SELECT COUNT(*) AS c FROM fraud_logs
     WHERE user_id = :u AND type = :t AND created_at > DATE_SUB(NOW(), INTERVAL ${DEDUPE_MINUTES} MINUTE)`, { u: userId, t: type });
    return Number(rows[0]?.c || 0) === 0;
}
/**
 * Heuristic fraud scoring: shared IP / payment rails, sponsor cycles, income velocity,
 * no purchases with commissions, referral fan-out, rapid withdrawals.
 */
export async function evaluateFraudRiskForUser(userId) {
    await ensureReferralSchemaExists();
    const issues = [];
    let risk = 0;
    const hasSignupIp = await columnExists('users', 'signup_ip');
    if (hasSignupIp) {
        const ipRows = await query('SELECT signup_ip FROM users WHERE id = :id LIMIT 1', { id: userId });
        const ip = ipRows[0]?.signup_ip ? String(ipRows[0].signup_ip) : null;
        if (ip) {
            const cntRows = await query('SELECT COUNT(*) AS c FROM users WHERE signup_ip = :ip', { ip });
            const c = Number(cntRows[0]?.c || 0);
            if (c > 3) {
                risk += 30;
                issues.push({ code: 'SHARED_SIGNUP_IP', message: `Multiple accounts share signup IP (${c} users).`, weight: 30 });
            }
        }
    }
    const payDupRows = await query(`SELECT COUNT(DISTINCT ba.user_id) AS c
     FROM bank_accounts me
     INNER JOIN bank_accounts ba
       ON ba.user_id <> me.user_id
      AND ba.id <> me.id
     WHERE me.user_id = :u
       AND (
         (me.account_number IS NOT NULL AND TRIM(me.account_number) <> ''
           AND me.ifsc_code IS NOT NULL AND TRIM(me.ifsc_code) <> ''
           AND ba.account_number = me.account_number AND ba.ifsc_code = me.ifsc_code)
         OR (me.upi_id IS NOT NULL AND TRIM(me.upi_id) <> ''
           AND ba.upi_id IS NOT NULL AND TRIM(ba.upi_id) <> '' AND ba.upi_id = me.upi_id)
       )`, { u: userId });
    const payDup = Number(payDupRows[0]?.c || 0);
    if (payDup > 0) {
        risk += 35;
        issues.push({
            code: 'SHARED_BANK_OR_UPI',
            message: 'Bank account or UPI ID matches another member profile.',
            weight: 35
        });
    }
    const selfSponsor = await query('SELECT COUNT(*) AS c FROM referral_users WHERE user_id = :u AND sponsor_user_id = :u', { u: userId });
    if (Number(selfSponsor[0]?.c || 0) > 0) {
        risk += 50;
        issues.push({ code: 'SELF_SPONSOR', message: 'Self-referral (sponsor equals own account).', weight: 50 });
    }
    if (await hasSponsorCycle(userId)) {
        risk += 45;
        issues.push({ code: 'SPONSOR_CYCLE', message: 'Circular sponsor chain detected (loop network).', weight: 45 });
    }
    const incomeRows = await query(`SELECT COALESCE(SUM(wallet_amount), 0) AS s FROM commission_transactions
     WHERE user_id = :u AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`, { u: userId });
    const income24h = Number(incomeRows[0]?.s ?? 0);
    if (income24h > 20_000) {
        risk += 25;
        issues.push({ code: 'FAST_INCOME', message: 'Unusual commission wallet credits in 24h.', weight: 25 });
    }
    const ordRows = await query(`SELECT COUNT(*) AS c FROM orders WHERE user_id = :u AND status IN ('paid','packed','shipped','delivered')`, { u: userId });
    const ordCount = Number(ordRows[0]?.c || 0);
    if (ordCount === 0) {
        const commRows = await query(`SELECT COALESCE(SUM(wallet_amount), 0) AS s FROM commission_transactions WHERE user_id = :u`, { u: userId });
        const commTotal = Number(commRows[0]?.s ?? 0);
        if (commTotal > 500) {
            risk += 20;
            issues.push({ code: 'NO_PURCHASE_INCOME', message: 'Wallet commissions without a paid/delivered order.', weight: 20 });
        }
    }
    const dirRows = await query('SELECT COUNT(*) AS c FROM referral_users WHERE sponsor_user_id = :u', { u: userId });
    if (Number(dirRows[0]?.c || 0) > 50) {
        risk += 25;
        issues.push({ code: 'MANY_DIRECTS', message: 'Very high direct referral count.', weight: 25 });
    }
    const wdRows = await query(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS gross FROM withdrawal_requests
     WHERE user_id = :u AND status IN ('pending','approved','paid')
       AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`, { u: userId });
    const wdGross = Number(wdRows[0]?.gross ?? 0);
    const ageRows = await query('SELECT DATEDIFF(NOW(), created_at) AS days FROM users WHERE id = :u LIMIT 1', { u: userId });
    const ageDays = Number(ageRows[0]?.days ?? 999);
    if (ageDays < 30 && wdGross > 15_000) {
        risk += 30;
        issues.push({ code: 'FAST_WITHDRAW_NEW', message: 'High withdrawal volume on a very new account.', weight: 30 });
    }
    const wd24 = await query(`SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS gross FROM withdrawal_requests
     WHERE user_id = :u AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`, { u: userId });
    if (Number(wd24[0]?.n || 0) >= 3 && Number(wd24[0]?.gross ?? 0) > 5000) {
        risk += 20;
        issues.push({ code: 'RAPID_WITHDRAWALS', message: 'Many withdrawal requests in a short window.', weight: 20 });
    }
    let persisted = false;
    let autoFrozen = false;
    if (risk >= LOG_THRESHOLD) {
        const type = risk >= FREEZE_THRESHOLD ? 'HIGH_RISK' : 'ELEVATED_RISK';
        if (await shouldInsertFraudLog(userId, type)) {
            const msg = issues.map((i) => i.message).join(' | ');
            await execute(`INSERT INTO fraud_logs (user_id, type, risk_score, message) VALUES (?, ?, ?, ?)`, [userId, type, risk, msg || 'Fraud heuristics triggered']);
            persisted = true;
        }
    }
    if (env.fraudAutoFreeze && risk >= FREEZE_THRESHOLD && (await columnExists('wallets', 'is_locked'))) {
        const r = await execute(`UPDATE wallets SET is_locked = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [
            userId
        ]);
        if (Number(r.affectedRows || 0) > 0) {
            autoFrozen = true;
            if (await shouldInsertFraudLog(userId, 'AUTO_FREEZE')) {
                await execute(`INSERT INTO fraud_logs (user_id, type, risk_score, message) VALUES (?, 'AUTO_FREEZE', ?, ?)`, [userId, risk, 'Wallet locked automatically due to fraud score.']);
            }
        }
    }
    return { riskScore: risk, issues, persisted, autoFrozen };
}
export async function isWalletFraudLocked(userId) {
    if (!(await columnExists('wallets', 'is_locked')))
        return false;
    const rows = await query('SELECT COALESCE(is_locked, 0) AS is_locked FROM wallets WHERE user_id = :u LIMIT 1', { u: userId });
    return Number(rows[0]?.is_locked || 0) === 1;
}
export async function adminListFraudLogs(limit = 80) {
    await ensureReferralSchemaExists();
    const lim = Math.min(200, Math.max(1, Math.floor(limit)));
    const rows = await query(`SELECT f.id, f.user_id, f.type, f.risk_score, f.message, f.created_at, u.email, u.name
     FROM fraud_logs f
     INNER JOIN users u ON u.id = f.user_id
     ORDER BY f.id DESC
     LIMIT :lim`, { lim });
    return rows;
}
export async function adminFraudOverview() {
    await ensureReferralSchemaExists();
    const recent = await adminListFraudLogs(60);
    const agg = await query(`SELECT f.user_id, MAX(f.risk_score) AS max_score, u.email, u.name, MAX(f.created_at) AS last_at
     FROM fraud_logs f
     INNER JOIN users u ON u.id = f.user_id
     WHERE f.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
     GROUP BY f.user_id, u.email, u.name
     HAVING MAX(f.risk_score) >= :minScore
     ORDER BY MAX(f.risk_score) DESC, MAX(f.created_at) DESC
     LIMIT 40`, { minScore: LOG_THRESHOLD });
    return { recentLogs: recent, highRiskUsers: agg };
}
