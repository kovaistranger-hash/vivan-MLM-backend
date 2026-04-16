import { getAdminStatsPayload } from './dashboard.service.js';
export async function adminStats(_req, res) {
    const stats = await getAdminStatsPayload();
    res.json({ success: true, ...stats });
}
