import { query } from '../../db/mysql.js';
export async function getOrderById(orderId) {
    const rows = await query('SELECT * FROM orders WHERE id = :id LIMIT 1', { id: orderId });
    return rows[0] || null;
}
export async function getOrderByIdForUser(orderId, userId) {
    const rows = await query('SELECT * FROM orders WHERE id = :id AND user_id = :userId LIMIT 1', {
        id: orderId,
        userId
    });
    return rows[0] || null;
}
export async function getOrderItems(orderId) {
    return query(`SELECT id, product_id, product_name, product_slug, unit_price, gst_rate, line_gst, quantity, line_total
     FROM order_items WHERE order_id = :orderId`, { orderId });
}
