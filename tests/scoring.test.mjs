import test from 'node:test';
import assert from 'node:assert/strict';

import {
  align,
  buildTokenDisplayItems,
  computeScore,
  countScoredWords,
  splitMissedNotReached,
  tokenizeScored,
  MAX_ALIGN_CHARS,
} from '../lib/typing/scoring.ts';

const score = (ref, typed, elapsed = 10_000) =>
  computeScore(ref, typed, elapsed);

test('exact match scores 100% accuracy and completion', () => {
  const s = score('The cat sat', 'The cat sat');
  assert.equal(s.accuracy, 100);
  assert.equal(s.completion, 100);
  assert.equal(s.words.correct, 3);
  assert.equal(s.punctuation.total, 0);
  assert.equal(s.items.correct, 3);
  assert.equal(s.scored, true);
});

test('exact match with punctuation scores punctuation separately', () => {
  const s = score('Hello, world.', 'Hello, world.');
  assert.equal(s.accuracy, 100);
  assert.equal(s.words.total, 2);
  assert.equal(s.words.correct, 2);
  assert.equal(s.punctuation.total, 2);
  assert.equal(s.punctuation.correct, 2);
  assert.equal(s.items.total, 4);
  assert.equal(s.items.correct, 4);
});

test('missing punctuation keeps words correct and reports punct missed', () => {
  const s = score('Good evening. The cat sat.', 'Good evening The cat sat');
  assert.equal(s.words.correct, 5);
  assert.equal(s.words.incorrect, 0);
  assert.equal(s.punctuation.correct, 0);
  assert.equal(s.punctuation.missed, 2);
  // 5 correct of 7 evaluated items
  assert.equal(s.accuracy, 71);
  const split = splitMissedNotReached(s.alignment);
  assert.equal(split.missed.length, 2);
  assert.ok(split.missed.every((e) => e.tokenKind === 'punct'));
  assert.equal(split.notReached.length, 0);
});

test('missing all punctuation is 50%, not 0%', () => {
  const s = score('Hello, world. Goodbye.', 'Hello world Goodbye');
  assert.equal(s.words.correct, 3);
  assert.equal(s.punctuation.missed, 3);
  assert.equal(s.accuracy, 50);
});

test('case mismatch makes the word wrong (case-sensitive)', () => {
  const s = score('The cat sat', 'the cat sat');
  assert.equal(s.words.correct, 2);
  assert.equal(s.words.incorrect, 1);
  assert.equal(s.accuracy, 66);
});

test('partial prefix excludes tail from accuracy, counts it in completion', () => {
  const s = score('The cat sat on the mat', 'The cat');
  assert.equal(s.accuracy, 100);
  assert.equal(s.completion, 31);
  const split = splitMissedNotReached(s.alignment);
  assert.equal(split.missed.length, 0);
  assert.equal(split.notReached.length, 4);
});

test('skipped word in the middle is missed and hurts accuracy', () => {
  const s = score('The cat sat', 'The sat');
  assert.equal(s.words.correct, 2);
  assert.equal(s.accuracy, 66);
  const split = splitMissedNotReached(s.alignment);
  assert.deepEqual(
    split.missed.map((e) => e.expected),
    ['cat']
  );
  assert.equal(split.notReached.length, 0);
});

test('typo early then stop does not inflate reach (regression)', () => {
  // Old bug: char alignment matched typed "a" to "a" in "sat",
  // promoting "sat" to missed-yellow. Token alignment must not.
  const s = score('the cat sat on the mat', 'the cta');
  assert.equal(s.words.correct, 1);
  assert.equal(s.words.incorrect, 1);
  const split = splitMissedNotReached(s.alignment);
  assert.equal(split.missed.length, 0);
  assert.equal(split.notReached.length, 4);
  assert.deepEqual(
    split.notReached.map((e) => e.expected),
    ['sat', 'on', 'the', 'mat']
  );
});

test('suffix skip counts skipped words as missed', () => {
  const s = score('the cat sat on the mat', 'sat on the mat');
  assert.equal(s.words.correct, 4);
  assert.equal(s.accuracy, 66);
  const split = splitMissedNotReached(s.alignment);
  assert.deepEqual(
    split.missed.map((e) => e.expected),
    ['the', 'cat']
  );
});

test('extra word hurts accuracy', () => {
  const s = score('The cat sat', 'The cat sat now');
  assert.equal(s.words.correct, 3);
  assert.equal(s.words.extra, 1);
  assert.equal(s.accuracy, 75);
});

test('extra punctuation hurts accuracy', () => {
  const s = score('Hello world', 'Hello world!');
  assert.equal(s.words.correct, 2);
  assert.equal(s.punctuation.extra, 1);
  assert.equal(s.accuracy, 66);
});

test('wrong word is incorrect, not missed+extra', () => {
  const s = score('The cat sat', 'The dog sat');
  assert.equal(s.words.correct, 2);
  assert.equal(s.words.incorrect, 1);
  assert.equal(s.words.missed, 0);
  assert.equal(s.words.extra, 0);
});

