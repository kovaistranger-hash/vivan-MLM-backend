import { Request, Response } from 'express';
import { query } from '../../db/mysql.js';
import { getClientIp } from '../../utils/clientIp.js';
import { jsonSafeValue } from '../../utils/jsonSafe.js';
import { getReferralRow, toReferralProfileDto } from '../referral/referral.service.js';
import {
  loginUser,
  refreshSession,
  registerUser,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  saveExpoPushToken
} from './auth.service.js';

export async function register(req: Request, res: Response) {
  const result = await registerUser({ ...req.body, signupIp: getClientIp(req) });
  res.status(201).json({ success: true, ...result });
}

export async function login(req: Request, res: Response) {
  const result = await loginUser(req.body);
  res.json({ success: true, ...result });
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = String(req.body?.refreshToken || '');
  const result = await refreshSession(refreshToken);
  res.json({ success: true, ...result });
}

export async function logout(req: Request, res: Response) {
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

export async function me(req: Request, res: Response) {
  const uid = req.user!.id;
  const rows = await query<any[]>(
    `SELECT u.id, u.name, u.email, u.phone, u.gst_number, u.accepted_terms, u.\`rank\` AS rank, r.slug AS role
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = :id
     LIMIT 1`,
    { id: uid }
  );
  const user = rows[0];
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  let referralCode = '';
  try {
    const refRow = await getReferralRow(uid);
    const ref = toReferralProfileDto(refRow);
    const r = ref as { referral_code?: string; referralCode?: string; code?: string } | null;
    for (const p of [r?.referral_code, r?.referralCode, r?.code]) {
      if (typeof p === 'string' && p.trim()) {
        referralCode = p.trim();
        break;
      }
    }
  } catch (e) {
    console.error('[auth] me: referral profile', e);
  }

  res.json({
    success: true,
    user: jsonSafeValue({
      ...user,
      referralCode,
      referral_code: referralCode,
      code: referralCode || null
    })
  });
}
