import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export function validateRequest(req: Request, _res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(422, 'Validation failed', errors.array()));
  }
  next();
}
