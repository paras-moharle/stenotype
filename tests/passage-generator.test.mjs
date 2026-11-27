import assert from 'node:assert/strict';
import test from 'node:test';
import { passages as legal } from '../lib/passages/legal.ts';
import { passages as professional } from '../lib/passages/professional.ts';
import { passages as general } from '../lib/passages/general.ts';
import { generatePassage, practiceReference, readPassageHistory, rememberPassage, seededRandom, selectPassage, timedCharacters } from '../lib/passage-generator.ts';
import { sanitizeForTyping } from '../lib/sanitize.ts';
import { MAX_ALIGN_CELLS } from '../lib/typing/scoring.ts';

const banks = { Legal: legal, Professional: professional, General: general };
const all = Object.values(banks).flat();

test('curated content has unique identifiers, typeable text and accurate metadata', () => {
  assert.equal(new Set(all.map(p => p.id)).size, all.length);
  assert.equal(new Set(all.map(p => p.text.toLowerCase())).size, all.length);
  for (const [category, bank] of Object.entries(banks)) {
    assert.equal(bank.length, 22);
    for (const item of bank) {
      const { text } = item;
      assert.equal(item.category, category);
      assert.match(item.id, /^(legal|professional|general):[a-z-]+$/);
      assert.match(text, /^[A-Za-z0-9 .,!?;:'"()-]+[.!?]$/);
      assert.equal(text, sanitizeForTyping(text));
      assert.equal(item.wordCount, text.split(/\s+/).length);
      assert.equal(item.characterCount, text.length);
      assert.ok((item.characterCount + 41) ** 2 < MAX_ALIGN_CELLS);
      assert.ok(item.sentenceCount >= 3 && item.punctuationDensity > 0);
    }
    assert.equal(bank.filter(p => p.characterCount >= 1200).length, 3);
    assert.ok(bank.filter(p => p.wordCount >= 90 && p.wordCount < 180).length >= 2);
  }
  for (const difficulty of ['Easy', 'Standard', 'Advanced']) assert.ok(all.some(p => p.difficulty === difficulty));
});

test('lexical near-duplicate screen across the entire bank', () => {
  const sets = all.map(p => new Set(p.text.toLowerCase().match(/[a-z]+/g)));
  for (let i = 0; i < sets.length; i++) for (let j = 0; j < i; j++) {
    const overlap = [...sets[i]].filter(token => sets[j].has(token)).length;
    assert.ok(overlap / (sets[i].size + sets[j].size - overlap) < .55, `${all[i].id} and ${all[j].id}`);
  }
});

test('timer budgets use normalized characters and excerpts stop at a sentence end', async () => {
  for (const category of Object.keys(banks)) for (const seconds of [15, 30, 60]) {
    for (let seed = 1; seed <= 20; seed++) {
      const item = await generatePassage({ category, seconds, seed });
      const excerpt = practiceReference(item.text, 'full', seconds);
      assert.equal(item.category, category);
      assert.ok(excerpt.length >= timedCharacters(seconds));
      assert.ok(item.text.startsWith(excerpt));
      assert.match(excerpt, /[.!?]$/);
      assert.equal(practiceReference(item.text, 'short'), item.text.split(' ').slice(0, 30).join(' '));
      assert.equal(practiceReference(item.text, 'full', seconds), excerpt);
      assert.equal(practiceReference(item.text, 'full'), item.text);
    }
  }
});

test('seeded selection reproduces and bounded history rotates small or exhausted pools', async () => {
  assert.deepEqual(await generatePassage({ seed: -3 }), await generatePassage({ seed: -3 }));
  await assert.rejects(generatePassage({ seed: NaN }), RangeError);
  await assert.rejects(generatePassage({category: 'unknown'}), RangeError);
  const pool = legal.slice(0, 2);
  assert.equal(selectPassage(pool, { history: pool.map(p => p.id) }).id, pool[1].id);
  assert.equal(selectPassage(pool.slice(0, 1), { previousId: pool[0].id }).id, pool[0].id);
  assert.throws(() => selectPassage(pool, { seconds: 1000 }));
  const draws = new Set();
  const random = seededRandom(12);
  for (let i = 0; i < 3000; i++) draws.add(selectPassage(legal, { random }).id);
  assert.equal(draws.size, legal.length);
});

test('mixed draws balance categories and avoid repeats even after re-reading storage', async () => {
  let backing = 'malformed json';
  const storage = { getItem: () => backing, setItem: (_, value) => { backing = value; } };
  assert.deepEqual(readPassageHistory(storage), []);
  const counts = { Legal: 0, Professional: 0, General: 0 };
  let previousId;
  for (let seed = 0; seed < 3000; seed++) {
    const history = readPassageHistory(storage);
    const item = await generatePassage({ history, previousId, seconds: 60, seed });
    assert.notEqual(item.id, previousId);
    counts[item.category]++;
    rememberPassage(item.id, history, storage);
    assert.ok(readPassageHistory(storage).length <= 18);
    previousId = item.id;
  }
  assert.deepEqual(Object.values(counts), [1000, 1000, 1000]);
  assert.deepEqual(readPassageHistory({ getItem() { throw Error(); } }), []);
});
