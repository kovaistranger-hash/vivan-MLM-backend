import { adminGetOrder, adminListOrders, adminUpdateOrderStatus } from './adminOrder.service.js';
import { ApiError } from '../../utils/ApiError.js';
export async function adminOrdersList(req, res) {
    const q = req.validatedQuery;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const { items, total } = await adminListOrders({ status: q.status, page, pageSize });
    res.json({
        success: true,
        orders: items,
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    });
}
export async function adminOrderGet(req, res) {
    const order = await adminGetOrder(Number(req.params.id));
    if (!order)
        throw new ApiError(404, 'Order not found');
    res.json({ success: true, order });
}
export async function adminOrderPatchStatus(req, res) {
    const body = req.body;
    await adminUpdateOrderStatus(Number(req.params.id), body.status, {
        refundToWallet: body.refundToWallet,
        adminUserId: req.user.id
    });
    res.json({ success: true });
}
