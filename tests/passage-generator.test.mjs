import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generatePassage,
  recommendDuration,
  PASSAGE_BANK,
} from '../lib/passage-generator.ts';
import { sanitizeForTyping } from '../lib/sanitize.ts';

const CATEGORIES = ['Legal', 'Professional', 'General'];

const words = (text) => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

test('generates a non-empty passage', () => {
  const passage = generatePassage();

  assert.equal(typeof passage, 'string');
  assert.ok(passage.trim().length > 0);
  assert.ok(words(passage) >= 50);
});

test('every category produces a passage from its own bank', () => {
  for (const category of CATEGORIES) {
    const passage = generatePassage({ category });
    assert.ok(PASSAGE_BANK[category].includes(passage), category);
  }
});

test('mixed picks a passage from one of the category banks', () => {
  const passage = generatePassage({ category: 'mixed' });
  const all = CATEGORIES.flatMap((category) => PASSAGE_BANK[category]);

  assert.ok(all.includes(passage));
});

test('the same seed returns the same passage', () => {
  const first = generatePassage({ category: 'Legal', seed: 3 });
  const second = generatePassage({ category: 'Legal', seed: 3 });

  assert.equal(first, second);
});

test('negative seeds select a valid passage deterministically', () => {
  const first = generatePassage({ category: 'Legal', seed: -1 });
  const second = generatePassage({ category: 'Legal', seed: -1 });

  assert.equal(first, second);
  assert.ok(PASSAGE_BANK.Legal.includes(first));
});

test('non-finite seeds are rejected', () => {
  assert.throws(
    () => generatePassage({ category: 'Legal', seed: Number.NaN }),
    RangeError
  );
  assert.throws(
    () =>
      generatePassage({
        category: 'Legal',
        seed: Number.POSITIVE_INFINITY,
      }),
    RangeError
  );
});

test('targetWords narrows the pool to passages of a similar length', () => {
  for (let seed = 0; seed < 20; seed += 1) {
    const passage = generatePassage({
      category: 'Legal',
      targetWords: 60,
      seed,
    });

    assert.ok(Math.abs(words(passage) - 60) <= 20);
  }
});

test('passages are always within the documented 50–100 word range', () => {
  for (const category of CATEGORIES) {
    for (const passage of PASSAGE_BANK[category]) {
      const count = words(passage);
      assert.ok(count >= 50 && count <= 100, `${category}: ${count}`);
    }
  }
});

test('consecutive draws do not repeat a passage too early', () => {
  const seen = new Set();

  for (let i = 0; i < 5; i += 1) {
    const passage = generatePassage({ category: 'General' });

    assert.ok(!seen.has(passage), 'passage repeated too early');
    seen.add(passage);
  }
});

test('invalid target word counts are rejected', () => {
  assert.throws(
    () => generatePassage({ targetWords: Number.NaN }),
    RangeError
  );
  assert.throws(() => generatePassage({ targetWords: -1 }), RangeError);
});

test('recommendDuration uses the available duration buckets', () => {
  assert.equal(recommendDuration('one two three'), 15);
  assert.equal(recommendDuration(Array(10).fill('word').join(' ')), 30);
  assert.equal(recommendDuration(Array(60).fill('word').join(' ')), 60);
  assert.equal(recommendDuration(Array(120).fill('word').join(' ')), 60);
  assert.equal(recommendDuration(''), 15);
});

/* ─── Typeability ────────────────────────────────────────── */

test('every curated passage is typeable on a standard keyboard', () => {
  // A curated passage containing a character no keyboard can produce
  // (e.g. an em dash) caps a word-perfect run below 100% and cannot be
  // pasted around because paste is blocked on the typing input.
  const allowed = /^[A-Za-z0-9 .,!?;:'"()\-]+$/;

  for (const category of CATEGORIES) {
    PASSAGE_BANK[category].forEach((passage, index) => {
      assert.match(
        passage,
        allowed,
        `${category}[${index}] contains a character that cannot be typed`
      );
    });
  }
});

test('every curated passage survives the custom-text sanitizer unchanged', () => {
  // The custom-text path runs sanitizeForTyping; a bank passage must
  // not be rewritten differently from how it is scored.
  for (const category of CATEGORIES) {
    PASSAGE_BANK[category].forEach((passage, index) => {
      assert.equal(
        sanitizeForTyping(passage),
        passage,
        `${category}[${index}] would be altered by sanitizeForTyping`
      );
    });
  }
});
