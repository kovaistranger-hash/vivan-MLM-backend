import bcrypt from 'bcryptjs';
import type { PoolConnection } from 'mysql2/promise';
import { env } from '../../config/env.js';
import { execute, pool, query } from '../../db/mysql.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateRefreshToken, hashToken, refreshExpiresAt, signAccessToken } from './auth.tokens.js';
import { grantWelcomeBonusIfNeeded } from '../mlm/commission.service.js';
import { findPlacement } from '../mlm/placement.service.js';
import {
  createReferralProfileForNewCustomer,
  getUserIdByReferralCode,
  type RegisterReferralInput
} from '../referral/referral.service.js';
import { writeAuditLog } from '../compliance/auditLog.service.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
import { createNotification } from '../notifications/notification.service.js';

interface UserRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  is_active: number;
  role_slug: string;
}

async function findUserByEmail(email: string) {
  const rows = await query<UserRow[]>(
    `SELECT u.*, r.slug AS role_slug
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.email = :email
     LIMIT 1`,
    { email }
  );
  return rows[0] || null;
}

async function getRoleId(slug: string) {
  const rows = await query<{ id: number }[]>('SELECT id FROM roles WHERE slug = :slug LIMIT 1', { slug });
  return rows[0]?.id;
}

export async function registerUser(
  input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    acceptedTerms: boolean;
    signupIp?: string | null;
  } & RegisterReferralInput
) {
  const existing = await findUserByEmail(input.email);
  if (existing) throw new ApiError(409, 'Email already registered');

  const customerRoleId = await getRoleId('customer');
  if (!customerRoleId) throw new ApiError(500, 'Roles not seeded');

  await ensureReferralSchemaExists();

  const passwordHash = await bcrypt.hash(input.password, 10);

  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const acceptedTerms = input.acceptedTerms === true ? 1 : 0;
    const [ins]: any = await c.query(
      `INSERT INTO users (role_id, email, password_hash, name, phone, signup_ip, is_active, accepted_terms)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [customerRoleId, input.email, passwordHash, input.name, input.phone || null, input.signupIp || null, acceptedTerms]
    );
    const userId = Number(ins.insertId);

    const referralInput: RegisterReferralInput = {
      sponsorReferralCode: input.sponsorReferralCode,
      placementParentReferralCode: input.placementParentReferralCode,
      placementSide: input.placementSide
    };

    const sponsorCode = input.sponsorReferralCode?.trim();
    const explicitPlacementParent = input.placementParentReferralCode?.trim();
    if (sponsorCode && !explicitPlacementParent) {
      const sponsorId = await getUserIdByReferralCode(sponsorCode);
      if (sponsorId) {
        const placement = await findPlacement(c, sponsorId);
        const parent_id = placement.parent_id;
        const position = placement.position;
        referralInput.autoPlacement = { parent_id, position };
      }
    }

    await createReferralProfileForNewCustomer(c, userId, referralInput);
    await grantWelcomeBonusIfNeeded(c, userId);

    const user = { id: userId, name: input.name, email: input.email, role: 'customer' as const };
    const tokens = await issueAuthTokens(user, c);
    await c.commit();
    const sponsorRows = await query<{ sponsor_user_id: number | null }[]>(
      `SELECT sponsor_user_id FROM referral_users WHERE user_id = :userId LIMIT 1`,
      { userId }
    );
    const sponsorId = sponsorRows[0]?.sponsor_user_id;
    if (sponsorId != null && Number(sponsorId) > 0) {
      void createNotification(
        undefined,
        Number(sponsorId),
        `${input.name} joined your team (new referral signup).`
      ).catch(() => undefined);
    }
    void writeAuditLog(`user_register:${userId}`, userId).catch(() => undefined);
    void import('../admin/fraud.service.js')
      .then(({ evaluateFraudRiskForUser }) => evaluateFraudRiskForUser(userId))
      .catch(() => {});
    return tokens;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function loginUserLegacy(input: { email: string; password: string }) {
  const row = await findUserByEmail(input.email);
  if (!row || !row.is_active) throw new ApiError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(input.password, row.password_hash);
  if (!valid) throw new ApiError(401, 'Invalid credentials');

  const user = { id: row.id, name: row.name, email: row.email, role: row.role_slug };
  return issueAuthTokens(user);
}

export async function refreshSession(refreshToken: string) {
  if (!refreshToken) throw new ApiError(400, 'Refresh token required');
  const tokenHash = hashToken(refreshToken);
  const rows = await query<{ user_id: number; expires_at: Date }[]>(
    `SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = :tokenHash LIMIT 1`,
    { tokenHash }
  );
  const row = rows[0];
  if (!row) throw new ApiError(401, 'Invalid refresh token');
  if (new Date(row.expires_at) < new Date()) {
    await execute('DELETE FROM refresh_tokens WHERE token_hash = :tokenHash', { tokenHash });
    throw new ApiError(401, 'Refresh token expired');
  }

  const users = await query<UserRow[]>(
    `SELECT u.*, r.slug AS role_slug
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = :id
     LIMIT 1`,
    { id: row.user_id }
  );
  const u = users[0];
  if (!u || !u.is_active) throw new ApiError(401, 'User inactive');

  return {
    accessToken: signAccessToken({ id: u.id, email: u.email, role: u.role_slug }),
    user: { id: u.id, name: u.name, email: u.email, role: u.role_slug }
  };
}

export async function revokeRefreshToken(refreshToken: string) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await execute('DELETE FROM refresh_tokens WHERE token_hash = :tokenHash', { tokenHash });
}

export async function revokeAllRefreshTokens(userId: number) {
  await execute('DELETE FROM refresh_tokens WHERE user_id = :userId', { userId });
}

export async function saveExpoPushToken(userId: number, expoPushToken: string) {
  const t = String(expoPushToken || '').trim();
  if (t.length < 20 || t.length > 512) throw new ApiError(400, 'Invalid push token');
  await ensureReferralSchemaExists();
  await execute(`UPDATE users SET expo_token = ? WHERE id = ?`, [t, userId]);
}

async function issueAuthTokens(user: { id: number; name: string; email: string; role: string }, conn?: PoolConnection) {
  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = refreshExpiresAt();

  if (conn) {
    await conn.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`, [
      user.id,
      tokenHash,
      expiresAt
    ]);
  } else {
    await execute(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (:userId, :tokenHash, :expiresAt)`,
      { userId: user.id, tokenHash, expiresAt }
    );
  }

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
    expiresIn: env.jwtAccessExpiresIn
  };
}
