import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/*
 * Structural guards for the typing surface.
 *
 * These cover the failures that unit tests cannot see: a fixed-height
 * window that is not a whole number of lines, smooth scrolling that
 * outruns the caret, a clipped `sr-only` input on mobile, a Tab handler
 * that restarts the run, and a second fake `role="textbox"`.
 */

const source = fs.readFileSync(
  'components/typing/typing-client.tsx',
  'utf8'
);
const lineWindow = fs.readFileSync('lib/typing/line-window.ts', 'utf8');

test('the passage window is exactly five whole lines tall', () => {
  assert.ok(source.includes('TYPING_VIEWPORT_HEIGHT_EM'));
  assert.ok(
    source.includes('style={{ height: `${TYPING_VIEWPORT_HEIGHT_EM}em` }}')
  );
  assert.ok(source.includes('overflow-hidden'));
  assert.match(lineWindow, /TYPING_VIEWPORT_LINES = 5/);
  assert.match(lineWindow, /TYPING_VIEWPORT_HEIGHT_EM = 9\.5/);
});

test('the component uses the shared line-window geometry', () => {
  assert.ok(source.includes("from '@/lib/typing/line-window'"));
  assert.ok(source.includes('activeLineIndex'));
  assert.ok(source.includes('lineScrollTop'));
});

test('line movement is instant and recentres on every keystroke', () => {
  assert.ok(!source.includes('scroll-smooth'));
  // `viewport.scrollTop =` is the instant assignment we want; the
  // animated `scrollTo({ ... })` form must be gone from the line window.
  assert.ok(!source.includes('viewport.scrollTo('));
  assert.ok(source.includes('viewport.scrollTop ='));
  assert.ok(!source.includes('lastLineRef'));

  const start = source.indexOf('const centerCurrentLine');
  const end = source.indexOf('useLayoutEffect', start);
  const lineWindowBody = source.slice(start, end);
  assert.ok(!lineWindowBody.includes("behavior: 'smooth'"));
  assert.ok(!lineWindowBody.includes('scrollTo('));
});

test('a resize or orientation change recentres the active line', () => {
  assert.ok(source.includes('ResizeObserver'));
});

test('no colour-banded fade overlays remain', () => {
  assert.ok(!source.includes('from-surface'));
  assert.ok(!source.includes('Soft edges so lines fade'));
});

test('the input is a real full-size overlay, not a clipped sr-only box', () => {
  assert.ok(!source.includes('sr-only text-base'));
  assert.ok(source.includes('absolute inset-0 z-10'));
  assert.ok(source.includes('opacity-0'));
  assert.ok(source.includes('caret-transparent'));
  assert.ok(source.includes('inputMode="text"'));
  assert.ok(source.includes('enterKeyHint="done"'));
  assert.ok(source.includes('autoComplete="off"'));
  assert.ok(source.includes('spellCheck={false}'));
});

test('the surface is positioned so the overlay can cover it', () => {
  assert.match(source, /typing-surface glow-brand relative/);
});

test('the disabled input does not block the review controls', () => {
  assert.ok(source.includes("disabled={isFinished || (mode === 'free' && passageLoading)}"));
  assert.ok(
    source.includes("isFinished && 'pointer-events-none'")
  );
});

test('Tab is not hijacked', () => {
  assert.ok(!source.includes("event.key === 'Tab'"));
});

test('the surface is not a second textbox', () => {
  assert.ok(!source.includes('role="textbox"'));
  assert.ok(!source.includes("aria-label={isBlind ? 'Typing area"));
  assert.ok(source.includes('aria-label="Typing input'));
});

test('the surface height matches the five-line window (no empty void)', () => {
  assert.ok(!source.includes('min-h-[240px] sm:min-h-[300px]'));
  assert.ok(source.includes('min-h-[260px]'));
  assert.ok(source.includes('sm:min-h-[315px]'));
  assert.ok(source.includes('min-h-[235px]'));
  assert.ok(source.includes('sm:min-h-[305px]'));
});

test('the typing surface is separated from the mode and timer controls', () => {
  assert.match(source, /aria-label="Typing practice"/);
  assert.ok(source.includes('aria-label="Typing practice" className="pt-2"'));
});

test('the typing screens use the wider container', () => {
  const home = fs.readFileSync('app/(public)/page.tsx', 'utf8');
  const shell = fs.readFileSync('components/student/student-shell.tsx', 'utf8');
  const css = fs.readFileSync('app/globals.css', 'utf8');

  assert.ok(home.includes('container-typing'));
  assert.ok(shell.includes('container-typing'));
  assert.ok(shell.includes("pathname?.startsWith('/student/typing')"));
  assert.match(css, /\.container-typing/);
  assert.match(css, /max-w-\[86rem\]/);
});

test('the passage uses the full width of the wider surface', () => {
  assert.ok(!source.includes('max-w-6xl'));
});
