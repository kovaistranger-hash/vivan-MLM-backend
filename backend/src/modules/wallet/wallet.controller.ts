import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { computeOrderPricing } from '../orders/order.service.js';
import {
  clearCheckoutIntent,
  getOrCreateWallet,
  getWalletBalance,
  getWalletSummaryForUser,
  listWalletTransactions,
  setCheckoutIntent
} from './wallet.service.js';

export async function walletGetSummary(req: Request, res: Response) {
  const userId = req.user!.id;
  const summary = await getWalletSummaryForUser(userId);
  res.json({ success: true, wallet: summary });
}

export async function walletListTransactions(req: Request, res: Response) {
  const q = (req as any).validatedQuery as { page?: number; pageSize?: number };
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const { items, total } = await listWalletTransactions({ userId: req.user!.id, page, pageSize });
  res.json({
    success: true,
    transactions: items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  });
}

export async function walletUse(req: Request, res: Response) {
  const body = req.body as { amount: number; pincode: string };
  const userId = req.user!.id;
  await getOrCreateWallet(userId);
  const priced = await computeOrderPricing(userId, body.pincode, { walletApplyAmount: body.amount });
  if (!priced.ok) throw new ApiError(400, priced.message);
  const balance = await getWalletBalance(userId);
  const maxAllow = priced.grossTotal;
  const applied = await setCheckoutIntent(userId, body.amount, maxAllow, balance);
  res.json({
    success: true,
    appliedAmount: applied,
    grossTotal: priced.grossTotal,
    payableTotal: priced.payableTotal,
    walletBalance: balance
  });
}

export async function walletRemove(req: Request, res: Response) {
  await clearCheckoutIntent(req.user!.id);
  res.json({ success: true });
}
