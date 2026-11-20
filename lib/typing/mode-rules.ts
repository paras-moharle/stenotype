/**
 * Mode rules — which reference text a typing surface may rely on.
 *
 * Dictation mode deliberately never receives the reference before the
 * attempt is scored: the student listens to the audio (or types from
 * shorthand) and the server compares afterwards. Every other mode has
 * the reference up-front.
 *
 * The input gate used to be tied to `reference.length > 0`, which made
 * dictation mode impossible to start: with no transcript there was no
 * input, so nothing could ever reach the server to fetch the
 * transcript. These rules decouple "can I type?" from "do I have text
 * to display?" and keep that distinction unit-testable.
 *
 * Framework-free on purpose — see tests/mode-rules.test.mjs.
 */

export type TypingMode = 'free' | 'dictation' | 'custom';

/** Extra characters a typist may add past the end of the reference. */
export const MAX_EXTRA_CHARS = 40;

export type InputAvailability = {
  mode: TypingMode;
  /** Length of the reference currently held on the client. */
  referenceLength: number;
  /** Selected dictation id — dictation cannot start without a target. */
  dictationId?: string | null;
};

/**
 * True when the surface may accept keystrokes at all.
 *
 * Dictation needs a selected dictation (the server scores it from the
 * id), not a local reference. Other modes need the reference itself.
 */
export function acceptsInput({
  mode,
  referenceLength,
  dictationId,
}: InputAvailability): boolean {
  if (mode === 'dictation') return Boolean(dictationId);
  return referenceLength > 0;
}

/**
 * Auto-finish on an exact text match is only safe when the reference
 * is local. Dictation must finish on submit/timer instead, otherwise
 * it could never finish (there is nothing to match against).
 */
export function usesAnchoredAutoFinish(
  mode: TypingMode,
  referenceLength: number
): boolean {
  return mode !== 'dictation' && referenceLength > 0;
}

/**
 * Hard cap on typed characters for the current reference.
 *
 * Without a local reference (dictation before scoring) the only cap is
 * the engine's MAX_ALIGN_CHARS, so holding a key cannot produce an
 * unscoreable payload.
 */
export function typedCharCap(
  referenceLength: number,
  maxAlignChars: number
): number {
  if (referenceLength <= 0) return maxAlignChars;
  return Math.min(referenceLength + MAX_EXTRA_CHARS, maxAlignChars);
}

/**
 * Whether finishing the run should be recorded.
 *
 * Product rule: ONLY dictation results are stored. Free practice and
 * custom text are local-only, even for a signed-in student, so this is
 * deliberately narrower than `acceptsInput` — it is not about whether
 * the mode can be typed, but whether its result may be persisted.
 */
export function persistsAttempt({
  mode,
  dictationId,
}: Pick<InputAvailability, 'mode' | 'dictationId'>): boolean {
  return mode === 'dictation' && Boolean(dictationId);
}
