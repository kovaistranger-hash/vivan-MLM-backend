import { query } from '../../db/mysql.js';
import { getBinarySummaryForUser } from './binarySummary.service.js';

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export type MlmStatsPayload = {
  leftBV: number;
  rightBV: number;
  weakLeg: 'left' | 'right';
  todayIncome: number;
  totalIncome: number;
  rank: string;
};

/** BV (carry) + binary income snapshot for the MLM dashboard. */
export async function getMlmStatsForUser(userId: number): Promise<MlmStatsPayload> {
  const s = await getBinarySummaryForUser(userId);
  const leftBV = round2(Number(s.leftCarry || 0));
  const rightBV = round2(Number(s.rightCarry || 0));
  const weakLeg: 'left' | 'right' = leftBV <= rightBV ? 'left' : 'right';
  const rankRows = await query<Array<{ mlm_rank: string | null }>>(
    `SELECT \`rank\` AS mlm_rank FROM users WHERE id = :id LIMIT 1`,
    { id: userId }
  );
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
