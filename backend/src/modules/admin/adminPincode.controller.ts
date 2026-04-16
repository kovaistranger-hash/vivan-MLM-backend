import { Request, Response } from 'express';
import { adminCreatePincode, adminDeletePincode, adminListPincodes, adminUpdatePincode } from './adminPincode.service.js';

export async function adminPincodesList(_req: Request, res: Response) {
  const rows = await adminListPincodes();
  res.json({ success: true, pincodes: rows });
}

export async function adminPincodeCreate(req: Request, res: Response) {
  const id = await adminCreatePincode(req.body);
  res.status(201).json({ success: true, id });
}

export async function adminPincodeUpdate(req: Request, res: Response) {
  await adminUpdatePincode(Number(req.params.id), req.body);
  res.json({ success: true });
}

export async function adminPincodeDelete(req: Request, res: Response) {
  await adminDeletePincode(Number(req.params.id));
  res.json({ success: true });
}
