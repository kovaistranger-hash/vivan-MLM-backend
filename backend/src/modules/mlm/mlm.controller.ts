import type { Request, Response } from 'express';
import { getMlmStatsForUser } from './mlm.service.js';
import { normalizeReferralUserId } from '../referral/referral.service.js';
import { jsonSafeValue } from '../../utils/jsonSafe.js';

export async function mlmStats(req: Request, res: Response) {
  const uid = normalizeReferralUserId(req.user!.id);
  if (uid == null) {
    res.json(
      jsonSafeValue({
        success: true,
        leftBV: 0,
        rightBV: 0,
        weakLeg: 'left' as const,
        todayIncome: 0,
        totalIncome: 0,
        rank: 'Starter'
      })
    );
    return;
  }

  try {
    const stats = await getMlmStatsForUser(uid);
    res.json(jsonSafeValue({ success: true, ...stats }));
  } catch (e) {
    console.error('[mlm] mlmStats:', e instanceof Error ? e.message : e);
    res.json(
      jsonSafeValue({
        success: true,
        leftBV: 0,
        rightBV: 0,
        weakLeg: 'left' as const,
        todayIncome: 0,
        totalIncome: 0,
        rank: 'Starter'
      })
    );
  }
}
