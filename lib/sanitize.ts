/**
 * Paste sanitiser for the student typing engine.
 *
 * Enforces the rule that only plain English may be pasted into
 * the typing input. We keep ASCII letters, digits, common
 * punctuation, and whitespace. Anything else (other scripts,
 * emoji, control characters, smart quotes) is replaced with
 * a space or the nearest ASCII equivalent.
 *
 * Important: ALL whitespace (newlines, tabs, CR, non-breaking
 * spaces) is normalised to a single space. The typing engine
 * only accepts single spaces, so keeping newlines in the
 * reference would make custom passages impossible to type
 * accurately.
 */

const ASCII_PUNCTUATION: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
  '\u2013': '-', '\u2014': '-', '\u2026': '...',
  '\u00A0': ' ', '\u2009': ' ', '\u200B': '', '\u200C': '', '\u200D': '',
  '\uFEFF': '',
};

export function sanitizeForTyping(s: string): string {
  return s
    .split('')
    .map((ch) => {
      // Common smart-quote / dash replacements
      if (ch in ASCII_PUNCTUATION) return ASCII_PUNCTUATION[ch];
      // Normalise every kind of line break / tab to a space
      if (ch === '\n' || ch === '\r' || ch === '\t' || ch === '\v' || ch === '\f') {
        return ' ';
      }
      // Allow ASCII printable + space
      const code = ch.charCodeAt(0);
      if (code <= 0x7e) return ch;
      if (ch === ' ' || ch === '\u00A0') return ' ';
      // Drop anything else (non-English scripts, emoji, control chars)
      return '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
