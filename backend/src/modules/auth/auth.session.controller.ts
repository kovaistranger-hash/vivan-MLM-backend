import type { Request, Response } from 'express';
import { refreshSession, revokeRefreshToken, revokeAllRefreshTokens, saveExpoPushToken } from './auth.legacy.service.js';

export async function refresh(req: Request, res: Response) {
  const refreshToken = String(req.body?.refreshToken || '');
  const result = await refreshSession(refreshToken);
  res.json({ success: true, ...result });
}

/** Revokes a refresh token (body: { refreshToken }). */
export async function logoutWithRefresh(req: Request, res: Response) {
  const refreshToken = String(req.body?.refreshToken || '');
  await revokeRefreshToken(refreshToken);
  res.json({ success: true });
}

export async function logoutAll(req: Request, res: Response) {
  await revokeAllRefreshTokens(req.user!.id);
  res.json({ success: true });
}

export async function savePushToken(req: Request, res: Response) {
  const body = (req as any).validatedBody as { expoPushToken: string };
  await saveExpoPushToken(req.user!.id, body.expoPushToken);
  res.json({ success: true });
}
