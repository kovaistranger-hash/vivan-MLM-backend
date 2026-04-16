import { adminCreateCategory, adminListCategories, adminUpdateCategory } from './adminCategory.service.js';
export async function adminCategoriesList(_req, res) {
    const categories = await adminListCategories();
    res.json({ success: true, categories });
}
export async function adminCategoryCreate(req, res) {
    const body = req.body;
    const id = await adminCreateCategory(body);
    res.status(201).json({ success: true, id });
}
export async function adminCategoryUpdate(req, res) {
    const id = Number(req.params.id);
    const body = req.body;
    await adminUpdateCategory(id, body);
    res.json({ success: true });
}
