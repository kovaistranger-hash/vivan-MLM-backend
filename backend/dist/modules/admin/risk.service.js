import { query, execute } from '../../db/mysql.js';
import { env } from '../../config/env.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
const PAYOUT_WARN = 0.6;
const PAYOUT_DANGER = 0.7;
const IMBALANCE_RATIO_WARN = 0.35;
const MIN_CARRY_FOR_IMBALANCE = 5000;
const PROFIT_DROP_FACTOR = 0.7;
const DEDUPE_MINUTES = 90;
async function istDateStrings() {
    const rows = await query(`SELECT DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')) AS today,
            DATE(DATE_SUB(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')), INTERVAL 1 DAY)) AS yesterday`);
    const r = rows[0];
    return { today: String(r?.today || ''), yesterday: String(r?.yesterday || '') };
}
async function dailyProfitIst(day) {
    if (!day)
        return 0;
    const rev = await query(`SELECT COALESCE(SUM(subtotal), 0) AS s
     FROM orders
     WHERE status = 'delivered'
       AND DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) = ?`, [day]);
    const pay = await query(`SELECT COALESCE(SUM(wallet_amount), 0) AS s
     FROM commission_transactions
     WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) = ?`, [day]);
    const r = Number(rev[0]?.s ?? 0);
    const p = Number(pay[0]?.s ?? 0);
    return r - p;
}
async function shouldInsertAlert(alertType) {
    const rows = await query(`SELECT COUNT(*) AS c FROM system_alerts
     WHERE alert_type = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`, [alertType, DEDUPE_MINUTES]);
    return Number(rows[0]?.c || 0) === 0;
}
async function insertAlert(row) {
    if (!(await shouldInsertAlert(row.type)))
        return false;
    await execute(`INSERT INTO system_alerts (alert_type, severity, message, metadata_json)
     VALUES (?, ?, ?, ?)`, [row.type, row.severity, row.message, row.metadata != null ? JSON.stringify(row.metadata) : null]);
    return true;
}
async function applyBinaryMitigationIfNeeded(payoutRatio) {
    if (!env.riskAutoMitigate || payoutRatio == null || payoutRatio <= PAYOUT_DANGER)
        return false;
    const r = await execute(`UPDATE compensation_settings SET
       binary_percentage = LEAST(binary_percentage, 8.0000),
       binary_left_percentage = LEAST(binary_left_percentage, 8.0000),
       binary_right_percentage = LEAST(binary_right_percentage, 8.0000)
     WHERE id = 1`);
    const changed = Number(r.affectedRows || 0) > 0;
    if (changed) {
        await insertAlert({
            type: 'AUTO_MITIGATE_BINARY',
            severity: 'warning',
            message: 'Risk engine reduced binary match rate ceiling to 8% (auto-mitigation).',
            metadata: { payoutRatio, cappedTo: 8 }
        });
    }
    return changed;
}
export async function listRecentSystemAlerts(limit = 30) {
    const lim = Math.min(100, Math.max(1, Math.floor(limit)));
    return query(`SELECT id, alert_type, severity, message, metadata_json, created_at
     FROM system_alerts
     ORDER BY id DESC
     LIMIT :lim`, { lim });
}
/**
 * Computes payout ratio, binary imbalance, IST daily profit momentum; persists deduped alerts;
 * optionally clamps binary % when `RISK_AUTO_MITIGATE` is enabled and payout ratio is critical.
 */
export async function evaluateSystemRiskAndPersist() {
    await ensureReferralSchemaExists();
    const revRow = await query(`SELECT COALESCE(SUM(subtotal), 0) AS s FROM orders WHERE status = 'delivered'`);
    const payRow = await query(`SELECT COALESCE(SUM(wallet_amount), 0) AS s FROM commission_transactions`);
    const revenue = Number(revRow[0]?.s ?? 0);
    const payout = Number(payRow[0]?.s ?? 0);
    const payoutRatio = revenue > 0 ? payout / revenue : null;
    const carryRow = await query(`SELECT COALESCE(SUM(left_profit_carry), 0) AS L, COALESCE(SUM(right_profit_carry), 0) AS R
     FROM binary_carry`);
    const binaryLeftTotal = Number(carryRow[0]?.L ?? 0);
    const binaryRightTotal = Number(carryRow[0]?.R ?? 0);
    const binaryImbalance = Math.abs(binaryLeftTotal - binaryRightTotal);
    const denom = binaryLeftTotal + binaryRightTotal + 1;
    const binaryImbalanceRatio = denom > 0 ? binaryImbalance / denom : null;
    const { today, yesterday } = await istDateStrings();
    const profitTodayIst = await dailyProfitIst(today);
    const profitYesterdayIst = await dailyProfitIst(yesterday);
    const alerts = [];
    if (payoutRatio != null && payoutRatio > PAYOUT_DANGER) {
        alerts.push({
            type: 'HIGH_PAYOUT_RATIO',
            severity: 'danger',
            message: `Payout ratio ${(payoutRatio * 100).toFixed(1)}% exceeds ${(PAYOUT_DANGER * 100).toFixed(0)}% — review compensation and cashflow.`,
            metadata: { payoutRatio, revenue, payout }
        });
    }
    else if (payoutRatio != null && payoutRatio > PAYOUT_WARN) {
        alerts.push({
            type: 'PAYOUT_RATIO_ELEVATED',
            severity: 'warning',
            message: `Payout ratio ${(payoutRatio * 100).toFixed(1)}% is above ${(PAYOUT_WARN * 100).toFixed(0)}% advisory band.`,
            metadata: { payoutRatio, revenue, payout }
        });
    }
    if (binaryImbalanceRatio != null &&
        binaryLeftTotal + binaryRightTotal >= MIN_CARRY_FOR_IMBALANCE &&
        binaryImbalanceRatio > IMBALANCE_RATIO_WARN) {
        alerts.push({
            type: 'BINARY_IMBALANCE',
            severity: 'warning',
            message: `Binary carry imbalance is high (|L-R| / (L+R) = ${(binaryImbalanceRatio * 100).toFixed(1)}%). Weak-leg earning risk.`,
            metadata: { binaryImbalance, binaryLeftTotal, binaryRightTotal, binaryImbalanceRatio }
        });
    }
    if (profitYesterdayIst > 0 && profitTodayIst < profitYesterdayIst * PROFIT_DROP_FACTOR) {
        alerts.push({
            type: 'IST_PROFIT_DROP',
            severity: 'danger',
            message: `IST daily net (delivered revenue - commission wallet) dropped sharply vs yesterday.`,
            metadata: { profitTodayIst, profitYesterdayIst, factor: PROFIT_DROP_FACTOR }
        });
    }
    let inserted = 0;
    for (const a of alerts) {
        if (await insertAlert(a))
            inserted++;
    }
    const mitigatedBinary = await applyBinaryMitigationIfNeeded(payoutRatio);
    return {
        revenue,
        payout,
        payoutRatio,
        binaryLeftTotal,
        binaryRightTotal,
        binaryImbalance,
        binaryImbalanceRatio,
        profitTodayIst,
        profitYesterdayIst,
        alerts,
        mitigatedBinary,
        insertedAlerts: inserted
    };
}
