import { Request, Response } from 'express';
import { createRazorpayOrderForLocalOrder, verifyAndCaptureLocalOrder } from './razorpay.service.js';

export async function createRzpOrder(req: Request, res: Response) {
  const { orderId } = req.body as { orderId: number };
  const data = await createRazorpayOrderForLocalOrder(orderId, req.user!.id);
  res.json({ success: true, ...data });
}

export async function verifyRzpPayment(req: Request, res: Response) {
  const body = req.body as {
    localOrderId: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  };
  const result = await verifyAndCaptureLocalOrder({
    userId: req.user!.id,
    localOrderId: body.localOrderId,
    razorpayOrderId: body.razorpayOrderId,
    razorpayPaymentId: body.razorpayPaymentId,
    razorpaySignature: body.razorpaySignature
  });
  res.json({ success: true, ...result });
}
