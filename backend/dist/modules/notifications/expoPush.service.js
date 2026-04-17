import { query } from '../../db/mysql.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
/**
 * Sends one Expo push notification when `users.expo_token` holds an Expo push token.
 * Optional `EXPO_ACCESS_TOKEN` improves reliability for production (Expo dashboard).
 */
export async function sendExpoPushToUser(userId, title, body) {
    const rows = await query(`SELECT expo_token FROM users WHERE id = :id LIMIT 1`, { id: userId });
    const token = String(rows[0]?.expo_token || '').trim();
    if (!token || !token.startsWith('ExponentPushToken'))
        return;
    const payload = {
        to: token,
        title: String(title || 'Vivan').slice(0, 120),
        body: String(body || '').slice(0, 240),
        sound: 'default',
        priority: 'high'
    };
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
    };
    if (env.expoAccessToken) {
        headers.Authorization = `Bearer ${env.expoAccessToken}`;
    }
    try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const t = await res.text();
            logger.warn('Expo push send failed', { userId, status: res.status, detail: t.slice(0, 300) });
        }
    }
    catch (e) {
        logger.warn('Expo push send error', { userId, err: e instanceof Error ? e.message : String(e) });
    }
}
