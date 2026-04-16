import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import * as bankAccountService from './bankAccount.service.js';

export async function bankAccountsList(req: Request, res: Response) {
  const items = await bankAccountService.listBankAccounts(req.user!.id);
  res.json({ success: true, bankAccounts: items });
}

export async function bankAccountsCreate(req: Request, res: Response) {
  const body = (req as any).validatedBody as {
    account_holder_name: string;
    bank_name: string;
    account_number?: string;
    ifsc_code?: string;
    branch_name?: string;
    upi_id?: string;
    is_default?: boolean;
  };
  const row = await bankAccountService.createBankAccount(req.user!.id, {
    account_holder_name: body.account_holder_name,
    bank_name: body.bank_name,
    account_number: body.account_number ?? null,
    ifsc_code: body.ifsc_code ?? null,
    branch_name: body.branch_name ?? null,
    upi_id: body.upi_id ?? null,
    is_default: body.is_default
  });
  res.status(201).json({ success: true, bankAccount: row });
}

export async function bankAccountsUpdate(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new ApiError(400, 'Invalid id');
  const body = (req as any).validatedBody as {
    account_holder_name: string;
    bank_name: string;
    account_number?: string;
    ifsc_code?: string;
    branch_name?: string;
    upi_id?: string;
    is_default?: boolean;
  };
  const row = await bankAccountService.updateBankAccount(req.user!.id, id, {
    account_holder_name: body.account_holder_name,
    bank_name: body.bank_name,
    account_number: body.account_number ?? null,
    ifsc_code: body.ifsc_code ?? null,
    branch_name: body.branch_name ?? null,
    upi_id: body.upi_id ?? null,
    is_default: body.is_default
  });
  res.json({ success: true, bankAccount: row });
}

export async function bankAccountsDelete(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new ApiError(400, 'Invalid id');
  await bankAccountService.deleteBankAccount(req.user!.id, id);
  res.json({ success: true });
}
