import test from 'node:test';
import assert from 'node:assert/strict';

import {
  banUserSchema,
  createDictationSchema,
  createStudentSchema,
  updateDictationSchema,
  updateStudentSchema,
} from '../lib/admin/schemas.ts';

/*
 * The admin form and the API share these schemas. The bug this locks
 * down: the form sends `youtubeId: null` for a blank field while the API
 * only accepted a string, so creating a dictation without a video
 * returned 400.
 */

const dictation = {
  title: 'Court Proceedings',
  category: 'LEGAL',
  referenceTranscript: 'The court shall proceed.',
};

test('a dictation without a YouTube id is valid', () => {
  for (const youtubeId of [null, '', '   ']) {
    const parsed = createDictationSchema.safeParse({ ...dictation, youtubeId });
    assert.equal(parsed.success, true, `youtubeId=${JSON.stringify(youtubeId)}`);
    assert.equal(parsed.data.youtubeId, null);
  }
});

test('a dictation without the youtubeId key is valid', () => {
  const parsed = createDictationSchema.safeParse(dictation);
  assert.equal(parsed.success, true);
  // Absent stays undefined so an update can tell "not provided" apart
  // from "explicitly no video"; the create route maps it to null.
  assert.equal(parsed.data.youtubeId, undefined);
});

test('a real YouTube id is kept', () => {
  const parsed = createDictationSchema.safeParse({
    ...dictation,
    youtubeId: 'dQw4w9WgXcQ',
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.youtubeId, 'dQw4w9WgXcQ');
});

test('invalid dictation input is rejected', () => {
  assert.equal(
    createDictationSchema.safeParse({ ...dictation, title: '  ' }).success,
    false
  );
  assert.equal(
    createDictationSchema.safeParse({
      ...dictation,
      category: 'SPORT',
    }).success,
    false
  );
  assert.equal(
    createDictationSchema.safeParse({
      ...dictation,
      referenceTranscript: '',
    }).success,
    false
  );
  assert.equal(
    createDictationSchema.safeParse({
      ...dictation,
      youtubeId: 'x'.repeat(21),
    }).success,
    false
  );
});

test('an update may change one field', () => {
  const parsed = updateDictationSchema.safeParse({ title: 'New title' });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.title, 'New title');
  assert.equal(parsed.data.youtubeId, undefined);
  assert.equal(parsed.data.status, undefined);
});

test('an empty update is rejected', () => {
  assert.equal(updateDictationSchema.safeParse({}).success, false);
});

test('an update can archive a dictation', () => {
  const parsed = updateDictationSchema.safeParse({ status: 'ARCHIVED' });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.status, 'ARCHIVED');
});

test('an update rejects an unknown status', () => {
  assert.equal(
    updateDictationSchema.safeParse({ status: 'DELETED' }).success,
    false
  );
});

test('student creation validates email and password', () => {
  const ok = createStudentSchema.safeParse({
    name: 'Asha',
    email: 'asha@example.com',
    password: 'password123',
  });
  assert.equal(ok.success, true);

  assert.equal(
    createStudentSchema.safeParse({
      name: 'Asha',
      email: 'not-an-email',
      password: 'password123',
    }).success,
    false
  );
  assert.equal(
    createStudentSchema.safeParse({
      name: 'Asha',
      email: 'asha@example.com',
      password: 'short',
    }).success,
    false
  );
});

test('student update accepts status values from the database enum', () => {
  for (const status of ['ACTIVE', 'INACTIVE', 'SUSPENDED']) {
    assert.equal(updateStudentSchema.safeParse({ status }).success, true);
  }
  assert.equal(updateStudentSchema.safeParse({ status: 'Active' }).success, false);
  assert.equal(updateStudentSchema.safeParse({}).success, false);
});

test('ban payload requires a boolean', () => {
  assert.equal(banUserSchema.safeParse({ banned: true }).success, true);
  assert.equal(
    banUserSchema.safeParse({ banned: false, reason: 'spam' }).success,
    true
  );
  assert.equal(banUserSchema.safeParse({ banned: 'yes' }).success, false);
  assert.equal(banUserSchema.safeParse({}).success, false);
});
