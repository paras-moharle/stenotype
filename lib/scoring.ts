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
 * Compute the full score for a typing attempt.
 *
 * @param passage  The reference passage the user is trying to type.
 * @param typed    The exact string the user has typed so far.
 * @param elapsedMs  Wall-clock time in ms since the user started typing.
 *                   Use 0 to compute "live" WPM (which returns 0).
 */
/**
 * Compute the full score for a typing attempt using the standard
 * 5-characters-per-word convention (Monkeytype, keybr, etc.).
 *
 *   - Gross (Raw) WPM  = Total Typed Characters / 5 / Minutes
 *   - Net WPM          = Correct Characters / 5 / Minutes
 *   - Accuracy (%)     = Correct Characters / Total Typed Characters × 100
 *
 * Errors never cascade: each character is judged independently against
 * the passage at the same position.
 */
export function computeScore(
  passage: string,
  typed: string,
  elapsedMs: number
): ScoreResult {
  const len = Math.min(typed.length, passage.length);
  let correct = 0;
  for (let i = 0; i < len; i++) {
    if (typed[i] === passage[i]) correct++;
  }

  const totalTyped = typed.length;
  const incorrect = totalTyped - correct;

  const accuracy =
    totalTyped === 0 ? 100 : Math.round((correct / totalTyped) * 100);

  const minutes = safeMinutes(elapsedMs);
  const wpm = minutes > 0 ? Math.round(correct / 5 / minutes) : 0;
  const rawWpm =
    minutes > 0 ? Math.round(totalTyped / 5 / minutes) : 0;

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
 * Update the typed-string when a single new character is added.
 * Validates against the passage and enforces the "no typing past
 * the end" rule.
 */
export function applyKeypress(
  passage: string,
  previous: string,
  nextChar: string
): string {
  if (previous.length >= passage.length) return previous;
  // Reject control characters (e.g. paste of newlines, tabs).
  if (nextChar === '' || nextChar === '\n' || nextChar === '\t') {
    return previous;
  }
  return previous + nextChar;
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

/**
 * Replace a paste. This is the smart paste used for the
 * "paste your own passage" feature (class-only / future).
 *
 * Returns the *correct* typed-string that should result from
 * pasting `pasted`, where the user effectively "types" the
 * pasted content character-by-character. The engine then
 * measures accuracy against the actual reference passage.
 *
 * Why not just accept the pasted string verbatim?
 * Because every character is still validated against the
 * passage — pasting doesn't bypass per-character checking.
 */
export function applyPaste(
  passage: string,
  previous: string,
  pasted: string
): string {
  // Normalise the paste: strip newlines, tabs, and other
  // whitespace that the user couldn't have typed normally.
  const cleaned = pasted.replace(/[\r\n\t]+/g, ' ');
  const remaining = passage.length - previous.length;
  if (remaining <= 0) return previous;
  return previous + cleaned.slice(0, remaining);
}
