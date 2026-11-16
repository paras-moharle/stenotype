/**
 * Paste sanitiser for the student typing engine.
 *
 * Enforces the rule that only plain English may be pasted into
 * the typing input. We keep ASCII letters, digits, common
 * punctuation, and whitespace. Anything else is replaced with
 * a space (never deleted, so words cannot join together) or
 * the nearest ASCII equivalent.
 *
 * Rules:
 *   - Smart quotes / dashes / ellipsis map to ASCII equivalents.
 *   - Latin accented letters transliterate to ASCII (café -> cafe)
 *     via NFD decomposition; other non-ASCII becomes a space.
 *   - Zero-width / BOM characters are deleted (invisible, must
 *     not split words).
 *   - ALL other whitespace (newlines, tabs, CR, non-breaking
 *     spaces) and control characters become a single space.
 *   - Runs of whitespace collapse to a single space.
 *
 * Important: the typing engine only accepts single spaces, so
 * keeping newlines in the reference would make custom passages
 * impossible to type accurately.
 */

const ASCII_PUNCTUATION: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
  '\u2013': '-', '\u2014': '-', '\u2026': '...',
  '\u00A0': ' ', '\u2009': ' ', '\u200B': '', '\u200C': '', '\u200D': '',
  '\uFEFF': '',
};

/** Invisible characters: delete without inserting a word break. */
const ZERO_WIDTH = new Set(['\u200B', '\u200C', '\u200D', '\uFEFF']);

/**
 * Transliterate a single non-ASCII character to ASCII if possible
 * (e.g. é -> e). Returns null when no ASCII base exists (emoji,
 * CJK, etc.), in which case the caller substitutes a space.
 */
function toAsciiBase(ch: string): string | null {
  const decomposed = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (decomposed.length === 1 && decomposed.charCodeAt(0) <= 0x7e) {
    return decomposed;
  }
  return null;
}

export function sanitizeForTyping(s: string): string {
  // Array.from iterates code points, so surrogate pairs (emoji)
  // stay together instead of splitting into two halves.
  const out: string[] = [];

  for (const ch of Array.from(s)) {
    // Common smart-quote / dash replacements
    if (ch in ASCII_PUNCTUATION) {
      out.push(ASCII_PUNCTUATION[ch]);
      continue;
    }

    if (ZERO_WIDTH.has(ch)) {
      continue;
    }

    // Normalise every kind of line break / tab to a space
    if (ch === '\n' || ch === '\r' || ch === '\t' || ch === '\v' || ch === '\f') {
      out.push(' ');
      continue;
    }

    const code = ch.codePointAt(0) ?? 0;

    // ASCII printable + space pass through. This excludes all
    // control characters (0x00-0x1f) and DEL (0x7f).
    if (code >= 0x20 && code <= 0x7e) {
      out.push(ch);
      continue;
    }

    // Control characters (including DEL) become a word break,
    // never a join.
    if (code < 0x20 || code === 0x7f) {
      out.push(' ');
      continue;
    }

    // Non-ASCII: transliterate Latin accents (café -> cafe),
    // otherwise substitute a space so words cannot join.
    const ascii = toAsciiBase(ch);
    out.push(ascii ?? ' ');
  }

  return out.join('').replace(/\s+/g, ' ').trim();
}
