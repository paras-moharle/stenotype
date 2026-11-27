import test from 'node:test';
import assert from 'node:assert/strict';
import { attemptSubmissionSchema } from '../lib/schemas.ts';
import { createDictationSchema } from '../lib/admin/schemas.ts';

test('submission requires a stable key and bounds client elapsed time', () => {
  const attempt = { passageId: 'dictation', typed: 'alpha beta', elapsedMs: 3000 };
  assert.equal(attemptSubmissionSchema.safeParse(attempt).success, false);
  const submissionKey = crypto.randomUUID();
  assert.equal(attemptSubmissionSchema.safeParse({ ...attempt, submissionKey }).success, true);
  assert.equal(attemptSubmissionSchema.safeParse({ ...attempt, submissionKey, elapsedMs: 2 ** 31 }).success, false);
});

test('publication rejects references above the supported character or token budget', () => {
  const dictation = { title: 'Practice', category: 'GENERAL', status: 'PUBLISHED' };
  for (const referenceTranscript of ['x'.repeat(5001), 'a '.repeat(2000)]) {
    assert.equal(createDictationSchema.safeParse({ ...dictation, referenceTranscript }).success, false);
  }
  assert.equal(createDictationSchema.safeParse({ ...dictation, referenceTranscript: 'alpha beta' }).success, true);
});

test('the additive migration enforces scoped retry keys without rewriting existing attempts', async () => {
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(new URL(
    '../prisma/migrations/20261126120000_attempt_submission_integrity/migration.sql',
    import.meta.url
  ), 'utf8');
  assert.match(migration, /CREATE UNIQUE INDEX[\s\S]+\("studentId", "submissionKey"\)/);
  assert.match(migration, /^BEGIN;[\s\S]+COMMIT;\s*$/);
  assert.doesNotMatch(migration, /\b(?:DELETE|DROP|TRUNCATE)\b/);
});
