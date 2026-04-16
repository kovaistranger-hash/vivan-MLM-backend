import { Request, Response } from 'express';
import { autocompleteProducts, getProductBySlug, listProducts } from './product.service.js';
import { ApiError } from '../../utils/ApiError.js';

export async function getProducts(req: Request, res: Response) {
  const q = (req as any).validatedQuery as {
    search?: string;
    categoryId?: number;
    minPrice?: number;
    maxPrice?: number;
    minBv?: number;
    maxBv?: number;
    featured?: string;
    newArrival?: string;
    bestseller?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  };

  const pageSize = q.pageSize ?? 12;
  const page = q.page ?? 1;
  const offset = (page - 1) * pageSize;

  const { items, total } = await listProducts({
    search: q.search,
    categoryId: q.categoryId,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    minBv: q.minBv,
    maxBv: q.maxBv,
    featured: q.featured,
    newArrival: q.newArrival,
    bestseller: q.bestseller,
    sort: q.sort,
    limit: pageSize,
    offset
  });

  res.json({
    success: true,
    products: items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
}

export async function getProduct(req: Request, res: Response) {
  const product = await getProductBySlug(String(req.params.slug));
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, product });
}

export async function productAutocomplete(req: Request, res: Response) {
  const q = String(req.query.q || '').trim();
  const items = await autocompleteProducts(q, 10);
  res.json({ success: true, suggestions: items });
}
