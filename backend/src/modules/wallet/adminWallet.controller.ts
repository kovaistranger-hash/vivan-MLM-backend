import { Request, Response } from 'express';
import {
  adminCreditUserWallet,
  adminDebitUserWallet,
  adminGetWalletDetail,
  adminListWallets,
  adminManualRefundToWallet,
  adminUnlockWalletFraudLock
} from './adminWallet.service.js';

export async function adminWalletsList(req: Request, res: Response) {
  const q = (req as any).validatedQuery as { search?: string; page?: number; pageSize?: number };
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const { items, total } = await adminListWallets({ search: q.search, page, pageSize });
  res.json({
    success: true,
    wallets: items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  });
}

export async function adminWalletGet(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  const data = await adminGetWalletDetail(userId);
  res.json({ success: true, ...data });
}

export async function adminWalletCredit(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  const body = req.body as { amount: number; description: string };
  await adminCreditUserWallet(userId, req.user!.id, body.amount, body.description);
  res.json({ success: true });
}

export async function adminWalletDebit(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  const body = req.body as { amount: number; description: string };
  await adminDebitUserWallet(userId, req.user!.id, body.amount, body.description);
  res.json({ success: true });
}

export async function adminWalletRefund(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  const body = req.body as { amount: number; description: string; reference_type: string; reference_id: number };
  await adminManualRefundToWallet(userId, req.user!.id, body.amount, body.description, body.reference_type, body.reference_id);
  res.json({ success: true });
}

export async function adminWalletUnlockFraud(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  await adminUnlockWalletFraudLock(userId);
  res.json({ success: true });
}
