import { execute, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
export async function adminListCategories() {
    return query(`SELECT c.*, p.slug AS parent_slug, p.name AS parent_name
     FROM categories c
     LEFT JOIN categories p ON p.id = c.parent_id
     ORDER BY c.sort_order ASC, c.name ASC`);
}
async function assertCategorySlugUnique(slug, excludeId) {
    const rows = excludeId
        ? await query('SELECT id FROM categories WHERE slug = :slug AND id <> :id LIMIT 1', { slug, id: excludeId })
        : await query('SELECT id FROM categories WHERE slug = :slug LIMIT 1', { slug });
    if (rows.length)
        throw new ApiError(409, 'Category slug already in use');
}
export async function adminCreateCategory(input) {
    await assertCategorySlugUnique(input.slug);
    const res = await execute(`INSERT INTO categories (parent_id, name, slug, is_active, sort_order)
     VALUES (:parentId, :name, :slug, :isActive, 0)`, {
        parentId: input.parent_id ?? null,
        name: input.name,
        slug: input.slug,
        isActive: input.is_active ? 1 : 0
    });
    return Number(res.insertId);
}
export async function adminUpdateCategory(id, input) {
    const rows = await query('SELECT id, slug FROM categories WHERE id = :id LIMIT 1', { id });
    if (!rows[0])
        throw new ApiError(404, 'Category not found');
    if (input.slug !== rows[0].slug)
        await assertCategorySlugUnique(input.slug, id);
    if (input.parent_id === id)
        throw new ApiError(400, 'Category cannot be its own parent');
    await execute(`UPDATE categories SET
      parent_id = :parentId,
      name = :name,
      slug = :slug,
      is_active = :isActive,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = :id`, {
        id,
        parentId: input.parent_id ?? null,
        name: input.name,
        slug: input.slug,
        isActive: input.is_active ? 1 : 0
    });
}
