import { Request, Response } from 'express';
import { createOrder, getOrderByNumber, listMyOrders } from './order.service.js';
import { ApiError } from '../../utils/ApiError.js';

export async function placeOrder(req: Request, res: Response) {
  const body = req.body as {
    shippingName: string;
    shippingPhone: string;
    shippingAddress1: string;
    shippingAddress2?: string;
    shippingCity: string;
    shippingState: string;
    shippingPincode: string;
    paymentMethod: 'cod' | 'online';
    customerGstin?: string;
    walletAmount?: number;
  };
  const order = await createOrder(req.user!.id, {
    ...body,
    customerGstin: body.customerGstin || undefined,
    walletAmount: body.walletAmount
  });
  res.status(201).json({ success: true, order });
}

export async function myOrders(req: Request, res: Response) {
  const orders = await listMyOrders(req.user!.id);
  res.json({ success: true, orders });
}

export async function trackOrder(req: Request, res: Response) {
  const order = await getOrderByNumber(String(req.params.orderNumber));
  if (!order) throw new ApiError(404, 'Order not found');
  res.json({ success: true, order });
}
