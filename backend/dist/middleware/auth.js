import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
export function requireAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token)
        return next(new ApiError(401, 'Authentication required'));
    try {
        const decoded = jwt.verify(token, env.jwtAccessSecret);
        if (decoded.typ !== 'access' || !decoded.sub || !decoded.email || !decoded.role) {
            return next(new ApiError(401, 'Invalid access token'));
        }
        req.user = { id: Number(decoded.sub), email: decoded.email, role: decoded.role };
        next();
    }
    catch {
        next(new ApiError(401, 'Invalid or expired access token'));
    }
}
export function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user)
            return next(new ApiError(401, 'Authentication required'));
        if (!roles.includes(req.user.role))
            return next(new ApiError(403, 'Access denied'));
        next();
    };
}