test('wrong punctuation is incorrect', () => {
  const s = score('Hello, world', 'Hello. world');
  assert.equal(s.words.correct, 2);
  assert.equal(s.punctuation.incorrect, 1);
  assert.equal(s.accuracy, 66);
});

test('trailing punctuation after last word is missed, not not-reached', () => {
  const s = score('Hello world.', 'Hello world');
  assert.equal(s.words.correct, 2);
  assert.equal(s.punctuation.missed, 1);
  assert.equal(s.accuracy, 66);
  const split = splitMissedNotReached(s.alignment);
  assert.equal(split.missed.length, 1);
  assert.equal(split.notReached.length, 0);
});

test('empty typed scores 0 and everything is not reached', () => {
  const s = score('The cat sat', '');
  assert.equal(s.accuracy, 0);
  assert.equal(s.completion, 0);
  assert.equal(s.scored, false);
  const split = splitMissedNotReached(s.alignment);
  assert.equal(split.missed.length, 0);
  assert.equal(split.notReached.length, 3);
});

test('empty reference and empty typed scores 100 but not scored', () => {
  const s = score('', '');
  assert.equal(s.accuracy, 100);
  assert.equal(s.completion, 100);
  assert.equal(s.scored, false);
});

test('short attempts are not scored (timing thresholds)', () => {
  const s = score('The cat sat on the mat', 'The', 500);
  assert.equal(s.scored, false);
  assert.equal(s.rawWpm, 0);
  assert.equal(s.netWpm, 0);
});

test('repeated text anchors to the start, not a later occurrence', () => {
  const s = score('the cat the cat the cat', 'the cat');
  assert.equal(s.words.correct, 2);
  const split = splitMissedNotReached(s.alignment);
  assert.equal(split.missed.length, 0);
  assert.equal(split.notReached.length, 4);
});

test("apostrophes and hyphens stay inside words", () => {
  assert.deepEqual(
    tokenizeScored("I don't know.").map((t) => t.text),
    ['I', "don't", 'know', '.']
  );
  assert.deepEqual(
    tokenizeScored('cross-examination').map((t) => t.text),
    ['cross-examination']
  );
  const s = score("I don't know.", "I don't know.");
  assert.equal(s.accuracy, 100);
  assert.equal(s.words.total, 3);
  assert.equal(s.punctuation.total, 1);
});

test('tokenize splits punctuation runs as single tokens', () => {
  assert.deepEqual(
    tokenizeScored('Good evening. The cat sat.').map((t) => [
      t.text,
      t.kind,
    ]),
    [
      ['Good', 'word'],
      ['evening', 'word'],
      ['.', 'punct'],
      ['The', 'word'],
      ['cat', 'word'],
      ['sat', 'word'],
      ['.', 'punct'],
    ]
  );
  assert.deepEqual(
    tokenizeScored('world...').map((t) => t.text),
    ['world', '...']
  );
});

test('countScoredWords ignores punctuation-only chunks', () => {
  assert.equal(countScoredWords('!!! ??? ...'), 0);
  assert.equal(countScoredWords('Hello, world!'), 2);
  assert.equal(countScoredWords(''), 0);
  assert.equal(countScoredWords("don't stop"), 2);
});

test('token display reconstructs the typed text exactly', () => {
  const cases = [
    ['The cat sat', 'The cat sat'],
    ['Good evening. The cat sat.', 'Good evening The cat sat'],
    ['the cat sat on the mat', 'the cta'],
    ['Hello, world.', 'Hello world'],
    ["I don't know.", "I don't know."],
    ['The cat sat', 'The dog sat'],
    ['The cat sat', 'The cat sat now'],
  ];

  for (const [ref, typed] of cases) {
    const alignment = align(ref, typed);
    const display = buildTokenDisplayItems(alignment)
      .map((item) => item.ch)
      .join('');
    assert.equal(display, alignment.typed, `ref=${ref} typed=${typed}`);
  }
});

test('token display colors correct tokens green and wrong chars red', () => {
  const alignment = align('The cat sat', 'The dog sat');
  const display = buildTokenDisplayItems(alignment);
  const text = display.map((item) => item.ch).join('');
  assert.equal(text, 'The dog sat');
  // "The " green, "dog" red, " sat" green
  assert.ok(display.slice(0, 4).every((i) => i.state === 'correct'));
  assert.ok(display.slice(4, 7).every((i) => i.state === 'wrong'));
  assert.ok(display.slice(7).every((i) => i.state === 'correct'));
});

test('align() rejects inputs over MAX_ALIGN_CHARS', () => {
  assert.throws(
    () => align('a'.repeat(MAX_ALIGN_CHARS + 1), ''),
    RangeError
  );
  assert.throws(
    () => align('', 'a'.repeat(MAX_ALIGN_CHARS + 1)),
    RangeError
  );
});

test('wordDiff alias matches tokenDiff', () => {
  const alignment = align('Hello, world.', 'Hello world');
  assert.deepEqual(alignment.wordDiff, alignment.tokenDiff);
});

