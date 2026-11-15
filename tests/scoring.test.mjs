import test from 'node:test';
import assert from 'node:assert/strict';

import {
  align,
  buildDisplayItems,
  buildLiveChars,
  computeScore,
  formatClock,
  normalizeText,
  scoreFromAlignment,
  MIN_SCORED_ELAPSED_MS,
  MIN_SCORED_TYPED_CHARS,
} from '../lib/typing/scoring.ts';

const PASSAGE =
  'The court shall proceed with the examination of the witness in accordance ' +
  'with the provisions of law and all parties shall be given a fair ' +
  'opportunity to present their arguments before the honorable judge ' +
  'delivers the final verdict.';

const WORD_COUNT = PASSAGE.trim().split(/\s+/).length;

/* ─── Normalization ──────────────────────────────────────── */

test('normalizeText collapses whitespace, trims, and keeps case', () => {
  assert.equal(normalizeText('  a   b \n c  '), 'a b c');
  assert.equal(normalizeText('Case'), 'Case');
  assert.notEqual(normalizeText('case'), normalizeText('Case'));
  assert.equal(normalizeText(''), '');
});

/* ─── Alignment and word statistics ──────────────────────── */

test('exact text has zero distance and 100% accuracy/completion', () => {
  const score = computeScore(PASSAGE, PASSAGE, 30_000);

  assert.equal(score.alignment.distance, 0);
  assert.equal(score.accuracy, 100);
  assert.equal(score.completion, 100);
  assert.equal(score.words.correct, WORD_COUNT);
  assert.equal(score.words.incorrect, 0);
  assert.equal(score.words.missed, 0);
  assert.equal(score.words.extra, 0);
  assert.equal(score.errors, 0);
});

test('a clean typed prefix has 100% accuracy but incomplete coverage', () => {
  const typed = PASSAGE.split(' ').slice(0, 10).join(' ');
  const score = computeScore(PASSAGE, typed, 30_000);

  assert.equal(score.accuracy, 100);
  assert.equal(score.words.correct, 10);
  assert.equal(score.words.missed, WORD_COUNT - 10);
  assert.ok(score.completion < 100);
});

test('untyped passage tail is not reported as a typing error', () => {
  const typed = PASSAGE.split(' ').slice(0, 10).join(' ');
  const score = computeScore(PASSAGE, typed, 30_000);

  assert.equal(score.errors, 0);
  assert.ok(score.alignment.distance > 100);
  assert.equal(score.accuracy, 100);
});

test('a missing middle word does not shift later correct words', () => {
  const score = computeScore('one two three four', 'one three four', 60_000);

  assert.deepEqual(score.words, {
    total: 4,
    correct: 3,
    incorrect: 0,
    missed: 1,
    extra: 0,
  });
  assert.equal(score.accuracy, 75);
  assert.deepEqual(score.alignment.wordDiff, [
    {
      index: 1,
      expected: 'two',
      actual: null,
      kind: 'missed',
    },
  ]);
});

test('an inserted middle word does not shift later correct words', () => {
  const score = computeScore(
    'one two three',
    'one extra two three',
    60_000
  );

  assert.deepEqual(score.words, {
    total: 3,
    correct: 3,
    incorrect: 0,
    missed: 0,
    extra: 1,
  });
  assert.equal(score.accuracy, 75);
  assert.deepEqual(score.alignment.wordDiff, [
    {
      index: 1,
      expected: null,
      actual: 'extra',
      kind: 'extra',
    },
  ]);
});

test('an untouched trailing word does not reduce attempted-word accuracy', () => {
  const score = computeScore('one two three four', 'one two', 60_000);

  assert.equal(score.words.correct, 2);
  assert.equal(score.words.missed, 2);
  assert.equal(score.accuracy, 100);
  assert.ok(score.completion < 100);
});

test('word stats preserve the reference-word total', () => {
  const score = computeScore(
    'one two three four',
    'one wrong three extra',
    60_000
  );

  assert.equal(
    score.words.correct + score.words.incorrect + score.words.missed,
    score.words.total
  );
});

test('one wrong character makes its whole word incorrect', () => {
  const typed = PASSAGE.replace('proceed', 'proceez');
  const score = computeScore(PASSAGE, typed, 60_000);

  assert.equal(score.alignment.substitutions, 1);
  assert.equal(score.alignment.deletions, 0);
  assert.equal(score.alignment.insertions, 0);
  assert.equal(score.errors, 1);
  assert.equal(score.words.incorrect, 1);
  assert.equal(score.words.correct, WORD_COUNT - 1);
});

test('case differences make the word incorrect', () => {
  const score = computeScore(
    'The court is open.',
    'the court is open.',
    60_000
  );

  assert.equal(score.words.correct, 3);
  assert.equal(score.words.incorrect, 1);
  assert.equal(score.accuracy, 75);
});

