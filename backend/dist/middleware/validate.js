import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';
export function validateRequest(req, _res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new ApiError(422, 'Validation failed', errors.array()));
    }
    next();
}
