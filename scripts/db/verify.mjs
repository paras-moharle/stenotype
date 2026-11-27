#!/usr/bin/env node
/*
 * Post-deploy database integrity check.
 *
 * Read-only. Prints counts only — never row contents or secrets.
 *
 *   node scripts/db/verify.mjs
 *   DATABASE_URL=... node scripts/db/verify.mjs
 *
 * Exit code 1 if any check fails, so it can gate a deploy.
 */

import { Pool } from 'pg';

import { loadEnvironment } from '../load-environment.mjs';

loadEnvironment();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const checks = [
  {
    name: 'no attempt without a dictation',
    sql: `SELECT count(*)::int AS n FROM "TypingAttempt" WHERE "dictationId" IS NULL`,
  },
  {
    name: 'every attempt points at an existing dictation',
    sql: `SELECT count(*)::int AS n FROM "TypingAttempt" a
          LEFT JOIN "Dictation" d ON d.id = a."dictationId"
          WHERE d.id IS NULL`,
  },
  {
    name: 'every attempt points at an existing student',
    sql: `SELECT count(*)::int AS n FROM "TypingAttempt" a
          LEFT JOIN "StudentProfile" s ON s.id = a."studentId"
          WHERE s.id IS NULL`,
  },
  {
    name: 'every student profile has a user',
    sql: `SELECT count(*)::int AS n FROM "StudentProfile" p
          LEFT JOIN "user" u ON u.id = p."userId"
          WHERE u.id IS NULL`,
  },
  {
    name: 'every login audit row with a user still resolves',
    sql: `SELECT count(*)::int AS n FROM "LoginAttempt" l
          LEFT JOIN "user" u ON u.id = l."userId"
          WHERE l."userId" IS NOT NULL AND u.id IS NULL`,
  },
  {
    name: 'every session points at a user',
    sql: `SELECT count(*)::int AS n FROM session s
          LEFT JOIN "user" u ON u.id = s."userId"
          WHERE u.id IS NULL`,
  },
  {
    name: 'every account points at a user',
    sql: `SELECT count(*)::int AS n FROM account a
          LEFT JOIN "user" u ON u.id = a."userId"
          WHERE u.id IS NULL`,
  },
  {
    name: 'no duplicate emails (case-insensitive)',
    sql: `SELECT count(*)::int AS n FROM (
            SELECT lower(email) FROM "user" GROUP BY 1 HAVING count(*) > 1
          ) dupes`,
  },
  {
    name: 'attempt accuracy is within 0–100',
    sql: `SELECT count(*)::int AS n FROM "TypingAttempt"
          WHERE accuracy < 0 OR accuracy > 100`,
  },
  {
    name: 'attempt completion is within 0–100',
    sql: `SELECT count(*)::int AS n FROM "TypingAttempt"
          WHERE completion < 0 OR completion > 100`,
  },
  {
    name: 'legacy character columns are gone',
    sql: `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'TypingAttempt'
            AND column_name IN ('correctCharacters', 'incorrectCharacters')`,
  },
  {
    name: 'dictationId is NOT NULL',
    sql: `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'TypingAttempt'
            AND column_name = 'dictationId' AND is_nullable = 'YES'`,
  },
  {
    name: 'dictation foreign key is ON DELETE RESTRICT',
    sql: `SELECT CASE WHEN EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = '"TypingAttempt"'::regclass
              AND conname = 'TypingAttempt_dictationId_fkey' AND confdeltype = 'r'
          ) THEN 0 ELSE 1 END AS n`,
  },
  {
    name: 'one session per user',
    sql: `SELECT count(*)::int AS n FROM (
            SELECT "userId" FROM "session" GROUP BY 1 HAVING count(*) > 1
          ) AS duplicates`,
  },
  {
    name: 'atomic session trigger exists and is enabled',
    sql: `SELECT CASE WHEN EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgrelid = '"session"'::regclass
            AND tgname = 'replace_user_session_before_insert' AND tgenabled = 'O'
          ) THEN 0 ELSE 1 END AS n`,
  },
  {
    name: 'submission keys are unique per student',
    sql: `SELECT count(*)::int AS n FROM (
            SELECT "studentId", "submissionKey" FROM "TypingAttempt"
            WHERE "submissionKey" IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1
          ) AS duplicates`,
  },
];

let failures = 0;

try {
  const { rows: meta } = await pool.query(`
    SELECT current_database() AS database,
           (SELECT count(*)::int FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations
  `);
  console.log(
    `Database: ${meta[0].database} · applied migrations: ${meta[0].migrations}`
  );
  console.log('');

  for (const check of checks) {
    const { rows } = await pool.query(check.sql);
    const count = rows[0]?.n ?? -1;
    const ok = count === 0;
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${check.name}${ok ? '' : ` (${count})`}`);
  }
} catch (error) {
  failures += 1;
  console.error('FAIL  database check could not run:', error.message);
} finally {
  await pool.end();
}

console.log('');
console.log(
  failures === 0
    ? 'All integrity checks passed.'
    : `${failures} integrity check(s) failed.`
);
process.exitCode = failures === 0 ? 0 : 1;
