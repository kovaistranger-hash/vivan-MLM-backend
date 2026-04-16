import { query } from '../../db/mysql.js';

export async function getOrderById(orderId: number) {
  const rows = await query<any[]>('SELECT * FROM orders WHERE id = :id LIMIT 1', { id: orderId });
  return rows[0] || null;
}

export async function getOrderByIdForUser(orderId: number, userId: number) {
  const rows = await query<any[]>('SELECT * FROM orders WHERE id = :id AND user_id = :userId LIMIT 1', {
    id: orderId,
    userId
  });
  return rows[0] || null;
}

export async function getOrderItems(orderId: number) {
  return query<any[]>(
    `SELECT id, product_id, product_name, product_slug, unit_price, gst_rate, line_gst, quantity, line_total
     FROM order_items WHERE order_id = :orderId`,
    { orderId }
  );
}
