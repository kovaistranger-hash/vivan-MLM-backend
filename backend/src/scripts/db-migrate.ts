import 'dotenv/config';
import { pool } from '../db/mysql.js';
import { applyPendingMigrations, getMigrationPlan, markPendingMigrationsAsApplied } from '../db/migrations.js';

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const planOnly = hasFlag('--plan');
  const adoptOnly = hasFlag('--adopt');
  const includeBaselineWhenEmpty = hasFlag('--include-baseline');
  const allowDestructive = hasFlag('--allow-destructive');

  if (planOnly) {
    const plan = await getMigrationPlan({ includeBaselineWhenEmpty });
    console.log(`Database directory: ${plan.databaseDir}`);
    console.log(`Applied migrations: ${plan.appliedVersions.length}`);
    console.log(`Baseline included for empty DB: ${plan.includeBaseline ? 'yes' : 'no'}`);

    if (!plan.pending.length) {
      console.log('No pending migrations.');
      return;
    }

    console.log('Pending migrations:');
    for (const entry of plan.pending) {
      console.log(
        `- ${entry.version} [${entry.kind}]${entry.dangerous ? ' [destructive-blocked]' : ''} (${entry.statements.length} statements)`
      );
    }
    return;
  }

  if (adoptOnly) {
    const result = await markPendingMigrationsAsApplied({
      includeBaselineWhenEmpty
    });

    if (!result.adoptedNow.length) {
      console.log('No pending migrations to adopt.');
      return;
    }

    console.log('Adopted migrations into schema_migrations without executing SQL:');
    for (const version of result.adoptedNow) {
      console.log(`- ${version}`);
    }
    return;
  }

  const result = await applyPendingMigrations({
    includeBaselineWhenEmpty,
    allowDestructive
  });

  if (!result.appliedNow.length) {
    console.log('No pending migrations to apply.');
    return;
  }

  console.log('Applied migrations:');
  for (const version of result.appliedNow) {
    console.log(`- ${version}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
