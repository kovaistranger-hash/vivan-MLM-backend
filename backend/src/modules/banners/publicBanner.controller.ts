import { Request, Response } from 'express';
import { query } from '../../db/mysql.js';

export async function listPublicBanners(_req: Request, res: Response) {
  const banners = await query<any[]>(
    'SELECT id, title, subtitle, image_url, link_url, sort_order FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
  );
  res.json({ success: true, banners });
}
