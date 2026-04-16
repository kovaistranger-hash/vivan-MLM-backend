import type { Request, Response } from 'express';
import { calculateUserScore } from './scoring.service.js';

export async function adminScoringRecalculate(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  const r = await calculateUserScore(userId);
  res.json({ success: true, ...r });
}
