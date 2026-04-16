import { handleRazorpayWebhookEvent, verifyWebhookSignature } from './razorpay.service.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
export async function razorpayWebhook(req, res) {
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body || '');
    const signature = req.get('x-razorpay-signature');
    if (!env.razorpayWebhookSecret) {
        throw new ApiError(503, 'Webhook secret not configured');
    }
    if (!verifyWebhookSignature(rawBody, signature)) {
        throw new ApiError(400, 'Invalid webhook signature');
    }
    let payload;
    try {
        payload = JSON.parse(rawBody);
    }
    catch {
        throw new ApiError(400, 'Invalid JSON body');
    }
    await handleRazorpayWebhookEvent(payload);
    res.json({ success: true });
}
