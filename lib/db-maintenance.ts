import { db } from '@/lib/db';
import { setting } from '@/lib/db-operational-policy';

export async function pruneOperationalRows(loginDays = setting(process.env.DB_LOGIN_RETENTION_DAYS, 0, 0, 3_650)) {
  const [counts] = await db.$queryRaw<{ sessions: number; counters: number; logs: number }[]>`
    WITH sessions AS (
      DELETE FROM "session" WHERE "id" IN (
        SELECT "id" FROM "session" WHERE "expiresAt" <= statement_timestamp()
        ORDER BY "expiresAt" LIMIT 100 FOR UPDATE SKIP LOCKED
      ) RETURNING 1
    ), counters AS (
      DELETE FROM "AbuseBucket" WHERE "key" IN (
        SELECT "key" FROM "AbuseBucket" WHERE "resetAt" <= statement_timestamp()
        ORDER BY "resetAt" LIMIT 100 FOR UPDATE SKIP LOCKED
      ) RETURNING 1
    ), logs AS (
      DELETE FROM "LoginAttempt" WHERE "id" IN (
        SELECT "id" FROM "LoginAttempt"
        WHERE ${loginDays} > 0 AND "createdAt" < statement_timestamp() - ${loginDays} * interval '1 day'
        ORDER BY "createdAt" LIMIT 100 FOR UPDATE SKIP LOCKED
      ) RETURNING 1
    )
    SELECT (SELECT count(*)::int FROM sessions) AS sessions,
           (SELECT count(*)::int FROM counters) AS counters,
           (SELECT count(*)::int FROM logs) AS logs
  `;
  return counts;
}

let nextMaintenance = 0;
const interval = setting(process.env.DB_MAINTENANCE_SECONDS, 3_600, 60, 86_400) * 1_000;

export async function maintainDuringTraffic() {
  const now = Date.now();
  if (now < nextMaintenance) return;
  nextMaintenance = now + interval;
  // Other instances may run concurrently. Each batch skips locked rows.
  await pruneOperationalRows().catch(() => undefined);
}
