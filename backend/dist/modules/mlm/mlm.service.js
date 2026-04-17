import { query } from '../../db/mysql.js';
import { getBinarySummaryForUser } from './binarySummary.service.js';
function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
/** BV (carry) + binary income snapshot for the MLM dashboard. */
export async function getMlmStatsForUser(userId) {
    const s = await getBinarySummaryForUser(userId);
    const leftBV = round2(Number(s.leftCarry || 0));
    const rightBV = round2(Number(s.rightCarry || 0));
    const weakLeg = leftBV <= rightBV ? 'left' : 'right';
    const rankRows = await query(`SELECT \`rank\` AS mlm_rank FROM users WHERE id = :id LIMIT 1`, { id: userId });
    const rank = String(rankRows[0]?.mlm_rank || 'Starter').trim() || 'Starter';
    return {
        leftBV,
        rightBV,
        weakLeg,
        todayIncome: round2(Number(s.todayBinaryPaid || 0)),
        totalIncome: round2(Number(s.lifetimeBinaryMatchInr || 0)),
        rank
    };
}
