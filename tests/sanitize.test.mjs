import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeForTyping } from '../lib/sanitize.ts';

/*
 * Custom paste goes through this. It must turn real-world pasted text
 * into something a keyboard can produce, without joining or splitting
 * words unexpectedly.
 */

const asciiOnly = (s) => /^[\x20-\x7e]*$/.test(s);

test('smart quotes, dashes and ellipsis become ASCII', () => {
  assert.equal(
    sanitizeForTyping('“Hello” — it’s fine…'),
    '"Hello" - it\'s fine...'
  );
  assert.equal(sanitizeForTyping('‘a’ ‚b‘ ‛c‛'), "'a' 'b' 'c'");
  assert.equal(sanitizeForTyping('word–word'), 'word-word');
});

test('hyphen and minus variants are kept inside words', () => {
  for (const hyphen of ['\u2010', '\u2011', '\u2012', '\u2015', '\u2212']) {
    assert.equal(
      sanitizeForTyping(`state${hyphen}of${hyphen}the${hyphen}art`),
      'state-of-the-art'
    );
  }
});

test('apostrophe variants keep contractions whole', () => {
  assert.equal(sanitizeForTyping('don\u02BCt stop'), "don't stop");
  assert.equal(sanitizeForTyping('don\uFF07t stop'), "don't stop");
});

test('precomposed and decomposed accents both transliterate', () => {
  assert.equal(sanitizeForTyping('café déjà vu'), 'cafe deja vu');
  assert.equal(sanitizeForTyping('cafe\u0301 de\u0301ja\u0300 vu'), 'cafe deja vu');
  assert.equal(sanitizeForTyping('man\u0303ana'), 'manana');
});

test('letters without a decomposition transliterate explicitly', () => {
  assert.equal(sanitizeForTyping('Søren'), 'Soren');
  assert.equal(sanitizeForTyping('encyclopædia'), 'encyclopaedia');
  assert.equal(sanitizeForTyping('cœur'), 'coeur');
  assert.equal(sanitizeForTyping('Straße'), 'Strasse');
  assert.equal(sanitizeForTyping('Wałęsa'), 'Walesa');
  assert.equal(sanitizeForTyping('kırmızı'), 'kirmizi');
  assert.equal(sanitizeForTyping('þing'), 'thing');
});

test('ligatures expand instead of disappearing', () => {
  assert.equal(sanitizeForTyping('oﬃce ﬂoor'), 'office floor');
  assert.equal(sanitizeForTyping('1½ cups'), '11/2 cups');
});

test('zero-width space separates, joiners are removed', () => {
  assert.equal(sanitizeForTyping('hello\u200Bworld'), 'hello world');
  assert.equal(sanitizeForTyping('hel\u200Clo'), 'hello');
  assert.equal(sanitizeForTyping('hel\uFEFFlo'), 'hello');
});

test('all whitespace and control characters become one space', () => {
  assert.equal(sanitizeForTyping('a\tb\nc\r\nd\ve\ff'), 'a b c d e f');
  assert.equal(sanitizeForTyping('a\u00A0b\u2009c\u3000d'), 'a b c d');
  assert.equal(sanitizeForTyping('  a   b  '), 'a b');
});

test('unsupported scripts and emoji become word breaks', () => {
  assert.equal(sanitizeForTyping('hello 世界 world'), 'hello world');
  assert.equal(sanitizeForTyping('👨‍👩‍👧 family'), 'family');
});

test('output is always ASCII printable and idempotent', () => {
  const samples = [
    '“Smart” — text…',
    'café Søren Straße',
    'a\tb\n',
    '👨‍👩‍👧 世界',
    'don\u02BCt',
  ];
  for (const sample of samples) {
    const once = sanitizeForTyping(sample);
    assert.ok(asciiOnly(once), `not ASCII: ${JSON.stringify(once)}`);
    assert.equal(sanitizeForTyping(once), once);
  }
});
