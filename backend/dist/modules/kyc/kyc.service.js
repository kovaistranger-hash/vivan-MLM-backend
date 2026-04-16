import fs from 'fs';
import path from 'path';
import { execute, query } from '../../db/mysql.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ensureReferralSchemaExists } from '../mlm/schema.service.js';
import { initCloudinaryFromEnv, isCloudinaryConfigured, uploadImageBuffer } from '../upload/cloudinary.service.js';
function normalizePan(pan) {
    return String(pan || '')
        .trim()
        .toUpperCase()
        .replace(/\s/g, '');
}
function maskAadhaar(digits) {
    const d = String(digits || '').replace(/\D/g, '');
    if (d.length < 4)
        return '';
    return `XXXX${d.slice(-4)}`;
}
async function persistUpload(userId, label, buffer, mimetype) {
    if (!buffer?.length)
        throw new ApiError(400, `Missing file: ${label}`);
    if (!String(mimetype || '').startsWith('image/')) {
        throw new ApiError(400, `${label} must be an image`);
    }
    initCloudinaryFromEnv();
    if (isCloudinaryConfigured()) {
        const folder = `vivan/kyc/${userId}`;
        const r = await uploadImageBuffer(buffer, folder);
        return r.url;
    }
    const dir = path.join(env.uploadDir, 'kyc', String(userId));
    fs.mkdirSync(dir, { recursive: true });
    const ext = mimetype.includes('png') ? 'png' : 'jpg';
    const name = `${label}_${Date.now()}.${ext}`;
    const full = path.join(dir, name);
    fs.writeFileSync(full, buffer);
    return `/uploads/kyc/${userId}/${name}`;
}
export async function submitKycApplication(userId, input) {
    await ensureReferralSchemaExists();
    const pan = normalizePan(input.pan);
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        throw new ApiError(400, 'Invalid PAN format');
    }
    const aad12 = String(input.aadhaarDigits || '').replace(/\D/g, '');
    if (aad12.length !== 12) {
        throw new ApiError(400, 'Aadhaar must be 12 digits');
    }
    const tier = input.tier === 'L2' ? 'L2' : 'L1';
    if (tier === 'L2' && (!input.selfie || !input.selfie.length)) {
        throw new ApiError(400, 'Selfie image is required for L2 KYC');
    }
    const pending = await query(`SELECT COUNT(*) AS c FROM kyc_records WHERE user_id = :u AND status = 'pending'`, { u: userId });
    if (Number(pending[0]?.c || 0) > 0) {
        throw new ApiError(409, 'You already have a KYC application pending review');
    }
    const docUrl = await persistUpload(userId, 'pan', input.panDocument, input.panMime);
    let selfieUrl = null;
    if (input.selfie?.length && input.selfieMime) {
        selfieUrl = await persistUpload(userId, 'selfie', input.selfie, input.selfieMime);
    }
    const ins = await execute(`INSERT INTO kyc_records (user_id, tier, pan_number, aadhaar_number, document_url, selfie_url, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`, [userId, tier, pan, maskAadhaar(aad12), docUrl, selfieUrl]);
    return { id: Number(ins.insertId || 0) };
}
export async function getKycStatusForUser(userId) {
    await ensureReferralSchemaExists();
    const urows = await query('SELECT COALESCE(kyc_verified,0) AS kyc_verified, COALESCE(kyc_level,0) AS kyc_level FROM users WHERE id = :u LIMIT 1', { u: userId });
    const u = urows[0];
    const rec = await query(`SELECT id, tier, status, rejection_reason, verified_at, created_at
     FROM kyc_records WHERE user_id = :u ORDER BY id DESC LIMIT 1`, { u: userId });
    const latest = rec[0];
    return {
        userKycVerified: !!Number(u?.kyc_verified),
        userKycLevel: Number(u?.kyc_level ?? 0),
        latest: latest
            ? {
                id: latest.id,
                tier: latest.tier,
                status: latest.status,
                rejectionReason: latest.rejection_reason,
                verifiedAt: latest.verified_at,
                createdAt: latest.created_at
            }
            : null
    };
}
export async function hasVerifiedKyc(userId) {
    const s = await getKycStatusForUser(userId);
    if (s.userKycVerified)
        return true;
    return s.latest?.status === 'verified';
}
export async function assertWithdrawalKycEligible(userId, gross) {
    await ensureReferralSchemaExists();
    const srows = await query('SELECT COALESCE(kyc_required,0) AS kyc_required FROM withdrawal_settings WHERE id = 1 LIMIT 1');
    const kycRequired = Number(srows[0]?.kyc_required || 0) === 1;
    const urows = await query('SELECT COALESCE(kyc_verified,0) AS kyc_verified, COALESCE(kyc_level,0) AS kyc_level FROM users WHERE id = :u LIMIT 1', { u: userId });
    const verifiedFlag = Number(urows[0]?.kyc_verified || 0) === 1;
    const kycLevel = Number(urows[0]?.kyc_level || 0);
    const rec = await query(`SELECT status, tier FROM kyc_records WHERE user_id = :u ORDER BY id DESC LIMIT 1`, { u: userId });
    const latest = rec[0];
    const recordVerified = latest?.status === 'verified';
    const ok = verifiedFlag || recordVerified;
    if (kycRequired && !ok) {
        throw new ApiError(403, 'KYC verification is required before withdrawal. Submit documents under Referral → KYC.');
    }
    if (env.kycHighWithdrawalInr > 0 && gross >= env.kycHighWithdrawalInr && !ok) {
        throw new ApiError(403, `KYC verification is required for withdrawals of ₹${env.kycHighWithdrawalInr.toLocaleString('en-IN')} or more.`);
    }
    if (env.kycTier2WithdrawalInr > 0 && gross >= env.kycTier2WithdrawalInr) {
        const tier2Ok = kycLevel >= 2 || (latest?.status === 'verified' && latest.tier === 'L2');
        if (!tier2Ok) {
            throw new ApiError(403, `Full KYC (L2) is required for withdrawals of ₹${env.kycTier2WithdrawalInr.toLocaleString('en-IN')} or more.`);
        }
    }
}
export async function adminListPendingKyc(limit = 50) {
    await ensureReferralSchemaExists();
    const lim = Math.min(100, Math.max(1, Math.floor(limit)));
    return query(`SELECT k.*, u.email, u.name
     FROM kyc_records k
     INNER JOIN users u ON u.id = k.user_id
     WHERE k.status = 'pending'
     ORDER BY k.id ASC
     LIMIT :lim`, { lim });
}
export async function adminDecideKyc(input) {
    await ensureReferralSchemaExists();
    const rows = await query('SELECT user_id, tier, status FROM kyc_records WHERE id = :id LIMIT 1', { id: input.recordId });
    const r = rows[0];
    if (!r)
        throw new ApiError(404, 'KYC record not found');
    if (r.status !== 'pending')
        throw new ApiError(409, 'This application was already processed');
    const uid = Number(r.user_id);
    if (input.status === 'rejected') {
        await execute(`UPDATE kyc_records SET status = 'rejected', rejection_reason = ?, verified_at = NULL
       WHERE id = ?`, [input.rejectionReason?.trim() || 'Rejected', input.recordId]);
        await execute(`UPDATE users SET kyc_verified = 0, kyc_level = 0 WHERE id = ?`, [uid]);
        return;
    }
    const level = r.tier === 'L2' ? 2 : 1;
    await execute(`UPDATE kyc_records SET status = 'verified', rejection_reason = NULL, verified_at = NOW() WHERE id = ?`, [input.recordId]);
    await execute(`UPDATE users SET kyc_verified = 1, kyc_level = ? WHERE id = ?`, [level, uid]);
}
