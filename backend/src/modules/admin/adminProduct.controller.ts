import { Request, Response } from 'express';
import {
  adminCreateProduct,
  adminGetProduct,
  adminListProducts,
  adminPatchProductFlags,
  adminSoftDeleteProduct,
  adminSuggestProductIdentifiers,
  adminUpdateProduct,
  type AdminProductPayload
} from './adminProduct.service.js';
import { ApiError } from '../../utils/ApiError.js';

function normalizeProductBody(body: any): AdminProductPayload {
  return {
    category_id: body.category_id ?? null,
    brand_id: body.brand_id ?? null,
    name: body.name,
    slug: body.slug,
    sku: body.sku || null,
    short_description: body.short_description || null,
    long_description: body.long_description || null,
    mrp_price: body.mrp_price,
    sale_price: body.sale_price,
    bv: body.bv,
    pv: body.pv,
    gst_rate: body.gst_rate,
    stock_qty: body.stock_qty,
    image_url: body.image_url || null,
    gallery_json: body.gallery_json ?? null,
    is_active: Boolean(body.is_active),
    is_featured: Boolean(body.is_featured),
    is_new_arrival: Boolean(body.is_new_arrival),
    is_bestseller: Boolean(body.is_bestseller)
  };
}

export async function adminProductsList(req: Request, res: Response) {
  const q = (req as any).validatedQuery as {
    search?: string;
    page?: number;
    pageSize?: number;
    includeDeleted?: string;
    categoryId?: number;
    isActive?: 'all' | '1' | '0';
    lowStock?: string;
  };
  const includeDeleted = q.includeDeleted === '1' || q.includeDeleted === 'true';
  const lowStockOnly = q.lowStock === '1' || q.lowStock === 'true';
  const { items, total, lowStockThreshold } = await adminListProducts({
    search: q.search,
    page: q.page ?? 1,
    pageSize: q.pageSize ?? 20,
    includeDeleted,
    categoryId: q.categoryId,
    isActive: q.isActive ?? 'all',
    lowStockOnly
  });
  res.json({
    success: true,
    products: items,
    pagination: { page: q.page ?? 1, pageSize: q.pageSize ?? 20, total, totalPages: Math.max(1, Math.ceil(total / (q.pageSize ?? 20))) },
    lowStockThreshold
  });
}

export async function adminProductGet(req: Request, res: Response) {
  const id = Number(req.params.id);
  const row = await adminGetProduct(id);
  if (!row) throw new ApiError(404, 'Product not found');
  res.json({ success: true, product: row });
}

export async function adminProductCreate(req: Request, res: Response) {
  const id = await adminCreateProduct(normalizeProductBody(req.body));
  res.status(201).json({ success: true, id });
}

export async function adminProductUpdate(req: Request, res: Response) {
  const id = Number(req.params.id);
  await adminUpdateProduct(id, normalizeProductBody(req.body));
  res.json({ success: true });
}

export async function adminProductDelete(req: Request, res: Response) {
  await adminSoftDeleteProduct(Number(req.params.id));
  res.json({ success: true });
}

export async function adminProductPatchFlags(req: Request, res: Response) {
  const id = Number(req.params.id);
  await adminPatchProductFlags(id, req.body);
  res.json({ success: true });
}

export async function adminProductSuggestIdentifiers(req: Request, res: Response) {
  const q = (req as any).validatedQuery as {
    name?: string;
    categoryId?: number;
    productId?: number;
  };
  const { suggestedSlug, suggestedSku } = await adminSuggestProductIdentifiers({
    name: q.name,
    categoryId: q.categoryId,
    excludeProductId: q.productId
  });
  res.json({ success: true, suggestedSlug, suggestedSku });
}
