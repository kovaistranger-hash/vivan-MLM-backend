import type { Request, Response } from 'express';
import { getAdminStatsPayload } from './dashboard.service.js';

export async function adminStats(_req: Request, res: Response) {
  const stats = await getAdminStatsPayload();
  res.json({ success: true, ...stats });
}
