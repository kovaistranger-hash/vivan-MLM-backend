import { Request, Response } from 'express';
import { adminCreateCategory, adminListCategories, adminUpdateCategory } from './adminCategory.service.js';

export async function adminCategoriesList(_req: Request, res: Response) {
  const categories = await adminListCategories();
  res.json({ success: true, categories });
}

export async function adminCategoryCreate(req: Request, res: Response) {
  const body = req.body as { name: string; slug: string; is_active: boolean; parent_id?: number | null };
  const id = await adminCreateCategory(body);
  res.status(201).json({ success: true, id });
}

export async function adminCategoryUpdate(req: Request, res: Response) {
  const id = Number(req.params.id);
  const body = req.body as { name: string; slug: string; is_active: boolean; parent_id?: number | null };
  await adminUpdateCategory(id, body);
  res.json({ success: true });
}
