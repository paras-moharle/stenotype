/**
 * Passage generator — produces natural-sounding English
 * passages on demand so the typing page never has to bundle
 * a hardcoded list.
 *
 * The generator uses a small but rich vocabulary grouped by
 * domain (legal, professional, general). It assembles
 * sentences from subject-verb-object templates that draw
 * from the vocabulary of the requested category. The result
 * is deterministic for a given seed but produces different
 * passages for different sessions.
 *
 * Determinism matters because the typing engine needs a
 * fixed passage for the duration of a session, but the user
 * should never see the exact same passage twice in a row.
 */

import { type DictationCategory } from './schemas';

/* ─── Vocabulary pools ───────────────────────────────────── */

const subjects = {
  Legal: [
    'the court',
    'the judge',
    'counsel for the defence',
    'the prosecution',
    'the witness',
    'the jury',
    'the defendant',
    'the plaintiff',
    'the tribunal',
    'the registrar',
  ],
  Professional: [
    'the director',
    'the committee',
    'the board',
    'the manager',
    'the team',
    'the department',
    'the chairperson',
    'the executive',
    'the consultant',
    'the coordinator',
  ],
  General: [
    'the traveller',
    'the resident',
    'the visitor',
    'the family',
    'the volunteer',
    'the organiser',
    'the narrator',
    'the observer',
    'the participant',
    'the editor',
  ],
} as const;

const verbs = {
  Legal: [
    'shall examine',
    'will review',
    'is required to consider',
    'has been asked to clarify',
    'will proceed to hear',
    'is expected to deliver',
    'must determine',
    'has decided to grant',
    'will direct counsel to file',
    'intends to revisit',
  ],
  Professional: [
    'will review',
    'has prepared',
    'is expected to deliver',
    'will present',
    'has been asked to confirm',
    'is required to submit',
    'will coordinate with',
    'has recommended',
    'will circulate',
    'has approved',
  ],
  General: [
    'noticed',
    'considered',
    'observed',
    'mentioned',
    'described',
    'recalled',
    'revisited',
    'photographed',
    'sketched',
    'documented',
  ],
} as const;

const objects = {
  Legal: [
    'the affidavit submitted by counsel',
    'the evidence presented during the hearing',
    'the terms of the settlement',
    'the objections raised by the defence',
    'the precedents cited in the brief',
    'the application for adjournment',
    'the witness statement on record',
    'the findings of the lower court',
    'the procedural history of the case',
    'the submissions made at trial',
  ],
  Professional: [
    'the quarterly report',
    'the proposed amendments',
    'the budget for the next cycle',
    'the timeline for the rollout',
    'the draft of the agreement',
    'the agenda for the meeting',
    'the recommendations of the panel',
    'the minutes of the previous session',
    'the proposal circulated yesterday',
    'the client feedback summary',
  ],
  General: [
    'the narrow path along the river',
    'the small chapel at the edge of the village',
    'the weather-beaten sign near the trail',
    'the wide balcony overlooking the square',
    'the abandoned workshop behind the station',
    'the dusty bookshelf in the reading room',
    'the stone bench beneath the cedar tree',
    'the bright curtains in the upstairs window',
    'the freshly painted door on the corner',
    'the quiet courtyard at the heart of the town',
  ],
} as const;

const openers = [
  'In the matter of the matter under review, ',
  'According to the records submitted, ',
  'Following the discussion held earlier, ',
  'In accordance with the established procedure, ',
  'After careful consideration of the facts, ',
  'In light of the evidence available, ',
  'Based on the testimony provided, ',
  'As recorded in the official minutes, ',
];

const closers = [
  ' before the matter is concluded.',
  ' and shall report back at the next session.',
  ' without further delay or objection.',
  ' and the record shall reflect the same accordingly.',
  ' for the consideration of all concerned parties.',
  ' in keeping with the established practice.',
  ' and a written confirmation will follow shortly.',
  ' with copies to be circulated to the relevant parties.',
];

/* ─── Deterministic seeded random ────────────────────────── */
/**
 * Mulberry32 — a tiny seeded PRNG. Same seed → same passage,
 * which is exactly what we need to keep a session stable
 * while still varying between sessions.
 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(arr: readonly T[], rand: () => number): T =>
  arr[Math.floor(rand() * arr.length)];

const sentenceFor = (category: DictationCategory, rand: () => number): string => {
  const s = pick(subjects[category], rand);
  const v = pick(verbs[category], rand);
  const o = pick(objects[category], rand);
  const opener = rand() < 0.4 ? pick(openers, rand) : '';
  const closer = pick(closers, rand);
  // Capitalise the first letter after the opener if present.
  const core = `${s} ${v} ${o}`;
  const capitalised = opener
    ? opener + core.charAt(0).toUpperCase() + core.slice(1)
    : core.charAt(0).toUpperCase() + core.slice(1);
  return capitalised + closer;
};

/* ─── Public API ─────────────────────────────────────────── */

export type GenerateOptions = {
  /** Number of sentences to produce. Default 4. */
  sentences?: number;
  /**
   * Approximate target character length. If provided, more
   * sentences are added until the assembled passage is at
   * least this long. Useful when you want a passage to
   * roughly fit one screen (e.g. 450 chars) rather than
   * guessing by sentence count.
   */
  targetChars?: number;
  /** Category bias. The engine can mix categories for variety. */
  category?: DictationCategory | 'mixed';
  /**
   * Optional numeric seed. Same seed → same passage.
   * If omitted, a seed is derived from the current time
   * so sessions are stable for their duration but vary
   * between sessions.
   */
  seed?: number;
};

const seedFromTime = (): number =>
  (Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0xffffffff);

/**
 * Generate a single passage suitable for a typing session.
 *
 * Usage:
 *   generatePassage()                            // 4 sentences, mixed
 *   generatePassage({ category: 'Legal', sentences: 5 })
 *   generatePassage({ targetChars: 450 })        // sized to fit a screen
 *   generatePassage({ seed: 1234 })              // reproducible
 */
export function generatePassage(opts: GenerateOptions = {}): string {
  const { sentences = 4, category = 'mixed', seed, targetChars } = opts;
  const rand = mulberry32(seed ?? seedFromTime());
  const cats: DictationCategory[] =
    category === 'mixed' ? ['Legal', 'Professional', 'General'] : [category];

  const out: string[] = [];
  const minSentences = targetChars ? Math.max(sentences, 2) : sentences;
  const maxSentences = 12;
  for (let i = 0; i < maxSentences; i++) {
    const cat = cats[i % cats.length];
    out.push(sentenceFor(cat, rand));
    if (i + 1 >= minSentences) {
      const joined = out.join(' ');
      if (!targetChars || joined.length >= targetChars) {
        return joined;
      }
    }
  }
  return out.join(' ');
}

/**
 * Generate a stable seed that differs from the previous one.
 * Used to pick a new passage for each session while avoiding
 * immediate repeats.
 */
export function nextSeed(previous?: number): number {
  let s = seedFromTime();
  // Try a few times to avoid the same seed twice in a row.
  for (let i = 0; i < 5 && previous !== undefined && s === previous; i++) {
    s = seedFromTime();
  }
  return s;
}

/**
 * Estimate the typing duration a passage will support.
 * Average adult typing speed is ~40 wpm, so a passage
 * with N words lasts roughly N / 40 minutes.
 * Returns the recommended duration in seconds.
 */
export function recommendDuration(passage: string): 15 | 30 | 60 {
  const words = passage.trim().split(/\s+/).length;
  // Aim for the passage to last ~60% of the chosen duration.
  if (words < 35) return 15;
  if (words < 80) return 30;
  return 60;
}