test('WPM uses wall-clock elapsed and accuracy adjustment', () => {
  // 11 chars in 10s => (11/5)/(10/60) = 13.2 raw, 100% => 13 net
  const s = score('The cat sat', 'The cat sat', 10_000);
  assert.equal(s.rawWpm, 13);
  assert.equal(s.netWpm, 13);
  // 66% accuracy => net = round(13.2 * 0.66) = 9
  const s2 = score('The cat sat', 'the cat sat', 10_000);
  assert.equal(s2.rawWpm, 13);
  assert.equal(s2.netWpm, 9);
});

test('display shows exactly the typed text, green/red only', () => {
  // Regression: "tribnal" for "tribunal" (missing "u") used to render
  // all-green, looking correct. The display is now exactly what was
  // typed, and a wrong word is fully red.
  const alignment = align('The tribunal reserved', 'the tribnal reserved');
  const display = buildTokenDisplayItems(alignment);
  const text = display.map((item) => item.ch).join('');
  assert.equal(text, 'the tribnal reserved');
  assert.equal(text, alignment.typed);
  // Only correct/wrong states exist — no missed/extra inline.
  assert.ok(display.every((i) => i.state === 'correct' || i.state === 'wrong'));
  // "the" wrong (case), "tribnal" fully red, " reserved" green.
  assert.ok(display.slice(0, 3).every((i) => i.state === 'wrong'));
  assert.ok(display.slice(4, 11).every((i) => i.state === 'wrong'));
  assert.ok(display.slice(11).every((i) => i.state === 'correct'));
  assert.equal(alignment.words.incorrect, 2); // The/the + tribunal/tribnal
});

test('missing first letter makes the whole word red, text stays typed', () => {
  const alignment = align('after hearing', 'fter hearing');
  const display = buildTokenDisplayItems(alignment);
  assert.equal(display.map((item) => item.ch).join(''), 'fter hearing');
  assert.ok(display.slice(0, 4).every((i) => i.state === 'wrong'));
  assert.ok(display.slice(4).every((i) => i.state === 'correct'));
});

test('extra typed word is red, not a separate state', () => {
  const alignment = align('The cat sat', 'The cat sat now');
  const display = buildTokenDisplayItems(alignment);
  assert.equal(display.map((item) => item.ch).join(''), 'The cat sat now');
  assert.ok(display.slice(0, 12).every((i) => i.state === 'correct'));
  assert.ok(display.slice(12).every((i) => i.state === 'wrong'));
});


/* ─── Contract tests ─────────────────────────────────────── */

test('correct + wrong + missed always equals the reference total', () => {
  const cases = [
    ['The cat sat on the mat', 'The cat sat on the mat'],
    ['The cat sat on the mat', 'The cat'],
    ['The cat sat on the mat', 'The sat on the mat'],
    ['The cat sat on the mat', 'The cat sat on the mat now'],
    ['Hello, world. Goodbye!', 'Hello world Goodbye'],
    ['one, two, three.', 'one two three'],
    ['a b c d', 'a b c d.'],
  ];

  for (const [reference, typed] of cases) {
    const { words, punctuation, items } = score(reference, typed);

    assert.equal(
      words.correct + words.incorrect + words.missed,
      words.total,
      `words invariant: ref=${reference} typed=${typed}`
    );
    assert.equal(
      punctuation.correct + punctuation.incorrect + punctuation.missed,
      punctuation.total,
      `punctuation invariant: ref=${reference} typed=${typed}`
    );
    assert.equal(
      items.correct + items.incorrect + items.missed,
      items.total,
      `items invariant: ref=${reference} typed=${typed}`
    );
  }
});

test('omitting punctuation keeps words correct but costs accuracy', () => {
  // Product decision: accuracy is attempted-only and includes
  // punctuation as its own item, so a word-perfect run with no
  // punctuation scores below 100. The words row stays 100% correct.
  const reference = 'Hello, world. Goodbye!';
  const typed = 'Hello world Goodbye';

  const s = score(reference, typed);

  assert.equal(s.words.correct, s.words.total);
  assert.equal(s.words.incorrect, 0);
  assert.equal(s.punctuation.correct, 0);
  assert.equal(s.punctuation.missed, 3);
  assert.equal(s.items.correct, 3);
  assert.equal(s.alignment.evaluatedItems, 6);
  assert.equal(s.accuracy, 50);
});

test('attempted-only accuracy excludes the untouched tail but completion does not', () => {
  // Product decision (confirmed): accuracy answers "of what you
  // attempted, how much was right?"; completion answers "how much of
  // the passage did you cover?". They must never be read as the same
  // number, which is why the UI shows them separately.
  const reference = 'The cat sat on the mat';
  const typed = 'The cat';

  const s = score(reference, typed);

  assert.equal(s.accuracy, 100);
  assert.ok(s.completion < 100);
  assert.equal(s.words.correct, 2);
  assert.equal(s.words.missed, 4);
  assert.equal(s.alignment.evaluatedItems, 2);
});
