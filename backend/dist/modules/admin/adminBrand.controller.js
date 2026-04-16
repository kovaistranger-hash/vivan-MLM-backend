import { query } from '../../db/mysql.js';
export async function adminBrandsList(_req, res) {
    const brands = await query('SELECT id, name, slug, is_active FROM brands WHERE is_active = 1 ORDER BY name ASC');
    res.json({ success: true, brands });
}
