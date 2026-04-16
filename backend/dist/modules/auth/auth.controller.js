import { query } from '../../db/mysql.js';
import { getClientIp } from '../../utils/clientIp.js';
import { jsonSafeValue } from '../../utils/jsonSafe.js';
import { getReferralRow, toReferralProfileDto } from '../referral/referral.service.js';
import { loginUser, refreshSession, registerUser, revokeAllRefreshTokens, revokeRefreshToken } from './auth.service.js';
export async function register(req, res) {
    const result = await registerUser({ ...req.body, signupIp: getClientIp(req) });
    res.status(201).json({ success: true, ...result });
}
export async function login(req, res) {
    const result = await loginUser(req.body);
    res.json({ success: true, ...result });
}
export async function refresh(req, res) {
    const refreshToken = String(req.body?.refreshToken || '');
    const result = await refreshSession(refreshToken);
    res.json({ success: true, ...result });
}
export async function logout(req, res) {
    const refreshToken = String(req.body?.refreshToken || '');
    await revokeRefreshToken(refreshToken);
    res.json({ success: true });
}
export async function logoutAll(req, res) {
    await revokeAllRefreshTokens(req.user.id);
    res.json({ success: true });
}
export async function me(req, res) {
    const uid = req.user.id;
    const rows = await query(`SELECT u.id, u.name, u.email, u.phone, u.gst_number, u.accepted_terms, r.slug AS role
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = :id
     LIMIT 1`, { id: uid });
    const user = rows[0];
    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }
    let referralCode = '';
    try {
        const refRow = await getReferralRow(uid);
        const ref = toReferralProfileDto(refRow);
        const r = ref;
        for (const p of [r?.referral_code, r?.referralCode, r?.code]) {
            if (typeof p === 'string' && p.trim()) {
                referralCode = p.trim();
                break;
            }
        }
    }
    catch (e) {
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
