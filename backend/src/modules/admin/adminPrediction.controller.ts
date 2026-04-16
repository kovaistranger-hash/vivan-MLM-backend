import type { Request, Response } from 'express';
import { getAdminProfitPrediction } from './dashboard.service.js';

export async function adminProfitPrediction(_req: Request, res: Response) {
  const prediction = await getAdminProfitPrediction();
  res.json({ success: true, ...prediction });
}
