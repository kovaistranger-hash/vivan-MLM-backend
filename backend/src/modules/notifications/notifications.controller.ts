import { Request, Response } from 'express';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
import { listNotificationsForUser } from './notification.service.js';

export async function notificationsList(req: Request, res: Response) {
  await ensureReferralSchemaExists();
  const userId = req.user!.id;
  const rows = await listNotificationsForUser(userId, 20);
  res.json({
    success: true,
    notifications: rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      message: r.message,
      is_read: Boolean(Number(r.is_read)),
      created_at: r.created_at
    }))
  });
}
