import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const message = formatZod(parsed.error);
      return next(new ApiError(422, message, parsed.error.flatten()));
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const message = formatZod(parsed.error);
      return next(new ApiError(422, message, parsed.error.flatten()));
    }
    (req as any).validatedQuery = parsed.data;
    next();
  };
}

function formatZod(err: ZodError) {
  return err.errors.map((e) => `${e.path.join('.') || 'request'}: ${e.message}`).join('; ');
}
