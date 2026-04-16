import { pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { getOrderItems } from '../orders/order.read.service.js';
import { reverseOrderCommissionsIfConfigured } from '../mlm/commission.service.js';
import { dispatchOrderCommissionJob } from '../../queue/commission.dispatch.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
import { creditOrderRefundToWallet } from '../wallet/wallet.service.js';
const ORDER_STATUSES = ['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
export async function adminListOrders(params) {
    const where = ['1=1'];
    const values = {
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize
    };
    if (params.status && ORDER_STATUSES.includes(params.status)) {
        where.push('o.status = :status');
        values.status = params.status;
    }
    const sql = `
    SELECT o.*, u.name AS user_name, u.email AS user_email
    FROM orders o
    INNER JOIN users u ON u.id = o.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY o.id DESC
    LIMIT :limit OFFSET :offset
  `;
    const items = await query(sql, values);
    const { limit, offset, ...countVals } = values;
    const countRows = await query(`SELECT COUNT(*) AS total FROM orders o WHERE ${where.join(' AND ')}`, countVals);
    return { items, total: Number(countRows[0]?.total || 0) };
}
export async function adminGetOrder(id) {
    const rows = await query(`SELECT o.*, u.name AS user_name, u.email AS user_email
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     WHERE o.id = :id LIMIT 1`, { id });
    const order = rows[0];
    if (!order)
        return null;
    const items = await getOrderItems(id);
    return { ...order, items };
}
function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
export async function adminUpdateOrderStatus(id, status, opts) {
    await ensureReferralSchemaExists();
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [ordRows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
        const order = ordRows[0];
        if (!order)
            throw new ApiError(404, 'Order not found');
        if (status === 'cancelled' || status === 'returned') {
            await reverseOrderCommissionsIfConfigured(conn, id);
        }
        if (opts?.refundToWallet && (status === 'cancelled' || status === 'returned')) {
            const wAmt = round2(Number(order.wallet_amount || 0));
            const net = round2(Number(order.total_amount || 0));
            let refundAmt = wAmt;
            if (String(order.payment_status) === 'paid')
                refundAmt = round2(refundAmt + net);
            if (refundAmt > 0) {
                await creditOrderRefundToWallet(conn, Number(order.user_id), refundAmt, {
                    orderId: id,
                    description: `Refund to wallet for order ${order.order_number} (${status})`,
                    createdBy: opts.adminUserId ?? null
                });
            }
            const nextPay = refundAmt > 0 ? 'refunded' : order.payment_status;
            await conn.query(`UPDATE orders SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, nextPay, id]);
        }
        else {
            await conn.query(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);
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
    if (status === 'delivered') {
        try {
            await dispatchOrderCommissionJob(id);
        }
        catch (e) {
            console.error('[adminOrder] commission dispatch failed', { orderId: id, e });
        }
    }
}
