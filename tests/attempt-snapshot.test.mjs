import test from 'node:test';
import assert from 'node:assert/strict';

import { computeScore } from '../lib/typing/scoring.ts';
import { attemptSnapshot } from '../lib/typing/attempt-snapshot.ts';

/*
 * The snapshot is what gets written to TypingAttempt. These tests keep
 * the database row and the scoring engine in lock-step.
 */

const CASES = [
  ['The cat sat on the mat', 'The cat sat on the mat'],
  ['The cat sat on the mat', 'The cat'],
  ['The cat sat on the mat', 'The sat on the mat'],
  ['The cat sat on the mat', 'The cat sat on the mat now'],
  ['Hello, world. Goodbye!', 'Hello world Goodbye'],
  ["dog. Don't stop", 'dog Dont stop'],
  ['one, two, three.', 'one two three'],
  ['a b c d', 'a b c d.'],
];

test('the snapshot copies every engine number', () => {
  for (const [reference, typed] of CASES) {
    const score = computeScore(reference, typed, 30_000);
    const snap = attemptSnapshot(score);

    assert.equal(snap.completion, score.completion);
    assert.equal(snap.wordsCorrect, score.words.correct);
    assert.equal(snap.wordsIncorrect, score.words.incorrect);
    assert.equal(snap.wordsExtra, score.words.extra);
    assert.equal(snap.wordsMissed, score.words.missed);
    assert.equal(snap.wordsTotal, score.words.total);
    assert.equal(snap.punctuationCorrect, score.punctuation.correct);
    assert.equal(snap.punctuationIncorrect, score.punctuation.incorrect);
    assert.equal(snap.punctuationExtra, score.punctuation.extra);
    assert.equal(snap.punctuationMissed, score.punctuation.missed);
    assert.equal(snap.punctuationTotal, score.punctuation.total);
  }
});

test('the snapshot no longer carries the legacy character counters', () => {
  const snap = attemptSnapshot(
    computeScore('The cat sat on the mat', 'The cat sat', 30_000)
  );

  assert.equal('correctCharacters' in snap, false);
  assert.equal('incorrectCharacters' in snap, false);
});

test('snapshot rows satisfy the breakdown invariants', () => {
  for (const [reference, typed] of CASES) {
    const snap = attemptSnapshot(computeScore(reference, typed, 30_000));

    assert.equal(
      snap.wordsCorrect + snap.wordsIncorrect + snap.wordsMissed,
      snap.wordsTotal,
      `words invariant: ${reference} / ${typed}`
    );
    assert.equal(
      snap.punctuationCorrect +
        snap.punctuationIncorrect +
        snap.punctuationMissed,
      snap.punctuationTotal,
      `punctuation invariant: ${reference} / ${typed}`
    );
  }
});

test('a perfect run stores a clean row', () => {
  const snap = attemptSnapshot(
    computeScore('The cat sat.', 'The cat sat.', 30_000)
  );

  assert.equal(snap.completion, 100);
  assert.equal(snap.wordsCorrect, 3);
  assert.equal(snap.wordsIncorrect, 0);
  assert.equal(snap.wordsExtra, 0);
  assert.equal(snap.wordsMissed, 0);
  assert.equal(snap.wordsTotal, 3);
  assert.equal(snap.punctuationCorrect, 1);
  assert.equal(snap.punctuationTotal, 1);
});

test('a wrong word is stored as incorrect, not missed plus extra', () => {
  const snap = attemptSnapshot(
    computeScore('The cat sat', 'The dog sat', 30_000)
  );

  assert.equal(snap.wordsCorrect, 2);
  assert.equal(snap.wordsIncorrect, 1);
  assert.equal(snap.wordsMissed, 0);
  assert.equal(snap.wordsExtra, 0);
});

test('an extra word is stored as extra', () => {
  const snap = attemptSnapshot(
    computeScore('The cat sat', 'The cat sat now', 30_000)
  );

  assert.equal(snap.wordsCorrect, 3);
  assert.equal(snap.wordsExtra, 1);
  assert.equal(snap.wordsIncorrect, 0);
});
