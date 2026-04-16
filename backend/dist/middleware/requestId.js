import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';
export function requestIdMiddleware(req, _res, next) {
    req.id = randomUUID();
    logger.info('Request', { requestId: req.id, method: req.method, path: req.originalUrl });
    next();
}
