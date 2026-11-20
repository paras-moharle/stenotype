import test from 'node:test';
import assert from 'node:assert/strict';

import { nextPublishedAt } from '../lib/admin/publish.ts';

/*
 * Regression: every edit of a published dictation reset `publishedAt`
 * to "now", so fixing a typo rewrote the publish date.
 */

const now = new Date('2026-11-20T10:00:00Z');
const original = new Date('2026-11-01T08:00:00Z');

test('publishing a draft stamps the current time', () => {
  assert.equal(nextPublishedAt(null, 'PUBLISHED', now), now);
});

test('editing a published dictation keeps its original publish date', () => {
  assert.equal(nextPublishedAt(original, 'PUBLISHED', now), original);
});

test('moving back to draft clears the publish date', () => {
  assert.equal(nextPublishedAt(original, 'DRAFT', now), null);
});

test('archiving keeps the publish date for history', () => {
  assert.equal(nextPublishedAt(original, 'ARCHIVED', now), original);
  assert.equal(nextPublishedAt(null, 'ARCHIVED', now), null);
});
