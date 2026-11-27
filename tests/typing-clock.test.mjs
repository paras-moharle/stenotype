import test from 'node:test';
import assert from 'node:assert/strict';
import { finishTime, typingDeadline } from '../lib/typing/clock.ts';

test('finish is clamped to the exact deadline even if the timer callback runs late', () => {
  const deadline = typingDeadline(42.5, 15, true);
  assert.equal(deadline, 15042.5);
  assert.equal(finishTime(15042.49, deadline), 15042.49);
  assert.equal(finishTime(15129, deadline), 15042.5);
  assert.equal(finishTime(15129, typingDeadline(42.5, 15, false)), 15129);
});
