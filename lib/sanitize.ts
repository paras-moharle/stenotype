/**
 * Paste sanitiser for the student typing engine.
 *
 * The typing engine only knows plain ASCII words and single spaces, so a
 * pasted passage must be converted before it becomes a reference. The
 * rules are deliberately conservative — a character is either
 * transliterated to something a keyboard can produce, or turned into a
 * word break. It is never silently deleted in the middle of a word.
 *
 * Rules:
 *   - The string is NFC-normalised first, so decomposed accents
 *     (e + combining acute) behave exactly like precomposed ones.
 *   - Smart quotes, dashes, ellipsis and apostrophe variants map to ASCII.
 *   - Latin letters without a canonical decomposition (ø, æ, ß, ł, …) and
 *     ligatures (ﬁ, ﬂ, …) transliterate explicitly.
 *   - Precomposed accents transliterate through NFD (café -> cafe).
 *   - Non-breaking / thin / ideographic spaces become a normal space.
 *   - Zero-width space is a word separator; joiners and BOM are removed.
 *   - Newlines, tabs and other control characters become a single space.
 *   - Anything with no ASCII equivalent (emoji, CJK, …) becomes a space.
 *   - Runs of whitespace collapse; leading/trailing whitespace is trimmed.
 */

const CHAR_MAP: Record<string, string> = {
  // Quotes and apostrophes
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u201F': '"',
  '\u2032': "'", '\u2033': '"', '\u02BC': "'", '\uFF07': "'",
  '\u00AB': '"', '\u00BB': '"',

  // Dashes and minus
  '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2013': '-',
  '\u2014': '-', '\u2015': '-', '\u2212': '-', '\u2043': '-',

  // Ellipsis
  '\u2026': '...',

  // Spaces that are not U+0020
  '\u00A0': ' ', '\u2000': ' ', '\u2001': ' ', '\u2002': ' ',
  '\u2003': ' ', '\u2004': ' ', '\u2005': ' ', '\u2006': ' ',
  '\u2007': ' ', '\u2008': ' ', '\u2009': ' ', '\u200A': ' ',
  '\u202F': ' ', '\u205F': ' ', '\u3000': ' ',

  // Zero-width space is a separator; the rest are invisible joins.
  '\u200B': ' ', '\u200C': '', '\u200D': '', '\uFEFF': '',
  '\u00AD': '', '\u2060': '',

  // Latin letters without a canonical decomposition
  '\u00F8': 'o', '\u00D8': 'O', '\u00E6': 'ae', '\u00C6': 'AE',
  '\u0153': 'oe', '\u0152': 'OE', '\u00DF': 'ss', '\u1E9E': 'SS',
  '\u0142': 'l', '\u0141': 'L', '\u0111': 'd', '\u0110': 'D',
  '\u00F0': 'd', '\u00D0': 'D', '\u00FE': 'th', '\u00DE': 'Th',
  '\u0131': 'i', '\u0130': 'I', '\u014B': 'ng', '\u014A': 'Ng',
  '\u0127': 'h', '\u0126': 'H',

  // Ligatures
  '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl',
  '\uFB03': 'ffi', '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st',

  // Fractions that appear in pasted text
  '\u00BD': '1/2', '\u00BC': '1/4', '\u00BE': '3/4',
  '\u2153': '1/3', '\u2154': '2/3',
};

function isCombiningMark(code: number): boolean {
  return code >= 0x0300 && code <= 0x036f;
}

/**
 * Precomposed Latin letters with a canonical NFD decomposition
 * (é, ñ, ü …) collapse to their ASCII base.
 */
function toAsciiBase(ch: string): string | null {
  const decomposed = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (decomposed.length === 1 && decomposed.charCodeAt(0) <= 0x7e) {
    return decomposed;
  }
  return null;
}

export function sanitizeForTyping(input: string): string {
  // NFC first: "e + combining acute" and "é" must behave the same.
  const s = input.normalize('NFC');
  const out: string[] = [];

  // Array.from iterates code points, so surrogate pairs (emoji) stay
  // together instead of splitting into two halves.
  for (const ch of Array.from(s)) {
    const mapped = CHAR_MAP[ch];
    if (mapped !== undefined) {
      out.push(mapped);
      continue;
    }

    const code = ch.codePointAt(0) ?? 0;

    // Combining marks left over after NFC are dropped, not spaced.
    if (isCombiningMark(code)) continue;

    // ASCII printable + space pass through.
    if (code >= 0x20 && code <= 0x7e) {
      out.push(ch);
      continue;
    }

    // Control characters, tabs, newlines, DEL -> word break.
    if (code < 0x20 || code === 0x7f) {
      out.push(' ');
      continue;
    }

    // Latin accents (café -> cafe); anything else becomes a word break.
    out.push(toAsciiBase(ch) ?? ' ');
  }

  return out.join('').replace(/\s+/g, ' ').trim();
}
