import type { Request, Response } from 'express';
import { adminDecideKyc, adminListPendingKyc } from './kyc.service.js';
import { kycAdminDecisionBodySchema } from './kyc.schemas.js';

export async function adminKycPendingList(req: Request, res: Response) {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
  const items = await adminListPendingKyc(limit);
  res.json({ success: true, items });
}

export async function adminKycDecision(req: Request, res: Response) {
  const recordId = Number(req.params.recordId);
  const body = kycAdminDecisionBodySchema.parse(req.body);
  await adminDecideKyc({
    recordId,
    adminUserId: req.user!.id,
    status: body.status,
    rejectionReason: body.rejectionReason ?? null
  });
  res.json({ success: true, message: 'KYC updated' });
}
