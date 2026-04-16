import { query } from '../../db/mysql.js';
import { storefrontCategorySlugSqlList } from './storefrontCategories.js';
export async function getCategories(_req, res) {
    const categories = await query(`SELECT * FROM categories
     WHERE is_active = 1 AND parent_id IS NULL
       AND slug IN (${storefrontCategorySlugSqlList()})
     ORDER BY FIELD(slug, ${storefrontCategorySlugSqlList()})`);
    res.json({ success: true, categories });
}
export async function getCategoryTree(_req, res) {
    const categories = await query(`SELECT * FROM categories
     WHERE is_active = 1 AND parent_id IS NULL
       AND slug IN (${storefrontCategorySlugSqlList()})
     ORDER BY FIELD(slug, ${storefrontCategorySlugSqlList()})`);
    const byParent = new Map();
    for (const c of categories) {
        const key = c.parent_id;
        const list = byParent.get(key) ?? [];
        list.push(c);
        byParent.set(key, list);
    }
    function build(parentId) {
        const rows = byParent.get(parentId) ?? [];
        return rows.map((r) => ({
            id: r.id,
            parentId: r.parent_id,
            name: r.name,
            slug: r.slug,
            description: r.description,
            imageUrl: r.image_url,
            metaTitle: r.meta_title,
            metaDescription: r.meta_description,
            sortOrder: r.sort_order,
            children: build(r.id)
        }));
    }
    res.json({ success: true, tree: build(null) });
}
