import { execute } from '../../db/mysql.js';
export async function insertPaymentAttempt(input) {
    const res = await execute(`INSERT INTO payments (order_id, provider, provider_order_id, amount_paise, currency, status, raw_payload_json)
     VALUES (:orderId, 'razorpay', :providerOrderId, :amountPaise, :currency, :status, :raw)`, {
        orderId: input.orderId,
        providerOrderId: input.providerOrderId,
        amountPaise: input.amountPaise,
        currency: input.currency,
        status: input.status,
        raw: input.raw ? JSON.stringify(input.raw) : null
    });
    return Number(res.insertId);
}
export async function updatePaymentCaptured(input) {
    await execute(`UPDATE payments SET provider_payment_id = :pid, provider_signature = :sig, status = 'captured', raw_payload_json = COALESCE(:raw, raw_payload_json), updated_at = CURRENT_TIMESTAMP
     WHERE id = :id`, {
        pid: input.providerPaymentId,
        sig: input.providerSignature,
        raw: input.raw ? JSON.stringify(input.raw) : null,
        id: input.paymentRowId
    });
}
export async function updatePaymentFailed(paymentRowId, raw) {
    await execute(`UPDATE payments SET status = 'failed', raw_payload_json = COALESCE(:raw, raw_payload_json), updated_at = CURRENT_TIMESTAMP WHERE id = :id`, { raw: raw ? JSON.stringify(raw) : null, id: paymentRowId });
}
export async function deletePendingPaymentsForOrder(orderId) {
    await execute(`DELETE FROM payments WHERE order_id = :orderId AND status IN ('pending','rzp_created')`, { orderId });
}
