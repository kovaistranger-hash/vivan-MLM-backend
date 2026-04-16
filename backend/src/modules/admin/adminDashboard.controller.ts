import { Request, Response } from 'express';
import { getAdminDashboardMetrics } from './dashboard.service.js';

export async function adminDashboard(_req: Request, res: Response) {
  const metrics = await getAdminDashboardMetrics();
  res.json({ success: true, metrics });
}
