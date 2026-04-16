import winston from 'winston';
import { env } from '../config/env.js';
const isProduction = env.isProduction;
const consoleFormat = isProduction
    ? winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json())
    : winston.format.combine(winston.format.colorize(), winston.format.timestamp({ format: 'HH:mm:ss' }), winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${String(timestamp)} ${level}: ${String(message)}${rest}`;
    }));
export const logger = winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    transports: [new winston.transports.Console({ format: consoleFormat })]
});
