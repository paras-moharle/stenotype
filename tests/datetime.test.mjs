import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatISTDate,
  formatISTDateTime,
} from '../lib/datetime.ts';

/*
 * Every timestamp the app shows is rendered in Asia/Kolkata, whatever
 * the viewer's device timezone. These tests pin that down with fixed
 * UTC instants.
 */

test('an instant is rendered as the IST calendar date', () => {
  // 04:00 UTC = 09:30 IST on the same day.
  assert.equal(formatISTDate(new Date('2026-11-20T04:00:00Z')), '20 Nov 2026');
});

test('a late-UTC instant rolls over to the next IST day', () => {
  // 20:00 UTC on 1 Jan = 01:30 IST on 2 Jan.
  assert.equal(formatISTDate(new Date('2026-01-01T20:00:00Z')), '2 Jan 2026');
});

test('date-time output carries the IST clock time', () => {
  const text = formatISTDateTime(new Date('2026-11-20T04:00:00Z'));
  assert.match(text, /20 Nov 2026/);
  assert.match(text, /(09|9):30/);
});

test('string timestamps are accepted', () => {
  assert.equal(formatISTDate('2026-11-20T04:00:00Z'), '20 Nov 2026');
});
