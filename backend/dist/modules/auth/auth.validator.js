import { body } from 'express-validator';
export const registerValidator = [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().isLength({ min: 8, max: 20 }),
    body('password').isLength({ min: 6, max: 64 })
];
export const loginValidator = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6, max: 64 })
];
