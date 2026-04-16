import type { Request, Response } from 'express';
import { adminFraudOverview, evaluateFraudRiskForUser } from './fraud.service.js';

export async function adminFraudOverviewGet(_req: Request, res: Response) {
  const data = await adminFraudOverview();
  res.json({ success: true, ...data });
}

export async function adminFraudScanUser(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  const result = await evaluateFraudRiskForUser(userId);
  res.json({ success: true, ...result });
}
