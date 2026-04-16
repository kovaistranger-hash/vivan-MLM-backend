import { Request, Response } from 'express';
import { computeOrderPricing } from './order.service.js';
import { getWalletBalance } from '../wallet/wallet.service.js';

export async function checkoutPreview(req: Request, res: Response) {
  const q = (req as any).validatedQuery as { pincode: string; walletAmount?: number };
  const r = await computeOrderPricing(req.user!.id, q.pincode, {
    walletApplyAmount: q.walletAmount
  });
  if (!r.ok) return res.status(400).json({ success: false, message: r.message });
  const walletBalance = await getWalletBalance(req.user!.id);
  res.json({
    success: true,
    merchandiseSubtotal: r.merchandiseSubtotal,
    gstTotal: r.gstTotal,
    shippingAmount: r.shippingAmount,
    totalAmount: r.totalAmount,
    grossTotal: r.grossTotal,
    walletApplied: r.walletApplied,
    payableTotal: r.payableTotal,
    walletBalance,
    zonesConfigured: r.zonesConfigured,
    codGloballyEnabled: r.codEnabled,
    codAvailableForPin: r.codAllowedForPin,
    freeShippingAbove: r.freeShippingAbove,
    defaultShippingFee: r.defaultShippingFee,
    delivery: r.zone
  });
}
