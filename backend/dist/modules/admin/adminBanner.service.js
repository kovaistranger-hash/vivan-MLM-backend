import { execute, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
export async function adminListBanners() {
    return query('SELECT * FROM banners ORDER BY sort_order ASC, id ASC');
}
export async function adminCreateBanner(input) {
    const res = await execute(`INSERT INTO banners (title, subtitle, image_url, link_url, sort_order, is_active)
     VALUES (:title, :subtitle, :imageUrl, :linkUrl, :sortOrder, :isActive)`, {
        title: input.title,
        subtitle: input.subtitle ?? null,
        imageUrl: input.image_url,
        linkUrl: input.link_url ?? null,
        sortOrder: input.sort_order,
        isActive: input.is_active ? 1 : 0
    });
    return Number(res.insertId);
}
export async function adminUpdateBanner(id, input) {
    const rows = await query('SELECT id FROM banners WHERE id = :id LIMIT 1', { id });
    if (!rows[0])
        throw new ApiError(404, 'Banner not found');
    await execute(`UPDATE banners SET
      title = :title,
      subtitle = :subtitle,
      image_url = :imageUrl,
      link_url = :linkUrl,
      sort_order = :sortOrder,
      is_active = :isActive,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = :id`, {
        id,
        title: input.title,
        subtitle: input.subtitle ?? null,
        imageUrl: input.image_url,
        linkUrl: input.link_url ?? null,
        sortOrder: input.sort_order,
        isActive: input.is_active ? 1 : 0
    });
}
export async function adminDeleteBanner(id) {
    const res = await execute('DELETE FROM banners WHERE id = :id', { id });
    if (!res.affectedRows)
        throw new ApiError(404, 'Banner not found');
}
