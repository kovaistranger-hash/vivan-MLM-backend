import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Verifies **legacy** access tokens (`typ: access`, `sub`, `env.jwtAccessSecret`) or
 * **new** JSON API tokens from `auth.service` / `JWT_SECRET` (`id`, `email`, `role`, optional `name`).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) return next(new ApiError(401, 'Authentication required'));

  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret) as jwt.JwtPayload & {
      sub?: number;
      email?: string;
      role?: string;
      typ?: string;
    };
    if (decoded.typ === 'access' && decoded.sub != null && decoded.email && decoded.role) {
      (req as any).user = {
        id: Number(decoded.sub),
        email: decoded.email,
        role: decoded.role
      };
      return next();
    }
  } catch {
    /* try JWT_SECRET */
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new ApiError(500, 'JWT_SECRET is not configured'));
    }
    const decoded = jwt.verify(token, secret) as {
      id: number;
      name?: string;
      email: string;
      role: string;
    };
    if (decoded.id != null && decoded.email) {
      (req as any).user = {
        id: decoded.id,
        name: decoded.name ?? '',
        email: decoded.email,
        role: decoded.role
      };
      return next();
    }
  } catch {
    return next(new ApiError(401, 'Invalid or expired access token'));
  }

  return next(new ApiError(401, 'Invalid or expired access token'));
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    const role = (req.user as { role: string }).role;
    if (!roles.includes(role)) return next(new ApiError(403, 'Access denied'));
    next();
  };
}
