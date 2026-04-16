import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
export function signAccessToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role, typ: 'access' }, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn });
}
export function generateRefreshToken() {
    return crypto.randomBytes(48).toString('base64url');
}
export function refreshExpiresAt() {
    const ms = parseDurationMs(env.jwtRefreshExpiresIn);
    return new Date(Date.now() + ms);
}
/** Minimal duration parser for env like 30d, 12h, 15m */
function parseDurationMs(input) {
    const m = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
    if (!m)
        return 30 * 24 * 60 * 60 * 1000;
    const n = Number(m[1]);
    const u = m[2];
    switch (u) {
        case 'ms':
            return n;
        case 's':
            return n * 1000;
        case 'm':
            return n * 60 * 1000;
        case 'h':
            return n * 60 * 60 * 1000;
        case 'd':
            return n * 24 * 60 * 60 * 1000;
        default:
            return 30 * 24 * 60 * 60 * 1000;
    }
}
