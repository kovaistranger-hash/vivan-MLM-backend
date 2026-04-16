import { query } from '../../db/mysql.js';

function round4(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
}

export type PayoutOptimizerSnapshot = {
  revenue: number;
  payout: number;
  payoutRatio: number | null;
  usersTodayIst: number;
  usersYesterdayIst: number;
  growthRate: number;
  /** Decimal rate before global clamp (e.g. 0.10). */
  rawRate: number;
  /** After 5%–12% clamp. */
  clampedRate: number;
};

/**
 * Reads delivered revenue vs commission wallet totals and IST signup momentum,
 * returns a suggested binary match rate as a decimal in [0.05, 0.12].
 */
export async function computeOptimizedBinaryRateDecimal(): Promise<number> {
  const snap = await getPayoutOptimizerSnapshot();
  return snap.clampedRate;
}

export async function getPayoutOptimizerSnapshot(): Promise<PayoutOptimizerSnapshot> {
  const revRows = await query<Array<{ s: string | number | null }>>(
    `SELECT COALESCE(SUM(subtotal), 0) AS s FROM orders WHERE status = 'delivered'`
  );
  const payRows = await query<Array<{ s: string | number | null }>>(
    `SELECT COALESCE(SUM(wallet_amount), 0) AS s FROM commission_transactions`
  );
  const revenueRaw = Number(revRows[0]?.s ?? 0);
  const revenue = Math.max(1, revenueRaw);
  const payout = Number(payRows[0]?.s ?? 0);
  const payoutRatio = revenueRaw > 0 ? payout / revenueRaw : null;

  const cntRows = await query<Array<{ today_cnt: number; yest_cnt: number }>>(
    `SELECT
       (SELECT COUNT(*) FROM users
         WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) =
               DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30'))) AS today_cnt,
       (SELECT COUNT(*) FROM users
         WHERE DATE(CONVERT_TZ(created_at, '+00:00', '+05:30')) =
               DATE(DATE_SUB(DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')), INTERVAL 1 DAY))) AS yest_cnt`
  );
  const usersTodayIst = Number(cntRows[0]?.today_cnt ?? 0);
  const usersYesterdayIst = Number(cntRows[0]?.yest_cnt ?? 0);
  const growthRate =
    usersYesterdayIst > 0
      ? (usersTodayIst - usersYesterdayIst) / usersYesterdayIst
      : usersTodayIst > 0
        ? 1
        : 0;

  const ratio = payoutRatio ?? payout / revenue;
  let rate = 0.1;

  if (ratio > 0.7) rate = 0.07;
  else if (ratio > 0.6) rate = 0.08;
  else if (ratio < 0.4) rate = 0.12;

  if (growthRate < 0.05) {
    rate += 0.01;
  }

  const clampedRate = round4(Math.max(0.05, Math.min(rate, 0.12)));
  return {
    revenue: revenueRaw,
    payout,
    payoutRatio,
    usersTodayIst,
    usersYesterdayIst,
    growthRate,
    rawRate: round4(rate),
    clampedRate
  };
}
