import type { Request, Response } from 'express';
import {
  buildBinaryTreePreview,
  emptyBinaryTreeRoot,
  emptyReferralProfile,
  getBinarySummaryForUser,
  getReferralRow,
  listCommissionsForUser,
  listDirectReferrals,
  listWalletCommissionImpact,
  normalizeReferralUserId,
  placeBinaryUnderParent,
  toReferralProfileDto,
  zeroBinarySummaryPayload
} from './referral.service.js';
import { getKycStatusForUser } from '../kyc/kyc.service.js';
import { getOrRefreshUserScore } from '../scoring/scoring.service.js';
import { jsonSafeValue } from '../../utils/jsonSafe.js';

function logReferralError(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[referral] ${label}:`, msg);
}

export async function referralMe(req: Request, res: Response) {
  const uid = normalizeReferralUserId(req.user!.id);
  if (uid == null) {
    res.json({
      success: true,
      profile: jsonSafeValue(emptyReferralProfile(0)),
      referralCode: null,
      referral_code: null,
      code: null,
      kyc: null,
      userScore: null
    });
    return;
  }
  try {
    const row = await getReferralRow(uid);
    const profile = toReferralProfileDto(row) ?? emptyReferralProfile(uid);
    const flat = String(
      (profile as { referral_code?: string; referralCode?: string; code?: string }).referral_code ??
        (profile as { referralCode?: string; code?: string }).referralCode ??
        (profile as { code?: string }).code ??
        ''
    ).trim();
    const has = flat.length > 0;
    let kyc: unknown = null;
    let userScore: unknown = null;
    try {
      kyc = await getKycStatusForUser(uid);
    } catch {
      kyc = null;
    }
    try {
      userScore = await getOrRefreshUserScore(uid);
    } catch {
      userScore = null;
    }
    res.json({
      success: true,
      profile: jsonSafeValue(profile),
      referralCode: has ? flat : null,
      referral_code: has ? flat : null,
      code: has ? flat : null,
      kyc: jsonSafeValue(kyc),
      userScore: jsonSafeValue(userScore)
    });
  } catch (e) {
    logReferralError('referralMe', e);
    res.json({
      success: true,
      profile: jsonSafeValue(emptyReferralProfile(uid)),
      referralCode: null,
      referral_code: null,
      code: null,
      kyc: null,
      userScore: null
    });
  }
}

export async function referralTree(req: Request, res: Response) {
  const uid = req.user!.id;
  const depth = Math.min(6, Math.max(1, Number(req.query.depth) || 4));
  try {
    const tree = await buildBinaryTreePreview(uid, depth);
    res.json({ success: true, tree: jsonSafeValue(tree) });
  } catch (e) {
    logReferralError('referralTree', e);
    res.json({ success: true, tree: emptyBinaryTreeRoot(uid) });
  }
}

export async function referralDirects(req: Request, res: Response) {
  const uid = req.user!.id;
  try {
    const items = await listDirectReferrals(uid);
    res.json({ success: true, items: jsonSafeValue(items) });
  } catch (e) {
    logReferralError('referralDirects', e);
    res.json({ success: true, items: [] });
  }
}

export async function referralCommissions(req: Request, res: Response) {
  const uid = req.user!.id;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  try {
    const data = await listCommissionsForUser(uid, page, pageSize);
    const safe = jsonSafeValue(data) as { items: unknown[]; total: number };
    res.json({ success: true, items: safe.items, total: safe.total, page, pageSize });
  } catch (e) {
    logReferralError('referralCommissions', e);
    res.json({ success: true, items: [], total: 0, page, pageSize });
  }
}

export async function referralBinarySummary(req: Request, res: Response) {
  const uid = req.user!.id;
  try {
    const summary = await getBinarySummaryForUser(uid);
    const walletImpact = await listWalletCommissionImpact(uid, 25);
    res.json({
      success: true,
      summary: jsonSafeValue(summary),
      walletImpact: jsonSafeValue(walletImpact)
    });
  } catch (e) {
    logReferralError('referralBinarySummary', e);
    res.json({
      success: true,
      summary: zeroBinarySummaryPayload(),
      walletImpact: []
    });
  }
}

export async function referralPlaceBinary(req: Request, res: Response) {
  const { childReferralCode, parentReferralCode, side } = req.body as {
    childReferralCode: string;
    parentReferralCode: string;
    side: 'left' | 'right';
  };
  await placeBinaryUnderParent(req.user!.id, {
    childReferralCode,
    parentReferralCode,
    side
  });
  res.json({ success: true, message: 'Placement saved' });
}
