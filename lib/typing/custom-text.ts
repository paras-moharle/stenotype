/**
 * Custom-text validation — one rule set, one implementation.
 *
 * The paste dialog and the "apply" handler used to duplicate the same
 * three checks (sanitize, max length, minimum words). They now both go
 * through `inspectCustomText`, so the button state and the applied text
 * can never disagree.
 *
 * Note: custom text is never persisted — this only gates local practice.
 */

import { sanitizeForTyping } from '../sanitize';
import { countScoredWords, MAX_CUSTOM_CHARS } from './scoring';

/** Minimum scored words before a custom passage can start. */
export const MIN_CUSTOM_WORDS = 10;

export type CustomTextCheck = {
  /** Sanitized text that would be used if acceptable. */
  text: string;
  /** Scored word count of the sanitized text. */
  words: number;
  chars: number;
  tooLong: boolean;
  tooShort: boolean;
  ok: boolean;
};

export function inspectCustomText(input: string): CustomTextCheck {
  const text = sanitizeForTyping(input);
  const words = countScoredWords(text);
  const tooLong = text.length > MAX_CUSTOM_CHARS;
  const tooShort = words < MIN_CUSTOM_WORDS;

  return {
    text,
    words,
    chars: text.length,
    tooLong,
    tooShort,
    ok: !tooLong && !tooShort,
  };
}
