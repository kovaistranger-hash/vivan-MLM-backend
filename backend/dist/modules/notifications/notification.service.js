import { execute, query } from '../../db/mysql.js';
import { sendExpoPushToUser } from './expoPush.service.js';
export async function createNotification(conn, userId, message) {
    if (!Number.isFinite(userId) || userId <= 0)
        return;
    const trimmed = String(message || '').trim();
    if (!trimmed)
        return;
    if (conn) {
        await conn.query(`INSERT INTO notifications (user_id, message) VALUES (?, ?)`, [userId, trimmed]);
    }
    else {
        await execute(`INSERT INTO notifications (user_id, message) VALUES (?, ?)`, [userId, trimmed]);
        void sendExpoPushToUser(userId, 'Vivan', trimmed).catch(() => undefined);
    }
}
export async function listNotificationsForUser(userId, limit = 20) {
    const rows = await query(`SELECT id, user_id, message, is_read, created_at
     FROM notifications
     WHERE user_id = :userId
     ORDER BY created_at DESC
     LIMIT :lim`, { userId, lim: Math.min(100, Math.max(1, limit)) });
    return rows ?? [];
}
