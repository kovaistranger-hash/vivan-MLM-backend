import { createRazorpayOrderForLocalOrder, verifyAndCaptureLocalOrder } from './razorpay.service.js';
export async function createRzpOrder(req, res) {
    const { orderId } = req.body;
    const data = await createRazorpayOrderForLocalOrder(orderId, req.user.id);
    res.json({ success: true, ...data });
}
export async function verifyRzpPayment(req, res) {
    const body = req.body;
    const result = await verifyAndCaptureLocalOrder({
        userId: req.user.id,
        localOrderId: body.localOrderId,
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        razorpaySignature: body.razorpaySignature
    });
    res.json({ success: true, ...result });
}
