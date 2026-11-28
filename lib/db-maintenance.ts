import { db } from '@/lib/db';
import { setting } from '@/lib/db-operational-policy';

const interval = setting(process.env.DB_MAINTENANCE_SECONDS, 86_400, 60, 86_400);
const studentDays = setting(process.env.DB_LOGIN_RETENTION_DAYS, 30, 0, 3_650);
const adminDays = setting(process.env.DB_ADMIN_LOGIN_RETENTION_DAYS, 90, 0, 3_650);
const maintenanceKey = 'stenotype:maintenance:v1';

export async function pruneOperationalRows(loginDays = studentDays, { force = false } = {}) {
  return db.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(19237141, 1) AS acquired
    `;
    if (!lock.acquired) return null;
    const [claim] = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "verification" AS gate ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
      VALUES (${maintenanceKey}, ${maintenanceKey}, '', '9999-01-01'::timestamptz, now(), now())
      ON CONFLICT ("id") DO UPDATE SET "updatedAt" = now()
      WHERE ${force} OR gate."updatedAt" <= now() - ${interval} * interval '1 second'
      RETURNING id
    `;
    if (!claim) return null;
    await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
    const [counts] = await tx.$queryRaw<{ sessions: number; counters: number; logs: number; verification: number }[]>`
      WITH sessions AS (
        DELETE FROM "session" WHERE "id" IN (
          SELECT "id" FROM "session" WHERE "expiresAt" <= now()
          ORDER BY "expiresAt" LIMIT 100 FOR UPDATE SKIP LOCKED
        ) RETURNING 1
      ), counters AS (
        DELETE FROM "AbuseBucket" WHERE "key" IN (
          SELECT "key" FROM "AbuseBucket" WHERE "resetAt" <= now()
          ORDER BY "resetAt" LIMIT 100 FOR UPDATE SKIP LOCKED
        ) RETURNING 1
      ), logs AS (
        DELETE FROM "LoginAttempt" WHERE "id" IN (
          SELECT l."id" FROM "LoginAttempt" l
          LEFT JOIN "user" u ON u.id = l."userId"
          WHERE l."createdAt" < now() - LEAST(
            CASE WHEN ${loginDays} = 0 THEN 3651 ELSE ${loginDays} END,
            CASE WHEN ${adminDays} = 0 THEN 3651 ELSE ${adminDays} END
          ) * interval '1 day'
            AND CASE WHEN u.role = 'admin'
              THEN ${adminDays} > 0 AND l."createdAt" < now() - ${adminDays} * interval '1 day'
              ELSE ${loginDays} > 0 AND l."createdAt" < now() - ${loginDays} * interval '1 day'
            END
          ORDER BY l."createdAt", l.id LIMIT 1000 FOR UPDATE OF l SKIP LOCKED
        ) RETURNING 1
      ), temporary AS (
        DELETE FROM "verification" WHERE "id" IN (
          SELECT "id" FROM "verification" WHERE "expiresAt" <= now()
            AND "identifier" NOT LIKE 'stenotype:%'
          ORDER BY "expiresAt" LIMIT 100 FOR UPDATE SKIP LOCKED
        ) RETURNING 1
      )
      SELECT (SELECT count(*)::int FROM sessions) AS sessions,
             (SELECT count(*)::int FROM counters) AS counters,
             (SELECT count(*)::int FROM logs) AS logs,
             (SELECT count(*)::int FROM temporary) AS verification
    `;
    return counts;
  }, { maxWait: 1000, timeout: 4000 });
}

let nextCheck = 0;

export async function maintainDuringTraffic() {
  const now = Date.now();
  if (now < nextCheck) return;
  nextCheck = now + interval * 1_000;
  await pruneOperationalRows().catch(() => {
    nextCheck = Date.now() + 60_000;
  });
}
