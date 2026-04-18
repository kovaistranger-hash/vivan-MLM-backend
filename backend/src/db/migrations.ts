import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { pool } from './mysql.js';

type MigrationKind = 'baseline' | 'migration';

export type MigrationPlanEntry = {
  version: string;
  kind: MigrationKind;
  filename: string;
  fullPath: string;
  checksum: string;
  dangerous: boolean;
  statements: string[];
};

export type MigrationPlan = {
  databaseDir: string;
  includeBaseline: boolean;
  appliedVersions: string[];
  pending: MigrationPlanEntry[];
};

export type ApplyMigrationOptions = {
  includeBaselineWhenEmpty?: boolean;
  allowDestructive?: boolean;
};

const SCHEMA_MIGRATIONS_TABLE = 'schema_migrations';
const DANGEROUS_SQL = /\b(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+TABLE|TRUNCATE)\b/i;

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1] ?? '';

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        current += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (char === '-' && next === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '#') {
        inLineComment = true;
        continue;
      }
      if (char === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (char === "'" && !inDouble && !inBacktick) {
      const escaped = sql[i - 1] === '\\';
      if (!escaped) inSingle = !inSingle;
      current += char;
      continue;
    }

    if (char === '"' && !inSingle && !inBacktick) {
      const escaped = sql[i - 1] === '\\';
      if (!escaped) inDouble = !inDouble;
      current += char;
      continue;
    }

    if (char === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
      current += char;
      continue;
    }

    if (char === ';' && !inSingle && !inDouble && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements.filter((statement) => !/^(USE|CREATE\s+DATABASE)\b/i.test(statement));
}

async function resolveDatabaseDir() {
  const candidates = [
    path.resolve(process.cwd(), 'database'),
    path.resolve(process.cwd(), '..', 'database')
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error('Could not locate the database directory from the current working directory.');
}

async function ensureSchemaMigrationsTable(conn: PoolConnection) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA_MIGRATIONS_TABLE} (
      version VARCHAR(255) NOT NULL PRIMARY KEY,
      kind ENUM('baseline', 'migration') NOT NULL,
      checksum CHAR(64) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedVersions(conn: PoolConnection) {
  await ensureSchemaMigrationsTable(conn);
  const [rows] = await conn.query(
    `SELECT version FROM ${SCHEMA_MIGRATIONS_TABLE} ORDER BY applied_at ASC, version ASC`
  );
  return (rows as Array<{ version: string }>).map((row) => row.version);
}

async function countNonMigrationTables(conn: PoolConnection) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME <> ?`,
    [SCHEMA_MIGRATIONS_TABLE]
  );
  return Number((rows as Array<{ total: number }>)[0]?.total || 0);
}

async function loadBaseline(databaseDir: string): Promise<MigrationPlanEntry | null> {
  const schemaPath = path.join(databaseDir, 'schema.sql');
  if (!(await pathExists(schemaPath))) {
    return null;
  }

  const raw = await fs.readFile(schemaPath, 'utf8');
  const statements = splitSqlStatements(raw);
  return {
    version: 'baseline:schema.sql',
    kind: 'baseline',
    filename: 'schema.sql',
    fullPath: schemaPath,
    checksum: crypto.createHash('sha256').update(raw).digest('hex'),
    dangerous: statements.some((statement) => DANGEROUS_SQL.test(statement)),
    statements
  };
}

async function loadMigrations(databaseDir: string): Promise<MigrationPlanEntry[]> {
  const migrationsDir = path.join(databaseDir, 'migrations');
  const files = await fs.readdir(migrationsDir, { withFileTypes: true });

  const sqlFiles = files
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith('.sql'))
    .filter((name) => !/^manual_/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const result: MigrationPlanEntry[] = [];

  for (const filename of sqlFiles) {
    const fullPath = path.join(migrationsDir, filename);
    const raw = await fs.readFile(fullPath, 'utf8');
    const statements = splitSqlStatements(raw);
    result.push({
      version: filename,
      kind: 'migration',
      filename,
      fullPath,
      checksum: crypto.createHash('sha256').update(raw).digest('hex'),
      dangerous: statements.some((statement) => DANGEROUS_SQL.test(statement)),
      statements
    });
  }

  return result;
}

export async function getMigrationPlan(options: { includeBaselineWhenEmpty?: boolean } = {}): Promise<MigrationPlan> {
  const databaseDir = await resolveDatabaseDir();
  const conn = await pool.getConnection();

  try {
    const appliedVersions = await getAppliedVersions(conn);
    const appliedSet = new Set(appliedVersions);
    const pending: MigrationPlanEntry[] = [];
    const tableCount = await countNonMigrationTables(conn);
    const includeBaseline = Boolean(options.includeBaselineWhenEmpty && tableCount === 0);

    if (includeBaseline) {
      const baseline = await loadBaseline(databaseDir);
      if (baseline && !appliedSet.has(baseline.version)) {
        pending.push(baseline);
      }
    }

    const migrations = await loadMigrations(databaseDir);
    for (const migration of migrations) {
      if (!appliedSet.has(migration.version)) {
        pending.push(migration);
      }
    }

    return {
      databaseDir,
      includeBaseline,
      appliedVersions,
      pending
    };
  } finally {
    conn.release();
  }
}

export async function applyPendingMigrations(options: ApplyMigrationOptions = {}) {
  const plan = await getMigrationPlan({
    includeBaselineWhenEmpty: options.includeBaselineWhenEmpty
  });

  const conn = await pool.getConnection();
  const appliedNow: string[] = [];

  try {
    await ensureSchemaMigrationsTable(conn);

    for (const entry of plan.pending) {
      if (entry.dangerous && !options.allowDestructive) {
        throw new Error(
          `Refusing to apply ${entry.filename} because it contains destructive SQL. Re-run with --allow-destructive if you really intend to do that.`
        );
      }

      await conn.beginTransaction();
      try {
        for (const statement of entry.statements) {
          await conn.query(statement);
        }

        await conn.query(
          `INSERT INTO ${SCHEMA_MIGRATIONS_TABLE} (version, kind, checksum, filename) VALUES (?, ?, ?, ?)`,
          [entry.version, entry.kind, entry.checksum, entry.filename]
        );

        await conn.commit();
        appliedNow.push(entry.version);
      } catch (error) {
        await conn.rollback();
        throw new Error(
          `Failed while applying ${entry.filename}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return {
      ...plan,
      appliedNow
    };
  } finally {
    conn.release();
  }
}

export async function markPendingMigrationsAsApplied(options: { includeBaselineWhenEmpty?: boolean } = {}) {
  const plan = await getMigrationPlan({
    includeBaselineWhenEmpty: options.includeBaselineWhenEmpty
  });

  const conn = await pool.getConnection();
  const adoptedNow: string[] = [];

  try {
    await ensureSchemaMigrationsTable(conn);

    for (const entry of plan.pending) {
      await conn.query(
        `INSERT INTO ${SCHEMA_MIGRATIONS_TABLE} (version, kind, checksum, filename) VALUES (?, ?, ?, ?)`,
        [entry.version, entry.kind, entry.checksum, entry.filename]
      );
      adoptedNow.push(entry.version);
    }

    return {
      ...plan,
      adoptedNow
    };
  } finally {
    conn.release();
  }
}
