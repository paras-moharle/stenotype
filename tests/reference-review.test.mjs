import test from 'node:test';
import assert from 'node:assert/strict';
import { align } from '../lib/typing/scoring.ts';
import { referenceReview } from '../lib/typing/reference-review.ts';

test('a skipped word is amber but the unattempted suffix remains separate', () => {
  const result = referenceReview(align('Start with the statement, then continue quietly.', 'Start the statement,'), false);
  assert.deepEqual(result.attempted.filter(item => item.tone === 'missed').map(item => item.text.trim()), ['with']);
  assert.equal(result.remaining, 'then continue quietly.');
  assert.equal(result.remainingItems, 4);
});

test('completed and partially typed references retain normalized source order', () => {
  const source = 'Café  ready,\nready again.';
  for (const typed of ['', 'Café ready, rea', 'Wrong words', 'Café ready, ready again. extra']) {
    const alignment = align(source, typed);
    const result = referenceReview(alignment, false);
    assert.equal(result.attempted.map(item => item.text).join('') + result.remaining, alignment.reference);
    if (!typed) assert.equal(result.attempted.length, 0);
    if (typed.endsWith('extra')) {
      assert.equal(result.remainingItems, 0);
      assert.ok(result.extras.includes('extra'));
    }
  }
});

test('dictation retains complete reference with all omissions marked', () => {
  const alignment = align('The record shows the entire account.', 'The record');
  const result = referenceReview(alignment, true);
  assert.equal(result.remainingItems, 0);
  assert.equal(result.attempted.map(item => item.text).join(''), alignment.reference);
  assert.ok(result.attempted.some(item => item.tone === 'missed'));
});
