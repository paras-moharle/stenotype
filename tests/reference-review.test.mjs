import test from 'node:test';
import assert from 'node:assert/strict';
import { align, scoreFromAlignment, tokenizeScored } from '../lib/typing/scoring.ts';
import { referenceReview } from '../lib/typing/reference-review.ts';

test('a skipped word is amber but the unattempted suffix remains separate', () => {
  const result = referenceReview(align('Start with the statement, then continue quietly.', 'Start the statement,'), false);
  assert.deepEqual(result.attempted.filter(item => item.tone === 'missed').map(item => item.text), ['with']);
  assert.equal(result.remaining, 'then continue quietly.');
  assert.equal(result.remainingItems, 4);
  assert.equal(result.remainingWords, 3);
});

test('inline extras use scorer positions and preserve punctuation spacing', () => {
  const typed = 'New text Alpha beta!! gamma delta. end extra';
  const review = referenceReview(align('Alpha beta gamma delta.', typed), true);
  assert.equal(review.attempted.map(item => item.text).join(''), typed);
  assert.deepEqual(review.attempted.filter(item => item.tone === 'extra').map(item => item.text),
    ['New', 'text', '!!', 'end', 'extra']);
});

test('substitutions retain expected and actual including case and punctuation', () => {
  const result = referenceReview(align('Alpha ready, bravo.', 'alpha ready; bravo.'), true);
  assert.deepEqual(result.attempted.filter(item => item.tone === 'wrong'), [
    { tone: 'wrong', text: 'Alpha', actual: 'alpha' },
    { tone: 'wrong', text: ',', actual: ';' },
  ]);
});

test('empty, partial final words, repeated words and normalized Unicode reconcile', () => {
  const source = 'Cafe\u0301  ready,\nready again.';
  for (const typed of ['', 'Café ready, rea', 'Wrong words', 'Café ready, ready again. extra']) {
    const alignment = align(source, typed);
    const result = referenceReview(alignment, false);
    const skipped = result.attempted.filter(item => item.tone === 'missed').length;
    const extras = result.attempted.filter(item => item.tone === 'extra').length;
    const { correct, incorrect, total } = alignment.items;
    assert.equal(correct + incorrect + skipped + result.remainingItems, total);
    assert.equal(correct + incorrect + extras, alignment.typedTokens.length);
    if (!typed) assert.equal(result.attempted.length, 0);
    if (typed.endsWith('extra')) {
      assert.equal(result.remainingItems, 0);
      assert.equal(result.attempted.at(-1).text, 'extra');
    }
  }
});

test('full dictation review retains all omissions and historical coverage remains character-based', () => {
  const alignment = align('The record shows the entire account.', 'The record');
  const result = referenceReview(alignment, true);
  assert.equal(result.remainingItems, 0);
  assert.equal(result.attempted.map(item => item.text).join(''), alignment.reference);
  assert.ok(result.attempted.some(item => item.tone === 'missed'));
  const score = scoreFromAlignment(alignment, 30_000);
  assert.equal(score.completion, Math.floor(100 * (alignment.refLength - alignment.deletions) / alignment.refLength));
  assert.notEqual(score.completion, Math.floor(100 * (alignment.items.correct + alignment.items.incorrect) / alignment.items.total));
});


test('review reach and existing accuracy accounting stay explicit for an ambiguous trailing extra', () => {
  const alignment = align('beta , gamma alpha delta', 'delta alpha alpha ,');
  const review = referenceReview(alignment, false);
  assert.equal(review.remaining, 'delta');
  assert.equal(review.remainingItems, 1);
  assert.equal(review.attempted.at(-1).tone, 'extra');
  assert.equal(alignment.evaluatedItems, 6);
  assert.equal(review.evaluatedTailOmissions, 1);
});


test('a wholly incorrect passage exposes each pair without duplicating text in the passage', () => {
  const reference = Array.from({ length: 80 }, (_, index) => `expected${index}`).join(' ');
  const typed = Array.from({ length: 80 }, (_, index) => `actual${index}`).join(' ');
  const review = referenceReview(align(reference, typed), true);
  assert.equal(review.attempted.map(item => item.text).join(''), reference);
  const wrong = review.attempted.filter(item => item.tone === 'wrong');
  assert.equal(wrong.length, 80);
  assert.equal(wrong.map(item => item.actual).join(' '), typed);
});

test('partial words, repeated words and punctuation follow version-one alignment', () => {
  const samples = [
    ['alpha beta gamma', 'alpha be', 1, 2, [], ['gamma'], []],
    ['alpha beta beta gamma', 'alpha beta gamma', 3, 4, ['beta'], [], []],
    ['alpha beta.', 'alpha beta', 2, 3, ['.'], [], []],
    ['alpha beta gamma', 'alpha beta gamma !', 3, 4, [], [], ['!']],
  ];
  for (const [ref, typed, correct, evaluated, skipped, remaining, extra] of samples) {
    const alignment = align(ref, typed);
    const view = referenceReview(alignment, false);
    assert.equal(alignment.items.correct, correct);
    assert.equal(alignment.evaluatedItems, evaluated);
    assert.deepEqual(view.attempted.filter(item => item.tone === 'missed').map(item => item.text), skipped);
    assert.deepEqual(tokenizeScored(view.remaining).map(item => item.text), remaining);
    assert.deepEqual(view.attempted.filter(item => item.tone === 'extra').map(item => item.text), extra);
  }
});

test('version-one tokenization remains ASCII-oriented for historical comparability', () => {
  const cases = [
    ['café', [['caf', 'word'], ['é', 'punct']]],
    ['cafe\u0301', [['cafe', 'word'], ['\u0301', 'punct']]],
    ["O'Neill O’Neill Smith-Jones", [
      ["O'Neill", 'word'], ['O', 'word'], ['’', 'punct'], ['Neill', 'word'], ['Smith-Jones', 'word'],
    ]],
    ['3.14 U.S.', [
      ['3', 'word'], ['.', 'punct'], ['14', 'word'], ['U', 'word'], ['.', 'punct'], ['S', 'word'], ['.', 'punct'],
    ]],
    ['नमस्ते 世界 🙂', [['नमस्ते', 'punct'], ['世界', 'punct'], ['🙂', 'punct']]],
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(tokenizeScored(input).map(({ text, kind }) => [text, kind]), expected);
  }
});
