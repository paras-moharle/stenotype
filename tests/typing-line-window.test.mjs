import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TYPING_VIEWPORT_LINES,
  TYPING_VIEWPORT_LEADING,
  TYPING_VIEWPORT_HEIGHT_EM,
  activeLineIndex,
  lineScrollTop,
} from '../lib/typing/line-window.ts';

// Public desktop: 29.6px font × 1.9 leading.
const LINE_HEIGHT = 56.24;
const WINDOW_HEIGHT = TYPING_VIEWPORT_LINES * LINE_HEIGHT;
const LONG_SCROLL_HEIGHT = 30 * LINE_HEIGHT;

const close = (actual, expected) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `expected ${expected}, got ${actual}`
  );

test('the window is exactly five whole lines', () => {
  assert.equal(TYPING_VIEWPORT_LINES, 5);
  assert.equal(TYPING_VIEWPORT_HEIGHT_EM, 9.5);
  close(TYPING_VIEWPORT_LINES * TYPING_VIEWPORT_LEADING, 9.5);
});

test('activeLineIndex rounds to the nearest visual line', () => {
  assert.equal(activeLineIndex(0, LINE_HEIGHT), 0);
  assert.equal(activeLineIndex(LINE_HEIGHT * 0.49, LINE_HEIGHT), 0);
  assert.equal(activeLineIndex(LINE_HEIGHT * 0.51, LINE_HEIGHT), 1);
  assert.equal(activeLineIndex(LINE_HEIGHT * 4, LINE_HEIGHT), 4);
});

test('the first line is pinned to the top', () => {
  assert.equal(
    lineScrollTop(0, LINE_HEIGHT, WINDOW_HEIGHT, LONG_SCROLL_HEIGHT),
    0
  );
});

test('the first lines stay pinned to the top', () => {
  for (const line of [0, 1, 2]) {
    close(
      lineScrollTop(line, LINE_HEIGHT, WINDOW_HEIGHT, LONG_SCROLL_HEIGHT),
      0
    );
  }
});

test('later lines scroll by whole line heights', () => {
  for (const line of [2, 3, 4, 5, 10]) {
    const top = lineScrollTop(
      line,
      LINE_HEIGHT,
      WINDOW_HEIGHT,
      LONG_SCROLL_HEIGHT
    );

    close(top, Math.max(0, line - 2) * LINE_HEIGHT);
    close(top / LINE_HEIGHT, Math.round(top / LINE_HEIGHT));
  }
});

test('the active line is centred in the five-line window', () => {
  const line = 5;
  const top = lineScrollTop(
    line,
    LINE_HEIGHT,
    WINDOW_HEIGHT,
    LONG_SCROLL_HEIGHT
  );
  const lineCentre = line * LINE_HEIGHT + LINE_HEIGHT / 2 - top;

  close(lineCentre, WINDOW_HEIGHT / 2);
});

test('the offset never runs past the scrollable range', () => {
  const lastLine = 10;
  const scrollHeight = (lastLine + 1) * LINE_HEIGHT;
  const top = lineScrollTop(
    lastLine,
    LINE_HEIGHT,
    WINDOW_HEIGHT,
    scrollHeight
  );

  close(top, scrollHeight - WINDOW_HEIGHT);
  assert.ok(top <= scrollHeight - WINDOW_HEIGHT);
});

test('short content does not scroll', () => {
  assert.equal(
    lineScrollTop(0, LINE_HEIGHT, WINDOW_HEIGHT, WINDOW_HEIGHT),
    0
  );
  assert.equal(
    lineScrollTop(5, LINE_HEIGHT, WINDOW_HEIGHT, WINDOW_HEIGHT),
    0
  );
});

test('a zero or invalid line height degrades to no scroll', () => {
  assert.equal(lineScrollTop(5, 0, WINDOW_HEIGHT, LONG_SCROLL_HEIGHT), 0);
  assert.equal(lineScrollTop(5, LINE_HEIGHT, 0, LONG_SCROLL_HEIGHT), 0);
  assert.equal(activeLineIndex(100, 0), 0);
  assert.equal(activeLineIndex(Number.NaN, LINE_HEIGHT), 0);
});
