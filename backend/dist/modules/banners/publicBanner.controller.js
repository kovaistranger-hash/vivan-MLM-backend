import { query } from '../../db/mysql.js';
export async function listPublicBanners(_req, res) {
    const banners = await query('SELECT id, title, subtitle, image_url, link_url, sort_order FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, banners });
}
