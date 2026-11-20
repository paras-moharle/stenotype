import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acceptsInput,
  countsAsRecorded,
  persistsAttempt,
  MAX_EXTRA_CHARS,
  typedCharCap,
  usesAnchoredAutoFinish,
} from '../lib/typing/mode-rules.ts';

const MAX_ALIGN_CHARS = 20_000;

/*
 * Regression suite for the "dictation mode is dead" bug.
 *
 * The typing surface used to be gated on `reference.length > 0`. In
 * dictation mode the reference is only fetched *after* an attempt is
 * scored, so with no reference there was no input, no attempt, and
 * never a transcript: a circular dead end. These rules decouple
 * "can I type?" from "do I have text to show?".
 */

test('dictation accepts input with a selected dictation even with no reference', () => {
  assert.equal(
    acceptsInput({ mode: 'dictation', referenceLength: 0, dictationId: 'abc' }),
    true
  );
});

test('dictation refuses input when no dictation is selected', () => {
  assert.equal(
    acceptsInput({ mode: 'dictation', referenceLength: 0, dictationId: '' }),
    false
  );
  assert.equal(
    acceptsInput({ mode: 'dictation', referenceLength: 120, dictationId: null }),
    false
  );
});

test('free and custom still require a local reference', () => {
  assert.equal(acceptsInput({ mode: 'free', referenceLength: 0 }), false);
  assert.equal(acceptsInput({ mode: 'custom', referenceLength: 0 }), false);
  assert.equal(acceptsInput({ mode: 'free', referenceLength: 10 }), true);
  assert.equal(acceptsInput({ mode: 'custom', referenceLength: 10 }), true);
});

test('dictation never auto-finishes on a text match', () => {
  // Even after the server returns the transcript, a dictation run must
  // not complete itself — the typist submits (or a timer ends it).
  assert.equal(usesAnchoredAutoFinish('dictation', 0), false);
  assert.equal(usesAnchoredAutoFinish('dictation', 500), false);
});

test('free and custom auto-finish only with a local reference', () => {
  assert.equal(usesAnchoredAutoFinish('free', 0), false);
  assert.equal(usesAnchoredAutoFinish('free', 20), true);
  assert.equal(usesAnchoredAutoFinish('custom', 0), false);
  assert.equal(usesAnchoredAutoFinish('custom', 20), true);
});

test('typed characters are capped to reference + overshoot', () => {
  assert.equal(typedCharCap(0, MAX_ALIGN_CHARS), MAX_ALIGN_CHARS);
  assert.equal(typedCharCap(100, MAX_ALIGN_CHARS), 100 + MAX_EXTRA_CHARS);
  assert.equal(typedCharCap(1_000, MAX_ALIGN_CHARS), 1_000 + MAX_EXTRA_CHARS);
});

test('typed-character cap never exceeds the engine limit', () => {
  assert.equal(typedCharCap(MAX_ALIGN_CHARS, MAX_ALIGN_CHARS), MAX_ALIGN_CHARS);
  assert.equal(
    typedCharCap(MAX_ALIGN_CHARS - 10, MAX_ALIGN_CHARS),
    MAX_ALIGN_CHARS
  );
});

test('only dictation with a selected dictation is persisted', () => {
  assert.equal(
    persistsAttempt({ mode: 'dictation', dictationId: 'abc' }),
    true
  );
  assert.equal(persistsAttempt({ mode: 'dictation', dictationId: '' }), false);
});

test('free and custom are never persisted, even when signed in', () => {
  // Product rule: only dictation results are stored. A free or custom
  // run must never reach the attempts API, whatever the reference is.
  assert.equal(persistsAttempt({ mode: 'free' }), false);
  assert.equal(persistsAttempt({ mode: 'custom' }), false);
});

/* ─── "Counted" badge truthfulness ───────────────────────── */

test('only a finished, blind, scored dictation is called counted', () => {
  const base = {
    finished: true,
    blind: true,
    scored: true,
    dictationId: 'abc',
  };
  assert.equal(countsAsRecorded({ mode: 'dictation', ...base }), true);
  assert.equal(countsAsRecorded({ mode: 'free', ...base }), false);
  assert.equal(countsAsRecorded({ mode: 'custom', ...base }), false);
  assert.equal(
    countsAsRecorded({ mode: 'dictation', ...base, finished: false }),
    false
  );
  assert.equal(
    countsAsRecorded({ mode: 'dictation', ...base, blind: false }),
    false
  );
  assert.equal(
    countsAsRecorded({ mode: 'dictation', ...base, scored: false }),
    false
  );
  assert.equal(
    countsAsRecorded({ mode: 'dictation', ...base, dictationId: '' }),
    false
  );
});
