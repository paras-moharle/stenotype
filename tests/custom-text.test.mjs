import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inspectCustomText,
  MIN_CUSTOM_WORDS,
} from '../lib/typing/custom-text.ts';
import { MAX_CUSTOM_CHARS } from '../lib/typing/scoring.ts';

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

test('sanitization can change the word count', () => {
  // A non-breaking hyphen splits a compound, which is a documented
  // behaviour of the sanitizer and therefore visible here.
  const check = inspectCustomText('state\u2011of\u2011the\u2011art');
  assert.equal(check.words, 4);
});

test('the word count and the applied text come from the same pass', () => {
  const input = 'one two three four five six seven eight nine ten';
  const check = inspectCustomText(input);
  assert.equal(check.ok, true);
  assert.equal(check.words, 10);
  // Applying the check's text must not change the count.
  assert.equal(inspectCustomText(check.text).words, check.words);
});
