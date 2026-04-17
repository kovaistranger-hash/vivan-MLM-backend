import mysql from 'mysql2/promise';
import type { ConnectionOptions } from 'mysql2';
import { DB_URL } from './env.js';

/**
 * Single MySQL connection from `DB_URL` (Railway-style).
 * `namedPlaceholders` + `ssl` are set here because mysql2’s `createConnection(url: string)` overload
 * cannot attach them (this app uses `:name` query params and hosted TLS).
 *
 * Import this module only when you need a dedicated connection (e.g. one-off scripts). The HTTP app
 * uses the pool in `src/db/db.ts` instead.
 */
export const db = await mysql.createConnection({
  uri: DB_URL,
  namedPlaceholders: true,
  ssl: { rejectUnauthorized: false }
} as ConnectionOptions);
