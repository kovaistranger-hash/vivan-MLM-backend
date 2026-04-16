import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.id ?? 'unknown';

  if (err instanceof ApiError) {
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message, details: err.details, requestId });
  }

  logger.error('Unhandled error', {
    requestId,
    err: err instanceof Error ? { message: err.message, stack: err.stack } : err
  });

  const exposeMessage = !env.isProduction && err instanceof Error;
  return res.status(500).json({
    success: false,
    message: exposeMessage ? err.message : 'Internal error',
    requestId
  });
}
