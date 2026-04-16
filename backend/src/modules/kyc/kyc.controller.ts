import type { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { getKycStatusForUser, submitKycApplication } from './kyc.service.js';
import { kycSubmitBodySchema } from './kyc.schemas.js';

export async function kycStatusGet(req: Request, res: Response) {
  const userId = req.user!.id;
  const status = await getKycStatusForUser(userId);
  res.json({ success: true, kyc: status });
}

export async function kycSubmitPost(req: Request, res: Response) {
  const userId = req.user!.id;
  const body = kycSubmitBodySchema.parse({
    pan: req.body?.pan,
    aadhaar: req.body?.aadhaar,
    tier: req.body?.tier
  });
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const panFile = files?.panDocument?.[0];
  if (!panFile?.buffer) throw new ApiError(400, 'PAN document image required (multipart field: panDocument)');
  const selfieFile = files?.selfie?.[0];
  const r = await submitKycApplication(userId, {
    pan: body.pan,
    aadhaarDigits: body.aadhaar,
    tier: body.tier,
    panDocument: panFile.buffer,
    panMime: panFile.mimetype,
    selfie: selfieFile?.buffer,
    selfieMime: selfieFile?.mimetype
  });
  res.status(201).json({ success: true, message: 'KYC submitted', id: r.id });
}
