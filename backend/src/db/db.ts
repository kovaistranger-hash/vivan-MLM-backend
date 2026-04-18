import "dotenv/config";
import mysql from "mysql2/promise";
import type { ResultSetHeader } from "mysql2/promise";
import { ensureApplicationSchemaExists } from "../modules/mlm/schema.service.js";
import { logger } from "../utils/logger.js";
import {
  setDatabaseConfig,
  setDatabaseConnected,
  setSchemaBootstrapped,
  setStartupPhase
} from "../utils/runtimeHealth.js";

type DatabaseConfig = {
  url: string;
  source: string;
  host: string | null;
  database: string | null;
};

function summarizeDatabaseUrl(value: string): Pick<DatabaseConfig, "host" | "database"> {
  try {
    const parsed = new URL(value);
    return {
      host: parsed.hostname || null,
      database: parsed.pathname.replace(/^\//, "") || null
    };
  } catch {
    return {
      host: null,
      database: null
    };
  }
}

function pickDatabaseConfig(): DatabaseConfig | null {
  const candidates: Array<{ source: string; value: string | undefined }> = [
    { source: "DATABASE_URL", value: process.env.DATABASE_URL },
    { source: "DB_URL", value: process.env.DB_URL },
    { source: "MYSQL_URL", value: process.env.MYSQL_URL },
    { source: "MYSQL_PRIVATE_URL", value: process.env.MYSQL_PRIVATE_URL },
    { source: "MYSQL_PUBLIC_URL", value: process.env.MYSQL_PUBLIC_URL }
  ];

  for (const { source, value: raw } of candidates) {
    const value = raw?.trim();
    if (value) {
      return {
        url: value,
        source,
        ...summarizeDatabaseUrl(value)
      };
    }
  }

  const host = (process.env.MYSQLHOST || process.env.DB_HOST || "").trim();
  const user = (process.env.MYSQLUSER || process.env.DB_USER || "").trim();
  const name = (process.env.MYSQLDATABASE || process.env.DB_NAME || "").trim();

  if (!host || !user || !name) {
    return null;
  }

  const password = process.env.MYSQLPASSWORD ?? process.env.DB_PASSWORD ?? '';
  const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);
  const url = new URL(`mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`);

  return {
    url: url.toString(),
    source: process.env.MYSQLHOST ? "MYSQLHOST/MYSQLUSER/MYSQLDATABASE" : "DB_HOST/DB_USER/DB_NAME",
    host,
    database: name
  };
}

const databaseConfig = (() => {
  const value = pickDatabaseConfig();
  if (!value) {
    throw new Error(
      'Missing database configuration. Set DATABASE_URL/DB_URL/MYSQL_URL/MYSQL_PRIVATE_URL or Railway MYSQLHOST/MYSQLUSER/MYSQLDATABASE or DB_HOST/DB_USER/DB_NAME.'
    );
  }
  return value;
})();

setDatabaseConfig({
  configured: true,
  source: databaseConfig.source,
  host: databaseConfig.host,
  database: databaseConfig.database
});

export const pool = mysql.createPool({
  uri: databaseConfig.url,
  ssl: {
    rejectUnauthorized: false,
  },
  namedPlaceholders: true,
});

export default pool;

const DB_CONNECT_MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.DB_CONNECT_MAX_ATTEMPTS || 12)
);

const DB_CONNECT_BASE_DELAY_MS = Math.max(
  200,
  Number(process.env.DB_CONNECT_BASE_DELAY_MS || 1000)
);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForDatabaseConnection(): Promise<void> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= DB_CONNECT_MAX_ATTEMPTS; attempt++) {
    let conn: Awaited<ReturnType<typeof pool.getConnection>> | undefined;

    try {
      conn = await pool.getConnection();
      await conn.ping();
      setDatabaseConnected(true, null);
      logger.info("MySQL connection ready", { attempt });
      return;
    } catch (e) {
      lastErr = e;
      setDatabaseConnected(false, e instanceof Error ? e.message : String(e));
      logger.warn("MySQL connection failed, retrying", {
        attempt,
        maxAttempts: DB_CONNECT_MAX_ATTEMPTS,
        err: e instanceof Error ? e.message : String(e),
      });
    } finally {
      conn?.release();
    }

    if (attempt < DB_CONNECT_MAX_ATTEMPTS) {
      const backoff = Math.min(
        30000,
        DB_CONNECT_BASE_DELAY_MS * 2 ** (attempt - 1)
      );
      await sleep(backoff);
    }
  }

  logger.error("MySQL connection exhausted retries", { err: lastErr });
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function createTables() {
  const initConn = await mysql.createConnection({
    uri: databaseConfig.url,
    ssl: { rejectUnauthorized: false },
    namedPlaceholders: true,
  });

  try {
    setStartupPhase('bootstrapping_schema');
    setSchemaBootstrapped(false, null);
    await initConn.query(`SET FOREIGN_KEY_CHECKS = 0`);
    await ensureApplicationSchemaExists(initConn);

    await initConn.query(`SET FOREIGN_KEY_CHECKS = 1`);
    setSchemaBootstrapped(true, null);
    logger.info("Tables created successfully");
  } catch (err) {
    setSchemaBootstrapped(false, err instanceof Error ? err.message : String(err));
    logger.error("Table creation failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await initConn.end();
  }
}

export async function initDB() {
  await waitForDatabaseConnection();

  const conn = await pool.getConnection();
  try {
    await conn.ping();
    setDatabaseConnected(true, null);
  } finally {
    conn.release();
  }

  logger.info("MySQL connected");
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

export function getDatabaseConfigSummary() {
  return {
    source: databaseConfig.source,
    host: databaseConfig.host,
    database: databaseConfig.database
  };
}
