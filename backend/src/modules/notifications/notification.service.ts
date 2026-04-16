import type { PoolConnection } from 'mysql2/promise';
import { execute, query } from '../../db/mysql.js';
import { sendExpoPushToUser } from './expoPush.service.js';

export async function createNotification(
  conn: PoolConnection | null | undefined,
  userId: number,
  message: string
): Promise<void> {
  if (!Number.isFinite(userId) || userId <= 0) return;
  const trimmed = String(message || '').trim();
  if (!trimmed) return;

  if (conn) {
    await conn.query(`INSERT INTO notifications (user_id, message) VALUES (?, ?)`, [userId, trimmed]);
  } else {
    await execute(`INSERT INTO notifications (user_id, message) VALUES (?, ?)`, [userId, trimmed]);
    void sendExpoPushToUser(userId, 'Vivan', trimmed).catch(() => undefined);
  }
}

export type NotificationRow = {
  id: number;
  user_id: number;
  message: string;
  is_read: number;
  created_at: Date | string;
};

export async function listNotificationsForUser(userId: number, limit = 20): Promise<NotificationRow[]> {
  const rows = await query<NotificationRow[]>(
    `SELECT id, user_id, message, is_read, created_at
     FROM notifications
     WHERE user_id = :userId
     ORDER BY created_at DESC
     LIMIT :lim`,
    { userId, lim: Math.min(100, Math.max(1, limit)) }
  );
  return rows ?? [];
}
