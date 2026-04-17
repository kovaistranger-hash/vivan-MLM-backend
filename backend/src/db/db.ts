import mysql, { ResultSetHeader } from 'mysql2/promise';
import type { ConnectionOptions, PoolOptions } from 'mysql2';
import { DB_URL } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Pool from `DB_URL`. `namedPlaceholders` + `ssl` stay on the options object so `:name` params and hosted MySQL keep working
 * (string-only `createPool(url)` cannot set those flags in mysql2).
 */
export const pool = mysql.createPool({
  uri: DB_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  ssl: { rejectUnauthorized: false }
} as PoolOptions);

const DB_CONNECT_MAX_ATTEMPTS = Math.max(1, Number(process.env.DB_CONNECT_MAX_ATTEMPTS || 12));
const DB_CONNECT_BASE_DELAY_MS = Math.max(200, Number(process.env.DB_CONNECT_BASE_DELAY_MS || 1000));

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Ping pool with exponential backoff until MySQL accepts connections or attempts are exhausted. */
export async function waitForDatabaseConnection(): Promise<void> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= DB_CONNECT_MAX_ATTEMPTS; attempt++) {
    let conn: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
    try {
      conn = await pool.getConnection();
      await conn.ping();
      logger.info('MySQL connection ready', { attempt });
      return;
    } catch (e) {
      lastErr = e;
      logger.warn('MySQL connection failed, retrying', {
        attempt,
        maxAttempts: DB_CONNECT_MAX_ATTEMPTS,
        err: e instanceof Error ? e.message : String(e)
      });
    } finally {
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

const tempDbReset =
  process.env.DB_TEMP_RESET === '1' || String(process.env.DB_TEMP_RESET || '').toLowerCase() === 'true';

const referralHardReset =
  !tempDbReset &&
  (process.env.DB_REFERRAL_HARD_RESET === '1' ||
    String(process.env.DB_REFERRAL_HARD_RESET || '').toLowerCase() === 'true');

/**
 * **`DB_TEMP_RESET=1`**: drops `commission_transactions`, `binary_carry`, `referral_closure`, `referral_users`,
 * `orders`, `users`, then schema bootstrap (no FKs in bootstrap DDL — stabilizing).
 * Use **once** on a dev DB, then **unset** and run `database/schema.sql` + `npm run seed` so `users` matches the app.
 *
 * Schema bootstrap creates **`users`** first (`CREATE IF NOT EXISTS`), then orders → referral → binary → commission.
 *
 * **`DB_REFERRAL_HARD_RESET=1`** (without temp reset): drops **`referral_users` only**, then bootstrap.
 */
/** Single `mysql.createConnection` config for init (not the pool). Same URI + flags as the pool. */
function bootstrapConnectionOptions(): ConnectionOptions {
  const ssl = { rejectUnauthorized: false } as const;
  return {
    uri: DB_URL,
    namedPlaceholders: true,
    ssl
  } as ConnectionOptions;
}

/**
 * Init DDL on **one** connection (`createConnection`, not `pool`): `SET FOREIGN_KEY_CHECKS = 0` → optional
 * drops (`DB_TEMP_RESET`) → `ensureReferralSchemaExists(conn)` → `SET FOREIGN_KEY_CHECKS = 1`.
 */
async function createTables() {
  const initConn = await mysql.createConnection(bootstrapConnectionOptions());

  try {
    await initConn.query(`SET FOREIGN_KEY_CHECKS = 0`);

    if (tempDbReset) {
      logger.warn(
        'DB_TEMP_RESET: dropping commission_transactions, binary_carry, referral_closure, referral_users, orders, users'
      );
      await initConn.query(`DROP TABLE IF EXISTS commission_transactions`);
      await initConn.query(`DROP TABLE IF EXISTS binary_carry`);
      await initConn.query(`DROP TABLE IF EXISTS referral_closure`);
      await initConn.query(`DROP TABLE IF EXISTS referral_users`);
      await initConn.query(`DROP TABLE IF EXISTS orders`);
      await initConn.query(`DROP TABLE IF EXISTS users`);
    } else if (referralHardReset) {
      logger.warn('DB_REFERRAL_HARD_RESET: dropping referral_users only');
      await initConn.query(`DROP TABLE IF EXISTS referral_users`);
    }

    const { ensureReferralSchemaExists } = await import('../modules/mlm/schema.service.js');
    await ensureReferralSchemaExists(initConn);

    await initConn.query(`SET FOREIGN_KEY_CHECKS = 1`);

    logger.info('Tables created successfully');
  } catch (err) {
    logger.error('Table creation failed', { err: err instanceof Error ? err.message : String(err) });
    throw err;
  } finally {
    await initConn.end();
  }
}

/**
 * Wait until DB is reachable (retries), then ping, then ensure tables.
 * Call **`await initDB()`** before `app.listen()` (see `server.ts`).
 */
export async function initDB() {
  await waitForDatabaseConnection();

  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }

  logger.info('MySQL connected');

  await createTables();
}

export async function query<T = any>(
  sql: string,
  params: Record<string, unknown> | unknown[] = []
): Promise<T> {
  const [rows] = await pool.query(sql, params as any);
  return rows as T;
}

export async function execute(
  sql: string,
  params: Record<string, unknown> | unknown[] = []
): Promise<ResultSetHeader> {
  const [result] = await pool.execute(sql, params as any);
  return result as ResultSetHeader;
}
