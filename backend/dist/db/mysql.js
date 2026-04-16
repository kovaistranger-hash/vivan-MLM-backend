import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
export const pool = mysql.createPool({
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true
});
const DB_CONNECT_MAX_ATTEMPTS = Math.max(1, Number(process.env.DB_CONNECT_MAX_ATTEMPTS || 12));
const DB_CONNECT_BASE_DELAY_MS = Math.max(200, Number(process.env.DB_CONNECT_BASE_DELAY_MS || 1000));
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
/** Ping pool with exponential backoff until MySQL accepts connections or attempts are exhausted. */
export async function waitForDatabaseConnection() {
    let lastErr;
    for (let attempt = 1; attempt <= DB_CONNECT_MAX_ATTEMPTS; attempt++) {
        let conn;
        try {
            conn = await pool.getConnection();
            await conn.ping();
            logger.info('MySQL connection ready', { attempt });
            return;
        }
        catch (e) {
            lastErr = e;
            logger.warn('MySQL connection failed, will retry', {
                attempt,
                maxAttempts: DB_CONNECT_MAX_ATTEMPTS,
                err: e instanceof Error ? e.message : String(e)
            });
        }
        finally {
            conn?.release();
        }
        if (attempt < DB_CONNECT_MAX_ATTEMPTS) {
            const backoff = Math.min(30_000, DB_CONNECT_BASE_DELAY_MS * 2 ** (attempt - 1));
            await sleep(backoff);
        }
    }
    logger.error('MySQL connection exhausted retries', { err: lastErr });
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
export async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}
export async function execute(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result;
}