test('punctuation differences make the word incorrect', () => {
  const score = computeScore(
    'The court is open.',
    'The court is open',
    60_000
  );

  assert.equal(score.words.correct, 3);
  assert.equal(score.words.incorrect, 1);
  assert.equal(score.accuracy, 75);
});

test('a character insertion is an edit and makes its word incorrect', () => {
  const typed = PASSAGE.replace('proceed', 'proceeed');
  const score = computeScore(PASSAGE, typed, 60_000);

  assert.equal(score.alignment.substitutions, 0);
  assert.equal(score.alignment.insertions, 1);
  assert.equal(score.errors, 1);
  assert.equal(score.words.incorrect, 1);
});

test('a missing character inside a word is an edit', () => {
  const typed = PASSAGE.replace('proceed', 'proced');
  const score = computeScore(PASSAGE, typed, 60_000);

  assert.equal(score.alignment.deletions, 1);
  assert.equal(score.errors, 1);
  assert.equal(score.words.incorrect, 1);
  assert.ok(score.completion < 100);
});

test('a skipped character does not misalign the rest of the text', () => {
  const reference = 'the quick brown fox jumps over the lazy dog';
  const typed = 'the qick brown fox jumps over the lazy dog';
  const result = align(reference, typed);

  assert.equal(result.distance, 1);
  assert.equal(result.deletions, 1);
  assert.equal(result.matches, reference.length - 1);

  const after = result.ops.slice(
    result.ops.findIndex((op) => op.type === 'delete')
  );
  assert.ok(
    after.every((op) => op.type === 'equal' || op.type === 'delete')
  );
});

test('empty input is safe and never produces NaN or Infinity', () => {
  const score = computeScore(PASSAGE, '', 10_000);

  for (const value of [
    score.accuracy,
    score.completion,
    score.wpm,
    score.rawWpm,
    score.netWpm,
  ]) {
    assert.ok(Number.isFinite(value), `not finite: ${value}`);
  }

  assert.equal(score.accuracy, 0);
  assert.equal(score.completion, 0);
  assert.equal(score.words.correct, 0);
  assert.equal(score.words.missed, WORD_COUNT);
});

test('empty reference is safe, including typed extra text', () => {
  const empty = computeScore('', '', 0);

  assert.equal(empty.accuracy, 100);
  assert.equal(empty.completion, 100);
  assert.equal(empty.words.total, 0);

  const typed = computeScore('', 'abc', 5_000);

  assert.ok(Number.isFinite(typed.accuracy));
  assert.equal(typed.accuracy, 0);
  assert.equal(typed.completion, 0);
  assert.equal(typed.errors, 3);
  assert.equal(typed.words.extra, 1);
});

test('a corrected typo leaves no final error', () => {
  const wrong = computeScore(
    PASSAGE,
    PASSAGE.replace('proceed', 'proceeed'),
    60_000
  );
  const corrected = computeScore(PASSAGE, PASSAGE, 60_000);

  assert.equal(wrong.errors, 1);
  assert.equal(corrected.errors, 0);
  assert.equal(corrected.accuracy, 100);
});

/* ─── Accuracy and completion ────────────────────────────── */

test('accuracy uses exact attempted words and excludes untouched tail', () => {
  const score = computeScore(
    'one two three four five six',
    'one two three four X',
    60_000
  );

  assert.equal(score.accuracy, 80);
  assert.equal(score.words.correct, 4);
  assert.equal(score.words.incorrect, 1);
  assert.equal(score.words.missed, 1);
});

test('completion ignores inserted characters', () => {
  const score = computeScore('abcdefghij', 'abcdeXXXXX', 60_000);

  assert.equal(score.alignment.deletions, 0);
  assert.equal(score.completion, 100);
  assert.equal(score.accuracy, 0);
});

test('completion counts substitutions as covered and deletions as missing', () => {
  const substituted = computeScore('abcdef', 'zzzzzz', 10_000);
  assert.equal(substituted.alignment.deletions, 0);
  assert.equal(substituted.completion, 100);

  const empty = computeScore('abcdef', '', 10_000);
  assert.equal(empty.alignment.deletions, 6);
  assert.equal(empty.completion, 0);
});

test('extra words count against attempted-word accuracy', () => {
  const score = computeScore('one two', 'one two extra', 60_000);

  assert.equal(score.words.correct, 2);
  assert.equal(score.words.extra, 1);
  assert.equal(score.accuracy, 66);
  assert.equal(score.completion, 100);
});

/* ─── WPM and timing ─────────────────────────────────────── */

test('raw WPM uses typed characters / 5 / elapsed minutes', () => {
  const text = 'a'.repeat(50);
  const score = computeScore(text, text, 30_000);

  assert.equal(score.rawWpm, 20);
  assert.equal(score.netWpm, 20);
  assert.equal(score.wpm, score.netWpm);
});

