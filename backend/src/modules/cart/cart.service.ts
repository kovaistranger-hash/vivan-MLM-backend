import { query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';

export async function getCart(userId: number) {
  const rows = await query<any[]>(
    `SELECT ci.id, ci.quantity,
            p.id AS product_id, p.name, p.slug, p.sale_price, p.mrp_price, p.image_url,
            p.gst_rate, p.bv, p.pv, p.stock_qty
     FROM cart_items ci
     INNER JOIN products p ON p.id = ci.product_id AND p.deleted_at IS NULL
     WHERE ci.user_id = :userId`,
    { userId }
  );

  const subtotal = rows.reduce((sum, row) => sum + Number(row.sale_price) * Number(row.quantity), 0);
  return { items: rows, subtotal };
}

export async function addToCart(userId: number, productId: number, quantity: number) {
  const products = await query<any[]>(
    'SELECT id, stock_qty, is_active FROM products WHERE id = :productId AND deleted_at IS NULL LIMIT 1',
    { productId }
  );
  const product = products[0];
  if (!product || !product.is_active) throw new ApiError(404, 'Product not found');
  if (product.stock_qty < quantity) throw new ApiError(400, 'Insufficient stock');

  const existing = await query<any[]>('SELECT id, quantity FROM cart_items WHERE user_id = :userId AND product_id = :productId LIMIT 1', {
    userId,
    productId
  });

  if (existing[0]) {
    const nextQty = Number(existing[0].quantity) + quantity;
    if (product.stock_qty < nextQty) throw new ApiError(400, 'Insufficient stock');
    await query('UPDATE cart_items SET quantity = :quantity WHERE id = :id', { quantity: nextQty, id: existing[0].id });
  } else {
    await query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (:userId, :productId, :quantity)', {
      userId,
      productId,
      quantity
    });
  }

  return getCart(userId);
}

export async function updateCartItem(userId: number, itemId: number, quantity: number) {
  if (quantity <= 0) {
    await removeCartItem(userId, itemId);
    return getCart(userId);
  }

  const rows = await query<any[]>(
    `SELECT ci.id, p.stock_qty
     FROM cart_items ci
     INNER JOIN products p ON p.id = ci.product_id AND p.deleted_at IS NULL
     WHERE ci.id = :itemId AND ci.user_id = :userId
     LIMIT 1`,
    { itemId, userId }
  );
  if (!rows[0]) throw new ApiError(404, 'Cart item not found');
  if (rows[0].stock_qty < quantity) throw new ApiError(400, 'Insufficient stock');

  await query('UPDATE cart_items SET quantity = :quantity WHERE id = :itemId AND user_id = :userId', { quantity, itemId, userId });
  return getCart(userId);
}

export async function removeCartItem(userId: number, itemId: number) {
  await query('DELETE FROM cart_items WHERE id = :itemId AND user_id = :userId', { itemId, userId });
  return getCart(userId);
}

export async function clearCart(userId: number) {
  await query('DELETE FROM cart_items WHERE user_id = :userId', { userId });
}
