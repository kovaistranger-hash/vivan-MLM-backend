import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import * as withdrawalService from './withdrawal.service.js';
import { getWithdrawalSettings } from './withdrawalSettings.service.js';

export async function withdrawalsList(req: Request, res: Response) {
  const q = (req as any).validatedQuery as { page?: number; pageSize?: number };
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const { items, total } = await withdrawalService.listUserWithdrawals(req.user!.id, page, pageSize);
  res.json({
    success: true,
    withdrawals: items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  });
}

export async function withdrawalsCreate(req: Request, res: Response) {
  const body = (req as any).validatedBody as { bankAccountId: number; amount: number; notes?: string | null };
  const row = await withdrawalService.createWithdrawalRequest(req.user!.id, {
    bankAccountId: body.bankAccountId,
    amount: body.amount,
    notes: body.notes
  });
  res.status(201).json({ success: true, withdrawal: row });
}

export async function withdrawalsCancel(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new ApiError(400, 'Invalid id');
  const row = await withdrawalService.cancelWithdrawalRequest(req.user!.id, id);
  res.json({ success: true, withdrawal: row });
}

/** Read-only rules for the withdrawal form (no admin-only secrets). */
export async function withdrawalRulesGet(_req: Request, res: Response) {
  const s = await getWithdrawalSettings();
  res.json({
    success: true,
    rules: {
      minWithdrawalAmount: s.min_withdrawal_amount,
      maxWithdrawalAmount: s.max_withdrawal_amount,
      withdrawalFeeType: s.withdrawal_fee_type,
      withdrawalFeeValue: s.withdrawal_fee_value,
      kycRequired: !!s.kyc_required,
      allowUpi: !!s.allow_upi,
      allowBankTransfer: !!s.allow_bank_transfer,
      onePendingRequestOnly: !!s.one_pending_request_only
    }
  });
}
