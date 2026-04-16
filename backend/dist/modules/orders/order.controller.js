import { createOrder, getOrderByNumber, listMyOrders } from './order.service.js';
import { ApiError } from '../../utils/ApiError.js';
export async function placeOrder(req, res) {
    const body = req.body;
    const order = await createOrder(req.user.id, {
        ...body,
        customerGstin: body.customerGstin || undefined,
        walletAmount: body.walletAmount
    });
    res.status(201).json({ success: true, order });
}
export async function myOrders(req, res) {
    const orders = await listMyOrders(req.user.id);
    res.json({ success: true, orders });
}
export async function trackOrder(req, res) {
    const order = await getOrderByNumber(String(req.params.orderNumber));
    if (!order)
        throw new ApiError(404, 'Order not found');
    res.json({ success: true, order });
}
