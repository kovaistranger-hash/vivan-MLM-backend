import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { query, execute } from '../../db/mysql.js';
import { getCompensationSettings } from '../mlm/compensationSettings.service.js';
import { dispatchOrderCommissionJob } from '../../queue/commission.dispatch.js';
import { deletePendingPaymentsForOrder, insertPaymentAttempt, updatePaymentCaptured } from './payment.service.js';
import { restockOrderLinesTransactional } from '../orders/order.restock.js';
function requireRazorpay() {
    if (!env.razorpayKeyId || !env.razorpayKeySecret) {
        throw new ApiError(503, 'Razorpay is not configured on the server');
    }
    return new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret });
}
function rupeesToPaise(amount) {
    return Math.round(Number(amount) * 100);
}
export function verifyPaymentSignature(orderId, paymentId, signature) {
    requireRazorpay();
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', env.razorpayKeySecret).update(body).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    }
    catch {
        return false;
    }
}
export async function createRazorpayOrderForLocalOrder(localOrderId, userId) {
    const rzp = requireRazorpay();
    const rows = await query('SELECT * FROM orders WHERE id = :id AND user_id = :userId LIMIT 1', {
        id: localOrderId,
        userId
    });
    const order = rows[0];
    if (!order)
        throw new ApiError(404, 'Order not found');
    if (order.payment_method !== 'online')
        throw new ApiError(400, 'Order is not an online payment order');
    if (order.payment_status === 'paid')
        throw new ApiError(400, 'Order already paid');
    const amountPaise = rupeesToPaise(order.total_amount);
    if (amountPaise < 100)
        throw new ApiError(400, 'Order amount too small for Razorpay');
    await deletePendingPaymentsForOrder(localOrderId);
    const rzpOrder = await rzp.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `VVN${localOrderId}`.slice(0, 40),
        payment_capture: true
    });
    const paymentRowId = await insertPaymentAttempt({
        orderId: localOrderId,
        providerOrderId: rzpOrder.id,
        amountPaise,
        currency: 'INR',
        status: 'rzp_created',
        raw: rzpOrder
    });
    return {
        keyId: env.razorpayKeyId,
        amount: amountPaise,
        currency: 'INR',
        orderId: rzpOrder.id,
        paymentDbId: paymentRowId,
        localOrderId,
        orderNumber: order.order_number
    };
}
export async function verifyAndCaptureLocalOrder(input) {
    if (!verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
        throw new ApiError(400, 'Invalid payment signature');
    }
    const rows = await query('SELECT * FROM orders WHERE id = :id AND user_id = :userId LIMIT 1', {
        id: input.localOrderId,
        userId: input.userId
    });
    const order = rows[0];
    if (!order)
        throw new ApiError(404, 'Order not found');
    if (order.payment_status === 'paid') {
        return { orderNumber: order.order_number, alreadyPaid: true };
    }
    const payRows = await query(`SELECT * FROM payments WHERE order_id = :orderId AND provider_order_id = :rzpOrder ORDER BY id DESC LIMIT 1`, { orderId: input.localOrderId, rzpOrder: input.razorpayOrderId });
    const paymentRow = payRows[0];
    if (!paymentRow)
        throw new ApiError(400, 'Payment intent not found for this order');
    const expectedPaise = rupeesToPaise(order.total_amount);
    if (Number(paymentRow.amount_paise) !== expectedPaise)
        throw new ApiError(400, 'Amount mismatch');
    await updatePaymentCaptured({
        paymentRowId: paymentRow.id,
        providerPaymentId: input.razorpayPaymentId,
        providerSignature: input.razorpaySignature
    });
    await execute(`UPDATE orders SET payment_status = 'paid', status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = :id AND payment_status <> 'paid'`, { id: input.localOrderId });
    const settings = await getCompensationSettings();
    if (settings.trigger_stage === 'paid') {
        await dispatchOrderCommissionJob(input.localOrderId);
    }
    return { orderNumber: order.order_number, alreadyPaid: false };
}
export function verifyWebhookSignature(rawBody, signatureHeader) {
    if (!env.razorpayWebhookSecret)
        return false;
    if (!signatureHeader)
        return false;
    const expected = crypto.createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
    }
    catch {
        return false;
    }
}
export async function handleRazorpayWebhookEvent(payload) {
    const event = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;
    console.log('[Razorpay webhook]', event, JSON.stringify(payload).slice(0, 500));
    if (event === 'payment.captured') {
        const rzpPaymentId = paymentEntity?.id;
        const rzpOrderId = paymentEntity?.order_id;
        if (!rzpPaymentId || !rzpOrderId)
            return;
        const pays = await query(`SELECT p.id AS payment_id, p.order_id AS local_order_id, p.amount_paise, o.payment_status, o.total_amount
       FROM payments p
       INNER JOIN orders o ON o.id = p.order_id
       WHERE p.provider_order_id = :rzpOrder AND p.provider = 'razorpay'
       ORDER BY p.id DESC LIMIT 1`, { rzpOrder: rzpOrderId });
        const row = pays[0];
        if (!row)
            return;
        if (row.payment_status === 'paid')
            return;
        const expectedPaise = rupeesToPaise(row.total_amount);
        if (Number(row.amount_paise) !== expectedPaise) {
            console.error('[Razorpay webhook] amount mismatch', { localOrderId: row.local_order_id });
            return;
        }
        await execute(`UPDATE payments SET provider_payment_id = :pid, status = 'captured', raw_payload_json = :raw, updated_at = CURRENT_TIMESTAMP WHERE id = :id`, { pid: rzpPaymentId, raw: JSON.stringify(payload), id: row.payment_id });
        await execute(`UPDATE orders SET payment_status = 'paid', status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = :id AND payment_status <> 'paid'`, { id: row.local_order_id });
        const settings = await getCompensationSettings();
        if (settings.trigger_stage === 'paid') {
            await dispatchOrderCommissionJob(row.local_order_id);
        }
    }
    if (event === 'payment.failed') {
        const rzpOrderId = paymentEntity?.order_id;
        if (!rzpOrderId)
            return;
        const pays = await query(`SELECT p.id AS payment_id, p.order_id AS local_order_id, o.payment_status
       FROM payments p INNER JOIN orders o ON o.id = p.order_id
       WHERE p.provider_order_id = :rzpOrder ORDER BY p.id DESC LIMIT 1`, { rzpOrder: rzpOrderId });
        const row = pays[0];
        if (!row || row.payment_status === 'paid')
            return;
        await execute(`UPDATE payments SET status = 'failed', raw_payload_json = :raw, updated_at = CURRENT_TIMESTAMP WHERE id = :id`, { raw: JSON.stringify(payload), id: row.payment_id });
        await execute(`UPDATE orders SET payment_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = :id AND payment_status = 'pending'`, { id: row.local_order_id });
        await restockOrderLinesTransactional(row.local_order_id);
    }
}
