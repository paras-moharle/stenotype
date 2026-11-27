import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRecordingDuration } from '../lib/admin/recording.ts';
import { updateDictationSchema } from '../lib/admin/schemas.ts';

test('changing, adding or removing a video cannot retain its previous recording duration', () => {
  const first = 'dQw4w9WgXcQ';
  const next = 'abcdefghijk';
  assert.equal(nextRecordingDuration(first, next, undefined), null);
  assert.equal(nextRecordingDuration(null, next, undefined), null);
  assert.equal(nextRecordingDuration(first, null, undefined), null);
  assert.equal(nextRecordingDuration(first, first, undefined), undefined);
  assert.equal(nextRecordingDuration(first, undefined, undefined), undefined);
  assert.equal(nextRecordingDuration(first, next, 198), 198);
  assert.equal(nextRecordingDuration(first, null, 198), null);
});

test('editor concurrency tokens must be valid and cannot count as a mutation', () => {
  const expectedUpdatedAt = '2026-11-27T00:00:00.000Z';
  assert.equal(updateDictationSchema.safeParse({ expectedUpdatedAt }).success, false);
  assert.equal(updateDictationSchema.safeParse({ title: 'Updated', expectedUpdatedAt: 'invalid' }).success, false);
  assert.equal(updateDictationSchema.safeParse({ status: 'ARCHIVED', expectedUpdatedAt }).success, true);
});
