import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acceptsInput,
  canRequestScore,
  hasLocalReference,
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

test('hasLocalReference is exactly the reference test', () => {
  assert.equal(hasLocalReference(0), false);
  assert.equal(hasLocalReference(1), true);
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

test('dictation can request a score from its id alone', () => {
  assert.equal(
    canRequestScore({ mode: 'dictation', referenceLength: 0, dictationId: 'abc' }),
    true
  );
  assert.equal(
    canRequestScore({ mode: 'dictation', referenceLength: 0, dictationId: '' }),
    false
  );
});

test('other modes need a reference before asking for a score', () => {
  assert.equal(canRequestScore({ mode: 'free', referenceLength: 0 }), false);
  assert.equal(canRequestScore({ mode: 'free', referenceLength: 12 }), true);
  assert.equal(canRequestScore({ mode: 'custom', referenceLength: 0 }), false);
  assert.equal(canRequestScore({ mode: 'custom', referenceLength: 12 }), true);
});
