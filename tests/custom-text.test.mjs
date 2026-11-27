import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inspectCustomText,
  MIN_CUSTOM_WORDS,
} from '../lib/typing/custom-text.ts';
import { computeScore, MAX_CUSTOM_CHARS } from '../lib/typing/scoring.ts';
import { persistsAttempt } from '../lib/typing/mode-rules.ts';

/*
 * Custom-text validation is the gate for local practice. It had no
 * tests at all; the same checks were duplicated in the dialog and the
 * apply handler, so they could silently drift apart.
 */

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

test('a passage below the word minimum is rejected', () => {
  const check = inspectCustomText(words(MIN_CUSTOM_WORDS - 1));
  assert.equal(check.tooShort, true);
  assert.equal(check.ok, false);
  assert.equal(check.words, MIN_CUSTOM_WORDS - 1);
});

test('a passage at the word minimum is accepted', () => {
  const check = inspectCustomText(words(MIN_CUSTOM_WORDS));
  assert.equal(check.tooShort, false);
  assert.equal(check.tooLong, false);
  assert.equal(check.ok, true);
});

test('empty input is rejected as too short', () => {
  const check = inspectCustomText('');
  assert.equal(check.ok, false);
  assert.equal(check.words, 0);
});

test('over-long text is rejected', () => {
  const check = inspectCustomText('word '.repeat(Math.ceil(MAX_CUSTOM_CHARS / 5) + 10));
  assert.equal(check.tooLong, true);
  assert.equal(check.ok, false);
  assert.ok(check.chars > MAX_CUSTOM_CHARS);
});

test('the sanitized text is what the caller would use', () => {
  const check = inspectCustomText(
    '“Smart quotes” and an em dash — plus ‘single’ quotes. Extra   spaces.'
  );
  assert.equal(check.text, `"Smart quotes" and an em dash - plus 'single' quotes. Extra spaces.`);
  assert.equal(check.text, check.text.trim());
  assert.ok(!check.text.includes('  '));
});

test('sanitization keeps hyphenated compounds as one word', () => {
  // Non-breaking hyphens are transliterated to "-", so the compound
  // stays a single scored word instead of splitting into four.
  const check = inspectCustomText('state\u2011of\u2011the\u2011art');
  assert.equal(check.words, 1);
});

test('sanitization can change the word count for a zero-width space', () => {
  // A zero-width space is a separator; it turns one token into two.
  const check = inspectCustomText('hello\u200Bworld');
  assert.equal(check.words, 2);
});

test('the word count and the applied text come from the same pass', () => {
  const input = 'one two three four five six seven eight nine ten';
  const check = inspectCustomText(input);
  assert.equal(check.ok, true);
  assert.equal(check.words, 10);
  // Applying the check's text must not change the count.
  assert.equal(inspectCustomText(check.text).words, check.words);
});

/* ─── Custom paste end to end ────────────────────────────── */

test('a messy pasted passage can be typed perfectly after sanitising', () => {
  const pasted = `“The quick brown fox” jumps over the lazy dog —
it’s that simple… isn’t it?

Café owners in Straße disagree; 1½ cups later, they don’t care.`;

  const check = inspectCustomText(pasted);
  assert.equal(check.ok, true);

  // Typing exactly the sanitised text scores 100% on both words and
  // punctuation — the reference and what the student sees are the same.
  const score = computeScore(check.text, check.text, 60_000);
  assert.equal(score.accuracy, 100);
  assert.equal(score.completion, 100);
  assert.equal(score.words.correct, score.words.total);
  assert.equal(score.punctuation.correct, score.punctuation.total);
  assert.equal(score.words.incorrect + score.words.missed + score.words.extra, 0);
});

test('custom text is never persisted', () => {
  assert.equal(persistsAttempt({ mode: 'custom', dictationId: 'abc' }), false);
});

test('maximum-length supported custom practice scores without truncation', () => {
  const unit = 'A calm writer checks figures, names and punctuation. ';
  const original = unit.repeat(Math.ceil(MAX_CUSTOM_CHARS / unit.length))
    .slice(0, MAX_CUSTOM_CHARS - 1) + 'x';
  const check = inspectCustomText(original);
  assert.equal(check.ok, true);
  assert.equal(check.chars, MAX_CUSTOM_CHARS);
  assert.equal(computeScore(check.text, check.text, 60_000).completion, 100);
});
