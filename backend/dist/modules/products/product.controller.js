import { autocompleteProducts, getProductBySlug, listProducts } from './product.service.js';
import { ApiError } from '../../utils/ApiError.js';
export async function getProducts(req, res) {
    const q = req.validatedQuery;
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
export async function getProduct(req, res) {
    const product = await getProductBySlug(String(req.params.slug));
    if (!product)
        throw new ApiError(404, 'Product not found');
    res.json({ success: true, product });
}
export async function productAutocomplete(req, res) {
    const q = String(req.query.q || '').trim();
    const items = await autocompleteProducts(q, 10);
    res.json({ success: true, suggestions: items });
}
