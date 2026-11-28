import { loadEnvironment } from '../load-environment.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--apply' || !process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL explicitly to the approved target and run pnpm db:maintain --apply.');
  process.exit(1);
}
loadEnvironment();
const { db } = await import('../../lib/db.ts');
try {
  const { pruneOperationalRows } = await import('../../lib/db-maintenance.ts');
  const result = await pruneOperationalRows(undefined, { force: true });
  console.log(result ?? 'Another maintenance run holds the lock.');
} catch {
  console.error('Maintenance failed. Verify connectivity and schema before retrying.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
