import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
const isDev = !env.isProduction;
/**
 * Global API rate limit (15 min window). Production: 100 req / IP / window.
 * Skips health checks, Razorpay webhook, and localhost in development.
 */
export const globalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 10_000 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (req.path === '/health')
            return true;
        if (req.originalUrl === '/api/payments/razorpay/webhook' || req.path.endsWith('/razorpay/webhook'))
            return true;
        if (isDev && (req.ip === '::1' || req.ip === '127.0.0.1'))
            return true;
        return false;
    }
});
/** @deprecated Use {@link globalApiLimiter}; kept for backwards-compatible imports. */
export const apiLimiter = globalApiLimiter;
