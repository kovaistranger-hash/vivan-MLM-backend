import type { Request, Response } from 'express';
import { getMlmStatsForUser } from '../mlm/mlm.service.js';
import { normalizeReferralUserId } from './referral.service.js';
import { jsonSafeValue } from '../../utils/jsonSafe.js';

/**
 * Live binary carry (left/right BV from `binary_carry`) plus IST-day and lifetime binary wallet totals.
 * Same underlying data as `GET /mlm/stats`, shaped for the binary calculator UI.
 */
export async function getBinaryStats(req: Request, res: Response) {
  const uid = normalizeReferralUserId(req.user!.id);
  if (uid == null) {
    res.json(
      jsonSafeValue({
        success: true,
        leftBV: 0,
        rightBV: 0,
        todayBinaryIncome: 0,
        totalBinaryIncome: 0,
        weakLeg: 'left' as const
      })
    );
    return;
  }

  const s = await getMlmStatsForUser(uid);
  res.json(
    jsonSafeValue({
      success: true,
      leftBV: s.leftBV,
      rightBV: s.rightBV,
      todayBinaryIncome: s.todayIncome,
      totalBinaryIncome: s.totalIncome,
      weakLeg: s.weakLeg
    })
  );
}
