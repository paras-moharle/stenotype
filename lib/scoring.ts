/**
 * Typing scoring — pure, deterministic, backend-ready.
 *
 * These functions are the single source of truth for how
 * WPM, accuracy, and error counts are calculated. They are
 * intentionally framework-free so that:
 *
 *   - the client (typing page) can call them in real time
 *     to update the live UI
 *   - the server (API route) can call them when a session
 *     is submitted to validate the client's reported numbers
 *     and prevent tampering
 *   - unit tests can call them without a DOM or a database
 *
 * The implementation follows the conventions used by every
 * mainstream typing test (Monkeytype, keybr, etc.):
 *
 *   - 1 word = 5 characters (including spaces)
 *   - WPM uses *correct* characters, not all typed characters
 *   - Accuracy = correct / typed × 100
 *   - An "error" is any position where typed[i] !== passage[i]
 *     for i < typed.length
 *   - Backspace removes both the character AND the error mark
 *     at that position
 */

export type CharacterState = 'untyped' | 'correct' | 'incorrect' | 'current';

export type CharacterMap = CharacterState[];

export type ScoreResult = {
  /** Total characters typed (including incorrect ones). */
  typed: number;
  /** Number of characters that match the passage exactly. */
  correct: number;
  /** Number of characters that do not match the passage. */
  incorrect: number;
  /** correct / typed × 100, rounded. Returns 100 if typed === 0. */
  accuracy: number;
  /** Words per minute, using correct characters / 5. */
  wpm: number;
  /** Net correct words per minute (WPM minus uncorrected errors). */
  rawWpm: number;
  /** Time elapsed in milliseconds. */
  elapsedMs: number;
};

const MS_PER_MINUTE = 60_000;

const safeMinutes = (elapsedMs: number): number => {
  if (elapsedMs <= 0) return 0;
  return elapsedMs / MS_PER_MINUTE;
};

/**
 * Compute the full score for a typing attempt using the standard
 * 5-characters-per-word convention (Monkeytype, keybr, etc.).
 *
 *   - Gross (Raw) WPM  = Total Typed Characters / 5 / Minutes
 *   - Net WPM          = Correct Characters / 5 / Minutes
 *   - Accuracy (%)     = Correct Characters / Total Typed Characters × 100
 *
 * Scoring is word-aligned: typed words are aligned to reference words
 * via sequence alignment, so a skip / extra character / 1-letter typo in
 * one word never shifts the rest of the passage. Errors never cascade.
 */
function tokenizeWords(input: string): string[] {
  return input.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Word-level sequence alignment (LCS) between reference words and the
 * words the student actually typed. Returns index pairs
 * [referenceWordIndex, typedWordIndex].
 */
function alignWordPairs(
  refWords: string[],
  typedWords: string[]
): Array<[number, number]> {
  const n = refWords.length;
  const m = typedWords.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        refWords[i] === typedWords[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (refWords[i] === typedWords[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

/**
 * Count how many reference words the student typed correctly.
 * Uses the same word-level alignment as computeScore so a skip or
 * typo never shifts later words into being "wrong".
 */
export function countCorrectWords(passage: string, typed: string): number {
  const refWords = tokenizeWords(passage);
  const typedWords = tokenizeWords(typed);
  const pairs = alignWordPairs(refWords, typedWords);
  let correct = 0;
  for (const [ri, ti] of pairs) {
    const ref = refWords[ri];
    const t = typedWords[ti];
    const minLen = Math.min(ref.length, t.length);
    let ok = true;
    for (let k = 0; k < minLen; k += 1) {
      if (ref[k] !== t[k]) {
        ok = false;
        break;
      }
    }
    if (ok) correct += 1;
  }
  return correct;
}

export function computeScore(
  passage: string,
  typed: string,
  elapsedMs: number
): ScoreResult {
  const refWords = tokenizeWords(passage);
  const typedWords = tokenizeWords(typed);
  const pairs = alignWordPairs(refWords, typedWords);

  let correct = 0;
  let totalTyped = 0;
  const matchedTypedIdx = new Set<number>();

  for (const [ri, ti] of pairs) {
    const t = typedWords[ti];
    const ref = refWords[ri];
    const minLen = Math.min(ref.length, t.length);
    for (let k = 0; k < minLen; k += 1) {
      if (ref[k] === t[k]) correct += 1;
    }
    totalTyped += t.length;
    matchedTypedIdx.add(ti);
  }
  // Typed words that never aligned are off-target → count them as
  // typed-but-incorrect so accuracy can never get stuck at a false 100%.
  for (let i = 0; i < typedWords.length; i += 1) {
    if (!matchedTypedIdx.has(i)) {
      totalTyped += typedWords[i].length;
    }
  }

  const incorrect = Math.max(0, totalTyped - correct);
  const accuracy = totalTyped === 0 ? 100 : Math.round((correct / totalTyped) * 100);
  const minutes = safeMinutes(elapsedMs);
  const wpm = minutes > 0 ? Math.round(correct / 5 / minutes) : 0;
  const rawWpm = minutes > 0 ? Math.round(totalTyped / 5 / minutes) : 0;

  return {
    typed: totalTyped,
    correct,
    incorrect,
    accuracy,
    wpm,
    rawWpm,
    elapsedMs,
  };
}

/**
 * Build a per-character state array used to render the passage.
 *
 *   'untyped'   → ahead of the user's caret
 *   'current'   → exactly at the caret (only if the test is not complete)
 *   'correct'   → already typed, matches the passage
 *   'incorrect' → already typed, does not match the passage
 *
 * This is what powers the colour-coding on the typing page.
 */
export function buildCharacterMap(
  passage: string,
  typed: string,
  isComplete: boolean
): CharacterMap {
  const map: CharacterMap = [];
  for (let i = 0; i < passage.length; i++) {
    if (i < typed.length) {
      map.push(typed[i] === passage[i] ? 'correct' : 'incorrect');
    } else if (i === typed.length && !isComplete) {
      map.push('current');
    } else {
      map.push('untyped');
    }
  }
  return map;
}

/**
 * Update the typed-string when the user presses backspace.
 * Simply drops the last character — the character map will
 * automatically re-classify the truncated tail.
 */
export function applyBackspace(typed: string): string {
  if (typed.length === 0) return typed;
  return typed.slice(0, -1);
}
