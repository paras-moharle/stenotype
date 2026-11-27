/**
 * Geometry for the fixed-height typing window.
 *
 * The window shows exactly five whole lines. Keeping the height on a
 * whole-line boundary matters: the scroll target is line-quantised, so
 * the window never lands halfway through a line — which used to slice
 * glyphs in half and make the box look broken.
 *
 * Five (rather than six) keeps the active line centred on a whole line:
 * with an odd line count, half the window height minus half a line is an
 * integer number of lines.
 *
 * Framework-free on purpose — see tests/typing-line-window.test.mjs.
 */

export const TYPING_VIEWPORT_LINES = 5;
export const TYPING_VIEWPORT_LEADING = 1.9;

/**
 * Height in `em`, so it scales with the passage's font size.
 * 5 × 1.9, written out so the CSS value is exact (5 * 1.9 is
 * 9.499999999999998 in binary floating point).
 */
export const TYPING_VIEWPORT_HEIGHT_EM = 9.5;

/** Which visual line the caret is on, given its offset from the top. */
export function activeLineIndex(
  offsetTop: number,
  lineHeight: number
): number {
  if (
    !Number.isFinite(offsetTop) ||
    !Number.isFinite(lineHeight) ||
    lineHeight <= 0
  ) {
    return 0;
  }

  return Math.max(0, Math.round(offsetTop / lineHeight));
}

/**
 * Scroll offset that centres `line` in the window, clamped to the
 * scrollable range.
 *
 * With a five-line window the result is always a whole-line multiple
 * (except at the clamped start/end), so text stays aligned to the
 * window edges instead of being cut through the middle of a glyph.
 */
export function lineScrollTop(
  line: number,
  lineHeight: number,
  viewportHeight: number,
  scrollHeight: number
): number {
  if (
    !Number.isFinite(lineHeight) ||
    !Number.isFinite(viewportHeight) ||
    lineHeight <= 0 ||
    viewportHeight <= 0
  ) {
    return 0;
  }

  const safeLine = Number.isFinite(line) ? Math.max(0, line) : 0;
  const safeScrollHeight = Number.isFinite(scrollHeight)
    ? Math.max(0, scrollHeight)
    : viewportHeight;

  const target =
    safeLine * lineHeight - viewportHeight / 2 + lineHeight / 2;
  const max = Math.max(0, safeScrollHeight - viewportHeight);

  return Math.min(max, Math.max(0, target));
}
