import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTEMPT_RATE_LIMIT,
  checkRateLimit,
  resetRateLimits,
} from '../lib/rate-limit.ts';

const WINDOW = 60_000;

test('allows requests up to the limit, then blocks', () => {
  resetRateLimits();
  for (let i = 0; i < 3; i += 1) {
    assert.equal(checkRateLimit('user-a', 3, WINDOW, 0).allowed, true);
  }
  const blocked = checkRateLimit('user-a', 3, WINDOW, 0);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterMs > 0);
});

test('the window resets', () => {
  resetRateLimits();
  assert.equal(checkRateLimit('user-b', 1, WINDOW, 0).allowed, true);
  assert.equal(checkRateLimit('user-b', 1, WINDOW, 1).allowed, false);
  assert.equal(checkRateLimit('user-b', 1, WINDOW, WINDOW).allowed, true);
});

test('keys are isolated (one user cannot throttle another)', () => {
  resetRateLimits();
  assert.equal(checkRateLimit('alice', 1, WINDOW, 0).allowed, true);
  assert.equal(checkRateLimit('bob', 1, WINDOW, 0).allowed, true);
  assert.equal(checkRateLimit('alice', 1, WINDOW, 0).allowed, false);
});

test('the attempt budget is a sane, documented value', () => {
  assert.ok(ATTEMPT_RATE_LIMIT.limit > 0);
  assert.ok(ATTEMPT_RATE_LIMIT.windowMs >= 60_000);
});
