import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.STENO_BRANCH_URL;
assert.ok(url);
assert.equal(new URL(url).hostname, process.env.STENO_BRANCH_HOST);
assert.ok(new URL(url).hostname.endsWith('.neon.tech'));
assert.ok(!new URL(url).hostname.includes('-pooler'));
assert.equal(process.env.STENO_DISPOSABLE_DB, 'YES');

const root = new URL('../../prisma/migrations/', import.meta.url);
const migrations = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const { rows } = await client.query(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at',
  );
  const after = process.argv.includes('--after');
  const active = rows.filter((row) => !row.rolled_back_at);
  assert.deepEqual(active.map((row) => row.migration_name), after ? migrations : migrations.slice(0, 3));
  for (const row of active) {
    assert.ok(row.finished_at, `Unfinished migration: ${row.migration_name}`);
    const sql = await readFile(new URL(`${row.migration_name}/migration.sql`, root));
    assert.equal(createHash('sha256').update(sql).digest('hex'), row.checksum, row.migration_name);
  }
  assert.ok(rows.every((row) => !row.rolled_back_at), 'Review prior failed/rolled-back entries before proceeding');
  console.log(`PASS: ${active.length} applied migration checksums match`);

  // Canonical fingerprints only. No raw rows or credentials are emitted.
  const attempts = after
    ? `SELECT to_jsonb(a)-ARRAY['referenceSnapshot','submissionKey','rawWpm','referenceDigest','scoreVersion'] AS row FROM "TypingAttempt" a`
    : `SELECT to_jsonb(a)-ARRAY['correctCharacters','incorrectCharacters'] AS row FROM "TypingAttempt" a WHERE "dictationId" IS NOT NULL`;
  const legacy = after
    ? 'SELECT "row" FROM "LegacyTypingAttemptArchive"'
    : 'SELECT to_jsonb(a) AS row FROM "TypingAttempt" a WHERE "dictationId" IS NULL';
  const sources = {
    users: 'SELECT to_jsonb(a) AS row FROM "user" a',
    credentials: 'SELECT to_jsonb(a) AS row FROM "account" a',
    profiles: 'SELECT to_jsonb(a) AS row FROM "StudentProfile" a',
    dictations: 'SELECT to_jsonb(a) AS row FROM "Dictation" a',
    loginHistory: 'SELECT to_jsonb(a) AS row FROM "LoginAttempt" a',
    sessions: 'SELECT to_jsonb(a) AS row FROM "session" a',
    validAttempts: attempts,
    legacyAttempts: legacy,
  };
  const fingerprints = {};
  for (const [name, source] of Object.entries(sources)) {
    const { rows: [row] } = await client.query(
      `SELECT count(*)::int AS count, encode(sha256(convert_to(COALESCE(string_agg("row"::text, E'\\n' ORDER BY "row"::text), ''), 'UTF8')), 'hex') AS digest FROM (${source}) AS records`,
    );
    fingerprints[name] = row;
  }
  console.log(JSON.stringify(fingerprints));
} finally {
  await client.end();
}
