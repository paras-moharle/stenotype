import { maintainDuringTraffic } from '@/lib/db-maintenance';
import { db } from '@/lib/db';

export async function takeSharedQuota(key: string, limit: number, windowMs: number) {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "AbuseBucket" AS bucket ("key", "count", "resetAt")
    VALUES (${key}, 1, statement_timestamp() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN bucket."resetAt" <= statement_timestamp()
                     THEN 1 ELSE bucket."count" + 1 END,
      "resetAt" = CASE WHEN bucket."resetAt" <= statement_timestamp()
                      THEN EXCLUDED."resetAt" ELSE bucket."resetAt" END
    WHERE bucket."resetAt" <= statement_timestamp() OR bucket."count" < ${limit}
    RETURNING "count"
  `;

  if (Math.random() < 0.01) await maintainDuringTraffic();
  return rows.length > 0;
}
