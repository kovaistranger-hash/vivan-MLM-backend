import { execute, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';

export async function createReview(input: { userId: number; productSlug: string; rating: number; title?: string; body?: string }) {
  const products = await query<{ id: number }[]>('SELECT id FROM products WHERE slug = :slug AND is_active = 1 LIMIT 1', {
    slug: input.productSlug
  });
  const product = products[0];
  if (!product) throw new ApiError(404, 'Product not found');

  const existing = await query<any[]>(
    'SELECT id FROM product_reviews WHERE user_id = :userId AND product_id = :productId LIMIT 1',
    { userId: input.userId, productId: product.id }
  );
  if (existing.length) throw new ApiError(409, 'You have already reviewed this product');

  await execute(
    `INSERT INTO product_reviews (product_id, user_id, rating, title, body, is_approved)
     VALUES (:productId, :userId, :rating, :title, :body, 1)`,
    {
      productId: product.id,
      userId: input.userId,
      rating: input.rating,
      title: input.title || null,
      body: input.body || null
    }
  );

  return { productId: product.id };
}