test('net WPM is gross WPM adjusted by attempted-word accuracy', () => {
  const score = computeScore('one two', 'one wrong', 60_000);

  assert.equal(score.rawWpm, 2);
  assert.equal(score.accuracy, 50);
  assert.equal(score.netWpm, 1);
  assert.equal(score.wpm, score.netWpm);
});

test('elapsed time is taken from the caller wall clock', () => {
  const startedAt = 1_000_000;
  const finishedAt = startedAt + 45_000;
  const elapsed = finishedAt - startedAt;
  const score = scoreFromAlignment(align('abcdefghij', 'abcdefghij'), elapsed);

  assert.equal(score.elapsedMs, 45_000);
  assert.equal(
    score.rawWpm,
    Math.round(10 / 5 / (45_000 / 60_000))
  );
});

test('very short attempts are not scored', () => {
  const score = computeScore('abcdefghij', 'abc', 200);

  assert.equal(score.scored, false);
  assert.equal(score.wpm, 0);
  assert.equal(score.rawWpm, 0);
  assert.equal(score.netWpm, 0);
});

test('minimum scored thresholds are one second and five characters', () => {
  assert.equal(MIN_SCORED_ELAPSED_MS, 1000);
  assert.equal(MIN_SCORED_TYPED_CHARS, 5);

  assert.equal(computeScore('abcdefghij', 'abcd', 5_000).scored, false);
  assert.equal(computeScore('abcdefghij', 'abcde', 500).scored, false);
  assert.equal(computeScore('abcdefghij', 'abcde', 1_000).scored, true);
});

test('zero elapsed time never yields Infinity', () => {
  const score = computeScore('abcdefghij', 'abcdefghij', 0);

  assert.ok(Number.isFinite(score.rawWpm));
  assert.equal(score.rawWpm, 0);
  assert.equal(score.scored, false);
});

/* ─── Display helpers ────────────────────────────────────── */

test('review display uses the character alignment', () => {
  const result = align('abc def', 'abX de');
  const items = buildDisplayItems(result);

  assert.equal(items.length, 7);
  assert.deepEqual(
    items.map((item) => item.state),
    [
      'correct',
      'correct',
      'wrong',
      'correct',
      'correct',
      'correct',
      'missed',
    ]
  );
  assert.equal(items[2].expected, 'c');
  assert.equal(items[2].ch, 'X');
  assert.equal(items[6].ch, 'f');
});

test('live display is positional and puts the next character at the cursor', () => {
  const { chars, extras } = buildLiveChars(
    'the quick brown fox',
    'the qick'
  );

  assert.equal(extras, '');
  assert.deepEqual(
    chars.map((char) => char.state),
    [
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
      'wrong',
      'wrong',
      'wrong',
      'current',
      'untyped',
      'untyped',
      'untyped',
      'untyped',
      'untyped',
      'untyped',
      'untyped',
      'untyped',
      'untyped',
      'untyped',
    ]
  );

  const wrong = buildLiveChars('abc', 'aXc').chars;
  assert.deepEqual(
    wrong.map((char) => char.state),
    ['correct', 'wrong', 'correct']
  );
});

test('live display starts with the first character as the cursor', () => {
  const { chars, extras } = buildLiveChars('hello world', '');

  assert.equal(chars[0].state, 'current');
  assert.ok(chars.slice(1).every((char) => char.state === 'untyped'));
  assert.equal(extras, '');
});

test('live display puts overflow characters in extras', () => {
  const { extras } = buildLiveChars('abc', 'abcdef');
  assert.equal(extras, 'def');
});

test('extra characters appear as extra review items', () => {
  const items = buildDisplayItems(align('abc', 'abcdef'));

  assert.deepEqual(
    items.map((item) => item.state),
    ['correct', 'correct', 'correct', 'extra', 'extra', 'extra']
  );
});

test('formatClock renders m:ss', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(9), '0:09');
  assert.equal(formatClock(75), '1:15');
  assert.equal(formatClock(-5), '0:00');
});

test('multi-character input is compared as a whole', () => {
  const result = align('hello world', 'hello w');

  assert.equal(result.typed, 'hello w');
  assert.equal(result.typedLength, 7);
  assert.equal(result.distance, 4);
  assert.equal(result.matches, 7);
});

test('extra text beyond the reference is penalized, not clamped away', () => {
  const score = computeScore('abc', 'abcdefgh', 60_000);

  assert.equal(score.alignment.insertions, 5);
  assert.equal(score.errors, 5);
  assert.equal(score.completion, 100);
  assert.equal(score.words.incorrect, 1);
  assert.ok(score.accuracy < 100);
});
