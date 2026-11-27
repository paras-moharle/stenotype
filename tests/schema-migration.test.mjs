import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/*
 * These tests lock down the shape of the attempt table and the migration
 * that produced it. They run without a database, so a regression shows up
 * in CI before anyone deploys.
 */

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL(
    '../prisma/migrations/20261125184500_drop_legacy_attempt_columns/migration.sql',
    import.meta.url
  ),
  'utf8'
);

const attemptModel = (() => {
  const match = schema.match(/model TypingAttempt \{([\s\S]*?)\n\}/);
  assert.ok(match, 'TypingAttempt model is present in the schema');
  return match[1];
})();

test('TypingAttempt requires a dictation', () => {
  const field = attemptModel.match(/^\s*dictationId\s+(\S+)/m);
  assert.ok(field, 'dictationId field is present');
  assert.equal(field[1], 'String', 'dictationId is a non-optional String');
});

test('TypingAttempt no longer has the legacy character counters', () => {
  assert.doesNotMatch(attemptModel, /^\s*correctCharacters\b/m);
  assert.doesNotMatch(attemptModel, /^\s*incorrectCharacters\b/m);
});

test('deleting a dictation is restricted while attempts reference it', () => {
  assert.match(attemptModel, /onDelete:\s*Restrict/);
  assert.doesNotMatch(attemptModel, /onDelete:\s*(Cascade|SetNull)/);
});

test('the migration deletes orphan rows before enforcing NOT NULL', () => {
  const deleteAt = migration.indexOf('DELETE FROM "TypingAttempt"');
  const notNullAt = migration.indexOf('SET NOT NULL');

  assert.ok(deleteAt >= 0, 'migration deletes attempts without a dictation');
  assert.match(migration, /WHERE "dictationId" IS NULL/);
  assert.ok(notNullAt >= 0, 'migration sets dictationId NOT NULL');
  assert.ok(deleteAt < notNullAt, 'orphans are removed before the constraint');
});

test('the migration drops the legacy columns', () => {
  assert.match(migration, /DROP COLUMN "correctCharacters"/);
  assert.match(migration, /DROP COLUMN "incorrectCharacters"/);
});

test('the migration re-creates the dictation foreign key as RESTRICT', () => {
  assert.match(migration, /DROP CONSTRAINT "TypingAttempt_dictationId_fkey"/);
  assert.match(
    migration,
    /ADD CONSTRAINT "TypingAttempt_dictationId_fkey"[\s\S]*?ON DELETE RESTRICT/
  );
});

test('the migration only touches the attempt table', () => {
  const statements = migration
    .split('\n')
    .filter((line) => /^(ALTER TABLE|DELETE FROM)/.test(line.trim()));

  assert.ok(statements.length > 0, 'migration has statements');
  for (const statement of statements) {
    assert.match(statement, /"TypingAttempt"/, `unexpected table: ${statement}`);
  }
});


test('legacy null-relation rows are archived transactionally before deletion', () => {
  assert.match(migration, /BEGIN;[\s\S]*LOCK TABLE "TypingAttempt"[\s\S]*INSERT INTO "LegacyTypingAttemptArchive"[\s\S]*to_jsonb\(attempt\)[\s\S]*DELETE FROM "TypingAttempt"[\s\S]*COMMIT;/);
});
