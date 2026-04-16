import { pool, query } from '../../db/mysql.js';
export async function restockOrderLines(orderId) {
    const items = await query('SELECT product_id, quantity FROM order_items WHERE order_id = :orderId', { orderId });
    for (const row of items) {
        if (!row.product_id)
            continue;
        await query('UPDATE products SET stock_qty = stock_qty + :q WHERE id = :id', { q: row.quantity, id: row.product_id });
    }
}
export async function restockOrderLinesTransactional(orderId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [items] = await conn.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
        for (const row of items) {
            if (!row.product_id)
                continue;
            await conn.query('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?', [row.quantity, row.product_id]);
        }
        await conn.commit();
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
}
