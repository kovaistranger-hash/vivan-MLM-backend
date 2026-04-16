import { ApiError } from '../utils/ApiError.js';
export function validateBody(schema) {
    return (req, _res, next) => {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            const message = formatZod(parsed.error);
            return next(new ApiError(422, message, parsed.error.flatten()));
        }
        req.body = parsed.data;
        next();
    };
}
export function validateQuery(schema) {
    return (req, _res, next) => {
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            const message = formatZod(parsed.error);
            return next(new ApiError(422, message, parsed.error.flatten()));
        }
        req.validatedQuery = parsed.data;
        next();
    };
}
function formatZod(err) {
    return err.errors.map((e) => `${e.path.join('.') || 'request'}: ${e.message}`).join('; ');
}
