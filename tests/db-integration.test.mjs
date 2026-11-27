import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url = process.env.STENO_INTEGRATION_DATABASE_URL;
const enabled = Boolean(url) && process.env.STENO_DISPOSABLE_DB === 'YES';

test('database atomically replaces sessions, rolls back failed inserts and enforces shared quota', {
  skip: enabled ? false : 'requires a migrated isolated database and STENO_DISPOSABLE_DB=YES',
}, async () => {
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  const user = randomUUID();
  const key = `verification:${user}`;
  const insertSession = (id, expiry) => pool.query(
    'INSERT INTO "session" ("id", "userId", "token", "updatedAt", "expiresAt") VALUES ($1,$2,$1,now(),$3)',
    [id, user, expiry],
  );
  const sessions = async () => (await pool.query('SELECT "id" FROM "session" WHERE "userId" = $1', [user])).rows;
  try {
    assert.equal((await pool.query(
      'SELECT count(*)::int AS count FROM pg_trigger WHERE tgname = $1 AND tgenabled = $2',
      ['replace_user_session_before_insert', 'O'],
    )).rows[0].count, 1);
    await pool.query('INSERT INTO "user" ("id","name","email","updatedAt") VALUES ($1,$2,$3,now())',
      [user, 'Disposable integration test', `${user}@example.test`]);
    const expiry = new Date(Date.now() + 60_000);
    await insertSession('first-' + user, expiry);
    await assert.rejects(insertSession('invalid-' + user, null), { code: '23502' });
    assert.deepEqual(await sessions(), [{ id: 'first-' + user }]);
    await Promise.all([1, 2, 3].map((n) => insertSession(`parallel-${n}-${user}`, expiry)));
    const surviving = await sessions();
    assert.equal(surviving.length, 1);
    await pool.query('UPDATE "user" SET "banned" = true WHERE "id" = $1', [user]);
    await assert.rejects(insertSession('banned-' + user, expiry), /Session creation denied/);
    assert.deepEqual(await sessions(), surviving);

    // Distinct pooled clients compete for the same shared quota row.
    const oldUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    try {
      const { takeSharedQuota } = await import('../lib/shared-rate-limit.ts');
      const allowed = await Promise.all(Array.from({ length: 8 }, () => takeSharedQuota(key, 3, 60_000)));
      assert.equal(allowed.filter(Boolean).length, 3);
      await pool.query(`UPDATE "AbuseBucket" SET "resetAt" = now() - interval '1 day' WHERE "key" = $1`, [key]);
      await pool.query(`UPDATE "session" SET "expiresAt" = now() - interval '1 day' WHERE "userId" = $1`, [user]);
      const { pruneOperationalRows } = await import('../lib/db-maintenance.ts');
      const pruned = await pruneOperationalRows(0);
      assert.equal(pruned.logs, 0);
      assert.equal((await pool.query('SELECT 1 FROM "AbuseBucket" WHERE "key" = $1', [key])).rowCount, 0);
      assert.deepEqual(await sessions(), []);
    } finally {
      if (oldUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = oldUrl;
    }
  } finally {
    await pool.query('DELETE FROM "AbuseBucket" WHERE "key" = $1', [key]);
    await pool.query('DELETE FROM "user" WHERE "id" = $1', [user]);
    await pool.end();
  }
});

test('legacy fixture is archived and valid history survives', {
  skip: enabled && process.env.STENO_EXPECT_LEGACY_FIXTURE === 'YES' ? false : 'requires the disposable pre-migration legacy fixture',
}, async () => {
  const pool = new pg.Pool({ connectionString: url });
  try {
    const archive = await pool.query(
      'SELECT "row" FROM "LegacyTypingAttemptArchive" WHERE "id" = $1', ['legacy-fixture-null-attempt'],
    );
    assert.equal(archive.rows.length, 1);
    assert.equal(archive.rows[0].row.dictationId, null);
    assert.equal(archive.rows[0].row.correctCharacters, 7);
    const history = await pool.query(
      'SELECT "id", "wpm", "accuracy" FROM "TypingAttempt" WHERE "studentId" = $1', ['legacy-fixture-student'],
    );
    assert.deepEqual(history.rows, [{ id: 'legacy-fixture-valid-attempt', wpm: 3, accuracy: 100 }]);
  } finally {
    await pool.end();
  }
});
