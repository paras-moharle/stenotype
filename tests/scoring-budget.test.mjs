import test from 'node:test';
import assert from 'node:assert/strict';

import { align } from '../lib/typing/scoring.ts';

/*
 * The alignment DP is O(n·m). Two 20,000-character strings pass the
 * length cap but need ~400M cells (~800 MB) — enough to OOM a serverless
 * function. These guards must reject that while still allowing a realistic
 * long dictation.
 */

test('a realistic long dictation still scores', () => {
  // 5,000 characters on each side with no common prefix/suffix.
  const reference = 'a'.repeat(5000);
  const typed = 'b'.repeat(5000);
  const result = align(reference, typed);
  assert.equal(result.refLength, 5000);
});

test('the 20k x 20k worst case is rejected', () => {
  assert.throws(
    () => align('a'.repeat(20_000), 'b'.repeat(20_000)),
    (error) =>
      error instanceof RangeError && /character alignment work budget/.test(error.message)
  );
});

test('just over the character budget is rejected', () => {
  assert.throws(
    () => align('a'.repeat(5100), 'b'.repeat(5100)),
    (error) =>
      error instanceof RangeError && /character alignment work budget/.test(error.message)
  );
});

test('too many tokens is rejected by the token budget', () => {
  const words = (n) =>
    Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  assert.throws(
    () => align(words(2100), words(2100).replaceAll('w', 'x')),
    (error) =>
      error instanceof RangeError && /token alignment work budget/.test(error.message)
  );
});

test('short and medium inputs are unaffected', () => {
  for (const [reference, typed] of [
    ['The cat sat on the mat', 'The cat sat on the mat'],
    ['The court shall proceed. '.repeat(20), 'The court shall proceed. '.repeat(19)],
  ]) {
    assert.doesNotThrow(() => align(reference, typed));
  }
});
