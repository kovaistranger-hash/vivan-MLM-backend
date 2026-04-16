import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.id = randomUUID();
  logger.info('Request', { requestId: req.id, method: req.method, path: req.originalUrl });
  next();
}
