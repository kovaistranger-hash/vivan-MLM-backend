/** Re-export so existing imports from `db/mysql.js` stay valid; implementation is in `db.ts`. */
export { pool, waitForDatabaseConnection, initDB, query, execute } from './db.js';
