import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';

/*
 * Real-browser geometry test for the typing screen.
 *
 * Unit tests can prove the scroll maths; only a browser can prove the
 * window is really five lines tall, the surface has no empty void, the
 * caret is centred, Tab is not hijacked, and the page does not overflow.
 *
 * Opt-in so `npm test` stays fast and works without a browser:
 *
 *   npm run build
 *   npx next start -p 3100
 *   STENO_E2E_URL=http://localhost:3100 npx tsx --test \
 *     tests/typing-ui-browser.test.mjs
 *
 * Set CHROME_BIN if Chromium is not on PATH.
 */

const URL_UNDER_TEST = process.env.STENO_E2E_URL;

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  for (const name of [
    'chromium',
    'chromium-browser',
    'google-chrome',
    'google-chrome-stable',
  ]) {
    try {
      return execFileSync('which', [name], { encoding: 'utf8' }).trim();
    } catch {
      // Try the next binary name.
    }
  }

  return null;
}

const CHROME = findChrome();
const skip = !URL_UNDER_TEST
  ? 'set STENO_E2E_URL to a running server'
  : !CHROME
    ? 'no Chromium binary found (set CHROME_BIN)'
    : false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launchChrome() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${port}`,
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${base}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === 'page');
        if (page) return { proc, page };
      }
    } catch {
      // Not listening yet.
    }
    await sleep(100);
  }

  proc.kill('SIGKILL');
  throw new Error('Chromium did not expose a debugging port');
}

function connect(wsUrl, testContext) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 0;
  const consoleErrors = [];

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map(arg => arg.description ?? arg.value ?? arg.type).join(' '));
    } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      consoleErrors.push(message.params.entry.text);
    }
    if (consoleErrors.length > 20) consoleErrors.shift();
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  }).then(() => Promise.all([send('Runtime.enable'), send('Log.enable')]));

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result.value;
  };

  const captureFailure = async (reason) => {
    try {
      const directory = process.env.STENO_BROWSER_ARTIFACT_DIR ?? join(tmpdir(), 'stenotype-browser-failures');
      await mkdir(directory, { recursive: true });
      const stem = join(directory, randomUUID());
      const state = await evaluate(`(() => {
        const describe = node => node && ({
          tag: node.tagName, role: node.getAttribute('role'), label: node.getAttribute('aria-label'),
          expanded: node.getAttribute('aria-expanded'), disabled: node.disabled ?? false,
          display: getComputedStyle(node).display, height: getComputedStyle(node).height,
          fontSize: getComputedStyle(node).fontSize, lineHeight: getComputedStyle(node).lineHeight,
          hiddenAncestor: Boolean(node.closest('[hidden]')), rect: node.getBoundingClientRect().toJSON(),
        });
        return {
          url: location.pathname, readyState: document.readyState, fonts: document.fonts.status,
          visibility: document.visibilityState, dimensions: [innerWidth, innerHeight],
          typingReady: Boolean(document.querySelector('[data-typing-ready]')),
          active: describe(document.activeElement), viewport: describe(document.querySelector('.typing-line-window')),
          surface: describe(document.querySelector('.typing-surface')),
          picker: describe(document.querySelector('[aria-label="Passage length"]')),
          menu: describe(document.querySelector('[role=listbox]')),
          dialog: describe(document.querySelector('dialog[open]')),
        };
      })()`);
      const report = { reason, state, consoleErrors: consoleErrors.map(error => String(error).slice(0, 1200)) };
      await writeFile(stem + '.json', JSON.stringify(report, null, 2));
      testContext?.diagnostic(`Browser diagnostics: ${JSON.stringify(report)}`);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(stem + '.png', Buffer.from(data, 'base64'));
      testContext?.diagnostic(`Browser artifacts: ${stem}.{json,png}`);
    } catch (error) {
      testContext?.diagnostic(`Unable to collect browser diagnostics: ${error.message}`);
    }
  };

  const waitFor = async (expression, timeout = 10_000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    await captureFailure(expression);
    throw new Error(`Timed out waiting for: ${expression}`);
  };

  return { ws, send, evaluate, waitFor, ready, captureFailure };
}

const typingReady = "Boolean(document.querySelector('[data-typing-ready]'))";

async function waitForTyping(cdp, path) {
  await cdp.waitFor(`location.pathname + location.search === ${JSON.stringify(path)} && ${typingReady}`);
}

async function assertAnchored(cdp, trigger, popup) {
  const geometry = await cdp.evaluate(`(() => {
    const anchor = (${trigger}).getBoundingClientRect().toJSON();
    const menu = document.querySelector(${JSON.stringify(popup)}).getBoundingClientRect().toJSON();
    return { anchor, menu, width: innerWidth, height: innerHeight };
  })()`);
  const { anchor, menu, width, height } = geometry;
  const overlaps = menu.left < anchor.right && menu.right > anchor.left;
  const beside = Math.min(Math.abs(menu.top - anchor.bottom), Math.abs(anchor.top - menu.bottom)) <= 14;
  const fits = menu.left >= 0 && menu.top >= 0 && menu.right <= width + 1 && menu.bottom <= height + 1;
  if (!overlaps || !beside || !fits) await cdp.captureFailure('Popover position');
  assert.ok(overlaps && beside && fits, `Popup is not anchored inside the viewport: ${JSON.stringify(geometry)}`);
}

const readGeometry = `(() => {
  const input = document.querySelector('[data-typing-input]');
  const surface = input.parentElement;
  const viewport = surface.querySelector('.typing-line-window');
  const content = viewport.firstElementChild;
  const section = document.querySelector('[aria-label="Typing practice"]');
  const current = viewport.querySelector('span.bg-brand\\\\/10');
  const lineHeight = parseFloat(getComputedStyle(content).lineHeight);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top * 10) / 10,
      bottom: Math.round(r.bottom * 10) / 10,
      left: Math.round(r.left * 10) / 10,
      right: Math.round(r.right * 10) / 10,
      width: Math.round(r.width * 10) / 10,
      height: Math.round(r.height * 10) / 10,
    };
  };
  const surfaceStyle = getComputedStyle(surface);
  return JSON.stringify({
    surface: box(surface),
    viewport: box(viewport),
    content: box(content),
    current: box(current),
    input: box(input),
    section: box(section),
    sectionPaddingTop: parseFloat(getComputedStyle(section).paddingTop),
    lineHeight,
    scrollTop: viewport.scrollTop,
    scrollHeight: viewport.scrollHeight,
    clientHeight: viewport.clientHeight,
    surfacePaddingTop: parseFloat(surfaceStyle.paddingTop),
    surfacePaddingBottom: parseFloat(surfaceStyle.paddingBottom),
    surfaceBorderTop: parseFloat(surfaceStyle.borderTopWidth),
    surfaceBorderBottom: parseFloat(surfaceStyle.borderBottomWidth),
    inputOpacity: getComputedStyle(input).opacity,
    activeElement:
      document.activeElement === input
        ? 'input'
        : document.activeElement?.tagName ?? 'none',
    typed: input.value.length,
    docWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  });
})()`;

test('the typing screen is geometrically correct in a real browser', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const cdp = connect(page.webSocketDebuggerUrl, t);

  t.after(() => {
    try {
      cdp.ws.close();
    } catch {
      // Already closed.
    }
    proc.kill('SIGKILL');
  });

  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: URL_UNDER_TEST });
  await waitForTyping(cdp, '/');
  await cdp.waitFor(
    "document.querySelectorAll('[data-typing-input]').length === 1 && " +
      "Boolean(document.querySelector('.typing-line-window')?.getClientRects().length)"
  );
  await cdp.evaluate(`(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  })()`);

  const idle = JSON.parse(await cdp.evaluate(readGeometry));

  // 1. The window is exactly five whole lines.
  if (Math.abs(idle.viewport.height - idle.lineHeight * 5) > 1.5) {
    await cdp.captureFailure('Initial five-line viewport geometry');
  }
  assert.ok(
    Math.abs(idle.viewport.height - idle.lineHeight * 5) <= 1.5,
    `viewport ${idle.viewport.height}px is not 5 × ${idle.lineHeight}px`
  );

  // 2. No empty void: the surface is the window plus its padding and
  //    its own 1px top/bottom border (getBoundingClientRect includes it).
  const expectedSurface =
    idle.viewport.height +
    idle.surfacePaddingTop +
    idle.surfacePaddingBottom +
    idle.surfaceBorderTop +
    idle.surfaceBorderBottom;
  assert.ok(
    Math.abs(idle.surface.height - expectedSurface) <= 2,
    `surface ${idle.surface.height}px vs expected ${expectedSurface}px`
  );

  // 3. The transparent input really covers the surface.
  assert.ok(
    Math.abs(idle.input.width - idle.surface.width) <= 2 &&
      Math.abs(idle.input.height - idle.surface.height) <= 2,
    'input overlay does not cover the typing surface'
  );
  assert.equal(idle.inputOpacity, '0');

  // 4. The workspace sits within one body line of the controls.
  assert.ok(
    idle.sectionPaddingTop >= 4 && idle.sectionPaddingTop <= 16,
    `only ${idle.sectionPaddingTop}px of separation`
  );

  // 5. No horizontal overflow at 1440px.
  assert.ok(
    idle.docWidth <= idle.innerWidth + 1,
    `page overflows: ${idle.docWidth} > ${idle.innerWidth}`
  );

  // 6. Type past several lines and check the caret stays centred.
  const reference = await cdp.evaluate(`(() => {
    const viewport = document
      .querySelector('[data-typing-input]')
      .parentElement.querySelector('.typing-line-window');
    return Array.from(viewport.querySelectorAll('span'))
      .map((span) => span.textContent)
      .join('');
  })()`);

  assert.ok(reference.length > 200, 'reference passage is too short');

  await cdp.evaluate(
    "document.querySelector('[data-typing-input]').focus()"
  );
  await cdp.send('Input.insertText', {
    // Half the passage is plenty to cross several lines without
    // triggering the auto-finish at the end.
    text: reference.slice(0, Math.min(240, Math.floor(reference.length / 2))),
  });
  await sleep(400);

  const typed = JSON.parse(await cdp.evaluate(readGeometry));

  assert.ok(typed.typed > 0, 'typing did not reach the input');
  assert.ok(typed.current, 'the caret span is missing after typing');
  assert.ok(
    Math.abs(typed.current.top + typed.current.height / 2 -
      (typed.viewport.top + typed.viewport.height / 2)) <= 2,
    'active line is not centred in the window'
  );

  const offsetInLines = typed.scrollTop / typed.lineHeight;
  assert.ok(
    Math.abs(offsetInLines - Math.round(offsetInLines)) < 0.02,
    `scroll offset ${offsetInLines} is not on a line boundary`
  );

  // 7. Tab moves focus instead of restarting the run.
  const beforeTab = typed.typed;
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await sleep(250);

  const afterTab = JSON.parse(await cdp.evaluate(readGeometry));
  assert.notEqual(afterTab.activeElement, 'input', 'Tab did not move focus');
  assert.equal(afterTab.typed, beforeTab, 'Tab restarted or cleared the run');
});

const localStudent = URL_UNDER_TEST && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(URL_UNDER_TEST).hostname)
  && process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD;

test('long custom input keeps the caret and correction responsive while the worker scores', {
  skip: skip || (!localStudent && 'requires local URL and seeded student credentials'),
}, async (t) => {
  const origin = new URL(URL_UNDER_TEST).origin;
  const auth = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD }),
  });
  assert.equal(auth.status, 200);
  const cookie = auth.headers.getSetCookie().find((line) => line.includes('better-auth.session_token='));
  assert.ok(cookie, 'student session cookie was issued');
  const [name, ...value] = cookie.split(';')[0].split('=');

  const { proc, page } = await launchChrome();
  const cdp = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { cdp.ws.close(); proc.kill('SIGKILL'); });
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Network.setCookie', { name, value: value.join('='), url: origin });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.alignmentReplies = 0; const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', (event) => { if (event.data?.alignment) window.alignmentReplies++; });
        }
      };`,
  });
  await cdp.send('Page.navigate', { url: `${origin}/student/typing?mode=custom` });
  await waitForTyping(cdp, '/student/typing?mode=custom');
  const pasteButton = "Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Paste text')";
  await cdp.waitFor(`!!(${pasteButton})`);
  await cdp.evaluate(`(${pasteButton}).click()`);
  await cdp.waitFor("!!document.querySelector('dialog[open] textarea')");
  await cdp.evaluate("document.querySelector('dialog[open] textarea').focus()");
  const reference = 'alpha beta gamma delta '.repeat(175).trim();
  await cdp.send('Input.insertText', { text: reference });
  const startButton = "Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Start')";
  await cdp.waitFor(`!!(${startButton}) && !(${startButton}).disabled`);
  await cdp.evaluate(`(${startButton}).click()`);
  await cdp.waitFor("!!document.querySelector('[data-typing-input]')");
  await cdp.evaluate("document.querySelector('[data-typing-input]').focus()");
  const typed = reference.slice(0, 3_800).replaceAll('a', 'x');
  await cdp.send('Input.insertText', { text: typed });
  await cdp.waitFor(`document.querySelector('[data-typing-input]').value.length === ${typed.length}`);
  let geometry = JSON.parse(await cdp.evaluate(readGeometry));
  assert.ok(geometry.current, 'caret remains visible during worker scoring');
  assert.ok(geometry.scrollTop > 0, 'viewport follows long input');
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  await cdp.waitFor(`document.querySelector('[data-typing-input]').value.length === ${typed.length - 1}`);
  await cdp.waitFor('window.alignmentReplies > 0');
  geometry = JSON.parse(await cdp.evaluate(readGeometry));
  assert.ok(geometry.current, 'caret remains visible after correction');
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await cdp.waitFor("!!document.querySelector('[aria-label=\"Passage coloured by result\"] span')");
  await cdp.evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Try again').click()");
  await cdp.waitFor("!!document.querySelector('[data-typing-input]')");
  await cdp.evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === '15s').click()");
  await cdp.waitFor("document.querySelector('[data-typing-clock]').textContent === '0:15'");
  assert.equal(await cdp.evaluate("document.querySelector('.typing-line-window').textContent"), reference);
  await cdp.evaluate("document.querySelector('[data-typing-input]').focus()");
  await cdp.send('Input.insertText', { text: 'alpha beta gamma delta' });
  await cdp.evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Submit').click()");
  const remaining = "Array.from(document.querySelectorAll('details')).find(item => item.querySelector('summary')?.textContent.startsWith('Show remaining reference'))";
  await cdp.waitFor(`!!(${remaining})`);
  assert.equal(await cdp.evaluate(`(${remaining}).open`), false);

});

test('authenticated catalog actions load the exact dictation, leaving the active workspace blind', {
  skip: skip || (!localStudent || process.env.STENO_DISPOSABLE_DB !== 'YES'
    || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD ? 'requires seeded loopback service and disposable test data' : false),
}, async (t) => {
  const origin = new URL(URL_UNDER_TEST).origin;
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  const signIn = async (email, password) => {
    const response = await fetch(`${origin}/api/auth/sign-in/email`, {
      method: 'POST', headers, body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.getSetCookie().find(line => line.includes('better-auth.session_token='));
    assert.ok(cookie, 'session cookie was issued');
    return cookie.split(';')[0];
  };
  const admin = await signIn(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const student = await signIn(process.env.SMOKE_EMAIL, process.env.SMOKE_PASSWORD);
  const title = `Chromium practice ${crypto.randomUUID()}`;
  const transcript = 'Read this private practice sentence only in the study view.';
  const created = await fetch(`${origin}/api/admin/dictations`, {
    method: 'POST',
    headers: { ...headers, Cookie: admin, 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ title, referenceTranscript: transcript, category: 'GENERAL', status: 'PUBLISHED', youtubeId: 'dQw4w9WgXcQ' }),
  });
  assert.equal(created.status, 201);
  const { dictation } = await created.json();
  t.after(async () => {
    await fetch(`${origin}/api/admin/dictations/${dictation.id}`, {
      method: 'PUT', headers: { ...headers, Cookie: admin }, body: JSON.stringify({ status: 'DRAFT' }),
    });
  });

  const { proc, page } = await launchChrome();
  const cdp = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { cdp.ws.close(); proc.kill('SIGKILL'); });
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  const [name, ...value] = student.split('=');
  await cdp.send('Network.setCookie', { name, value: value.join('='), url: origin });
  const catalog = `${origin}/student/dictations?q=${encodeURIComponent(title)}`;
  await cdp.send('Page.navigate', { url: catalog });
  const row = `Array.from(document.querySelectorAll('li')).find(item => item.querySelector('h2')?.textContent === ${JSON.stringify(title)})`;
  await cdp.waitFor(`document.readyState === 'complete' && !!(${row})`);
  const results = `(${row}).querySelector('a[href^="/student/results?"]')`;
  const practice = `(${row}).querySelector('a[href^="/student/typing?"]')`;
  const youtube = `(${row}).querySelector('a[target="_blank"]')`;
  assert.equal(await cdp.evaluate(`new URL((${results}).href).searchParams.get('dictationId')`), dictation.id);
  assert.equal(await cdp.evaluate(`(${youtube}).href`), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const study = `Array.from((${row}).querySelectorAll('button')).find(button => button.textContent.trim() === 'View dictation')`;
  await cdp.evaluate(`(${study}).click()`);
  await cdp.waitFor(`document.querySelector('dialog[open]')?.textContent.includes(${JSON.stringify(transcript)})`);
  await cdp.evaluate("Array.from(document.querySelectorAll('dialog[open] button')).find(button => button.textContent.trim() === 'Close').click()");
  await cdp.waitFor("!document.querySelector('dialog[open]')");
  await cdp.evaluate(`(${practice}).click()`);
  await cdp.waitFor(`document.querySelector('[aria-label="Selected dictation"] h2')?.textContent === ${JSON.stringify(title)}`);
  assert.equal(await cdp.evaluate("new URL(location.href).searchParams.get('dictationId')"), dictation.id);
  assert.equal(await cdp.evaluate(`document.body.textContent.includes(${JSON.stringify(transcript)})`), false);
  assert.equal(await cdp.evaluate("!!document.querySelector('[data-typing-input]')"), true);
  const typed = 'Keep this unsaved transcription.';
  await cdp.evaluate("document.querySelector('[data-typing-input]').focus()");
  await cdp.send('Input.insertText', { text: typed });
  const revoked = await fetch(`${origin}/api/admin/dictations/${dictation.id}`, {
    method: 'PUT', headers: { ...headers, Cookie: admin }, body: JSON.stringify({ status: 'DRAFT' }),
  });
  assert.equal(revoked.status, 200);
  await cdp.evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Finish and evaluate').click()");
  await cdp.waitFor("document.body.textContent.includes('This dictation revision is unavailable')");
  await cdp.evaluate("Array.from(document.querySelectorAll('summary')).find(item => item.textContent === 'Copy your transcription').click()");
  assert.equal(await cdp.evaluate("document.querySelector('textarea[aria-label=\"Your unsaved transcription\"]').value"), typed);
  assert.equal(await cdp.evaluate("document.body.textContent.includes('Retry evaluation')"), false);
  assert.equal(await cdp.evaluate(`document.body.textContent.includes(${JSON.stringify(transcript)})`), false);

});

test('public routes fit compact to 4K viewports and theme preference persists', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const browser = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { browser.ws.close(); proc.kill('SIGKILL'); });
  await browser.ready;
  await browser.send('Page.enable');
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  for (const theme of ['light', 'dark']) {
    await browser.send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'prefers-color-scheme', value: theme },
    ] });
    for (const path of ['/', '/about', '/login', '/missing-preview']) {
      await browser.send('Page.navigate', { url: new URL(path, URL_UNDER_TEST).href });
      await browser.waitFor(`location.pathname === ${JSON.stringify(path)} && document.readyState === "complete" && !!document.querySelector('h1')`);
      for (const width of [320, 360, 375, 393, 430, 600, 640, 700, 768, 800, 900, 960, 1024, 1100, 1280, 1366, 1440, 1920, 2560, 3440, 3840]) {
        await browser.send('Emulation.setDeviceMetricsOverride', {
          width, height: width === 768 ? 360 : 900, deviceScaleFactor: 1, mobile: false,
        });
        if (path !== '/missing-preview') {
          const navigation = await browser.evaluate(`Array.from(document.querySelectorAll('nav[aria-label="Main navigation"] a'))
            .filter(link => link.getBoundingClientRect().width > 0)
            .map(link => ({ height: link.getBoundingClientRect().height, active: link.getAttribute('aria-current'), path: link.pathname }))`);
          assert.ok(navigation.every(item => item.height >= 44));
          assert.equal(navigation.find(item => item.path === path)?.active, 'page');
        }
        const overflow = await browser.evaluate('document.documentElement.scrollWidth - innerWidth');
        assert.ok(overflow <= 1, `${path} at ${width}px overflows by ${overflow}px`);
      }
    }
  }

  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: new URL('/', URL_UNDER_TEST).href });
  await browser.waitFor('location.pathname === "/" && document.readyState === "complete"');
  const themeButton = `document.querySelector('button[title="Change theme"]')`;
  await browser.waitFor(`!!(${themeButton})`);
  const screenshotDir = process.env.STENO_QA_SCREENSHOTS;
  for (const expected of ['light', 'dark']) {
    for (let retry = 0; retry < 10; retry++) {
      if (await browser.evaluate('document.documentElement.dataset.theme') === expected) break;
      await browser.evaluate(`(${themeButton}).click()`);
      await sleep(100);
    }
    await browser.waitFor(`document.documentElement.dataset.theme === ${JSON.stringify(expected)}`);
    assert.equal(await browser.evaluate("localStorage.getItem('stenotype-theme')"), expected);
    assert.equal(await browser.evaluate('getComputedStyle(document.documentElement).colorScheme'), expected);
    const ratios = await browser.evaluate(`(() => {
      const sample = document.createElement('span');
      document.body.append(sample);
      function luminance(color) {
        sample.style.color = color;
        const units = getComputedStyle(sample).color.match(/[\\d.]+/g).slice(0, 3).map(Number);
        return units.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4))
          .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
      }
      const palette = [
        ['text', 'foreground', 'background'], ['secondary text', 'muted-foreground', 'surface'],
        ['primary button', 'brand-foreground', 'brand'], ['selection', 'brand', 'brand-soft'],
        ['correct', 'typing-correct', 'surface'], ['wrong', 'typing-incorrect', 'surface'], ['missed', 'typing-missed', 'surface'],
        ['keyboard focus', 'ring', 'surface'],
      ];
      const results = palette.map(([label, first, second]) => {
        const values = [first, second].map(name => luminance('var(--color-' + name + ')'));
        return [label, (Math.max(...values) + .05) / (Math.min(...values) + .05)];
      });
      sample.remove();
      return results;
    })()`);
    for (const [label, ratio] of ratios) {
      assert.ok(ratio >= (label === 'keyboard focus' ? 3 : 4.5), `${expected}: ${label} contrast was ${ratio.toFixed(2)}`);
    }
    t.diagnostic(`${expected} contrast: ${ratios.map(([label, ratio]) => label + ' ' + ratio.toFixed(2)).join(', ')}`);

    if (screenshotDir && expected === 'light') {
      const light = await browser.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(screenshotDir, 'practice-light.png'), Buffer.from(light.data, 'base64'));
    }

  }
  if (screenshotDir) {
    const dark = await browser.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(screenshotDir, 'practice-dark.png'), Buffer.from(dark.data, 'base64'));
  }
  await browser.send('Page.reload');
  await browser.waitFor("document.readyState === 'complete' && document.documentElement.dataset.theme === 'dark'");
  if (screenshotDir) {
    for (const route of ['/about', '/login']) {
      await browser.send('Page.navigate', { url: new URL(route, URL_UNDER_TEST).href });
      await browser.waitFor(`location.pathname === ${JSON.stringify(route)} && document.readyState === "complete"`);
      const screenshot = await browser.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(screenshotDir, route.slice(1) + '-dark.png'), Buffer.from(screenshot.data, 'base64'));
    }
  }

});

test('a ready passage captures the first key once and respects other focus', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const browser = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { browser.ws.close(); proc.kill('SIGKILL'); });
  await browser.ready;
  await browser.send('Page.enable');
  await browser.send('Page.navigate', { url: new URL('/', URL_UNDER_TEST).href });
  const input = "document.querySelector('[data-typing-input]')";
  const clock = "document.querySelector('[data-typing-clock]')";
  await browser.waitFor(`document.readyState === 'complete' && !!(${input}) && !!(${clock})`);
  const press = async (key, code, keyCode, text = undefined) => {
    await browser.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, text,
    });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  };
  assert.equal(await browser.evaluate('document.activeElement === document.body'), true);
  assert.equal(await browser.evaluate(`(${clock}).textContent`), '0:30');

  // Focused form controls, modal contents and browser shortcuts must
  // never route input to the typing exercise.
  await browser.evaluate(`(() => {
    const search = document.createElement('input');
    search.type = 'search';
    search.id = 'focus-probe';
    document.body.append(search);
    search.focus();
  })()`);
  await press('a', 'KeyA', 65, 'a');
  assert.equal(await browser.evaluate("document.querySelector('#focus-probe').value"), 'a');
  assert.equal(await browser.evaluate(`(${input}).value`), '');
  await browser.evaluate(`(() => {
    const dialog = document.createElement('dialog');
    const field = document.createElement('textarea');
    field.id = 'modal-probe';
    dialog.append(field);
    document.body.append(dialog);
    dialog.showModal();
    field.focus();
  })()`);
  await press('b', 'KeyB', 66, 'b');
  assert.equal(await browser.evaluate("document.querySelector('#modal-probe').value"), 'b');
  assert.equal(await browser.evaluate(`(${input}).value`), '');
  await browser.evaluate(`(() => {
    document.querySelector('dialog').close();
    document.querySelector('dialog').remove();
    document.querySelector('#focus-probe').remove();
    document.activeElement.blur();
    for (const init of [{ key: 'x', ctrlKey: true }, { key: 'q', altKey: true },
      { key: 'e', metaKey: true }, { key: '你', isComposing: true }, { key: 'Dead' }]) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true }));
    }
  })()`);
  assert.equal(await browser.evaluate(`(${input}).value`), '');
  assert.equal(await browser.evaluate('document.activeElement === document.body'), true);

  await press('s', 'KeyS', 83, 's');
  await browser.waitFor(`(${input}).value === 's'`);
  assert.equal(await browser.evaluate(`document.activeElement === (${input})`), true);
  await press('t', 'KeyT', 84, 't');
  assert.equal(await browser.evaluate(`(${input}).value`), 'st');
  await browser.waitFor(`(${clock}).textContent === '0:29'`);
  await press('Backspace', 'Backspace', 8);
  assert.equal(await browser.evaluate(`(${input}).value`), 's');

  // Chromium's native IME commit follows the input path, not the handoff.
  await browser.send('Input.imeSetComposition', { text: 'é', selectionStart: 1, selectionEnd: 1 });
  await browser.send('Input.insertText', { text: 'é' });
  assert.equal(await browser.evaluate(`(${input}).value`), 'sé');

  await browser.evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Restart').click()`);
  await browser.waitFor(`(${input}).value === '' && (${clock}).textContent === '0:30'`);
  await browser.evaluate(`(${input}).focus()`);
  await browser.send('Input.imeSetComposition', { text: 'é', selectionStart: 1, selectionEnd: 1 });
  await sleep(1100);
  assert.equal(await browser.evaluate(`(${clock}).textContent`), '0:30', 'an IME draft started the timer');
  await browser.send('Input.insertText', { text: 'é' });
  await browser.waitFor(`(${input}).value === 'é' && (${clock}).textContent === '0:29'`);
  await browser.evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Restart').click()`);
  await browser.waitFor(`(${input}).value === '' && (${clock}).textContent === '0:30'`);
  await press('z', 'KeyZ', 90, 'z');
  await browser.waitFor(`(${input}).value === 'z'`);
  await press('Enter', 'Enter', 13);
  const result = "document.querySelector('[aria-label=\"Passage coloured by result\"]')";
  await browser.waitFor(`!(${input}) && !!(${result})`);
  const text = await browser.evaluate(`(${result}).textContent`);
  await press('x', 'KeyX', 88, 'x');
  assert.equal(await browser.evaluate(input), null);
  assert.equal(await browser.evaluate(`(${result}).textContent`), text);
});

test('passage picker restores the complete reference and settings reflow by container width', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const cdp = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { cdp.ws.close(); proc.kill('SIGKILL'); });
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url: new URL('/', URL_UNDER_TEST).href });
  const picker = 'document.querySelector(\'[role="combobox"][aria-label="Passage length"]\')';
  const passage = "document.querySelector('.typing-surface .overflow-hidden').textContent";
  await waitForTyping(cdp, '/');
  await cdp.waitFor(`!!(${picker}) && !(${picker}).disabled`);
  const source = await cdp.evaluate(passage);
  const prefix = source.split(/\s+/).slice(0, 30).join(' ');
  assert.ok(source.length > prefix.length);
  const key = async (key, code, windowsVirtualKeyCode) => {
    for (const type of ['rawKeyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode });
  };
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const [move, keyCode, expected] of [['End', 35, prefix], ['Home', 36, source]]) {
      await cdp.evaluate(`(${picker}).focus()`);
      await key('Enter', 'Enter', 13);
      // Radix positions the portal before moving focus into its open listbox.
      await cdp.waitFor(`(${picker}).getAttribute('aria-expanded') === 'true' && document.activeElement?.matches('[role=listbox] [role=option]')`);
      await assertAnchored(cdp, picker, '[role=listbox]');
      await key(move, move, keyCode);
      await cdp.waitFor(`document.activeElement?.textContent.includes(${JSON.stringify(move === 'End' ? 'First 30' : 'Full passage')})`);
      await key('Enter', 'Enter', 13);
      await cdp.waitFor(`${passage} === ${JSON.stringify(expected)}`);
      // The exit animation retains the menu and its focus scope briefly.
      await cdp.waitFor(`!document.querySelector('[role=listbox]') && document.activeElement === (${picker})`);
      assert.equal(await cdp.evaluate("document.querySelector('.reference-preview p').textContent"), expected);
      assert.equal(await cdp.evaluate("document.querySelector('[data-typing-input]').value"), '');
    }
  }

  for (const width of [320, 360, 390, 430, 600, 640, 700, 768, 800, 900, 960, 1024, 1100, 1280, 1440, 1920, 2560, 3840]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    const summary = "document.querySelector('.practice-summary')";
    if (width === 320) await cdp.evaluate(`(${summary}).click()`);
    const [mode, topic, length, time] = await cdp.evaluate("['mode','topic','length','time'].map(name => document.querySelector('.practice-' + name).offsetTop)");
    assert.equal(topic, length);
    if (width <= 430) assert.ok(mode < topic && topic < time);
    else if (width >= 1100) assert.equal(mode, topic);
    else assert.ok((mode === time && mode < topic) || (mode === topic && mode === time) || (mode < topic && topic < time));
  }

  await cdp.evaluate("document.querySelector('[aria-label=\"Test duration\"] button:last-child').click()");
  await cdp.waitFor("document.querySelector('[aria-label=\"Test duration\"] button:last-child').getAttribute('aria-pressed') === 'true'");
  await cdp.evaluate("document.querySelector('[data-typing-input]').focus()");
  await cdp.send('Input.insertText', { text: await cdp.evaluate(passage) });
  await cdp.waitFor("!!document.querySelector('[aria-label=\"Passage coloured by result\"]')");
});

test('mobile settings stay compact and focus and rotation preserve an active run', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const cdp = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { cdp.ws.close(); proc.kill('SIGKILL'); });
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 393, height: 660, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Page.navigate', { url: URL_UNDER_TEST });
  const summary = "document.querySelector('.practice-summary')";
  const input = "document.querySelector('[data-typing-input]')";
  const options = "document.getElementById('free-practice-options')";
  await cdp.waitFor(`document.readyState === 'complete' && !!(${input})`);
  assert.equal(await cdp.evaluate(`(${summary}).getAttribute('aria-expanded')`), 'false');
  assert.equal(await cdp.evaluate(`getComputedStyle(${options}).display`), 'none');
  assert.ok(await cdp.evaluate("document.querySelector('.typing-line-window').getBoundingClientRect().bottom < innerHeight"));
  await cdp.evaluate(`(${summary}).click()`);
  await cdp.waitFor(`(${summary}).getAttribute('aria-expanded') === 'true'`);
  assert.equal(await cdp.evaluate(`getComputedStyle(${options}).display`), 'contents');
  await cdp.evaluate(`(${summary}).click(); (${input}).focus()`);
  assert.equal(await cdp.evaluate("document.querySelector('[data-typing-clock]').textContent"), '0:30');
  await cdp.send('Input.insertText', { text: 'some text' });
  await cdp.waitFor(`(${input}).value === 'some text' && !!Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Restart')`);
  await cdp.evaluate(`(${summary}).click()`);
  await cdp.waitFor(`(${summary}).getAttribute('aria-expanded') === 'true'`);
  assert.equal(await cdp.evaluate(`document.querySelector('[aria-label="Passage topic"]').disabled`), true);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 740, height: 350, deviceScaleFactor: 1, mobile: true });
  assert.equal(await cdp.evaluate(`(${input}).value`), 'some text');
});

test('restart preserves the passage, category and new passage update it, and the timer expires', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const browser = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { browser.ws.close(); proc.kill('SIGKILL'); });
  await browser.ready;
  await browser.send('Page.enable');
  await browser.send('Page.navigate', { url: new URL('/', URL_UNDER_TEST).href });
  const preview = "document.querySelector('.reference-preview p')?.textContent";
  const button = (label) => `Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  const press = async (key, code, windowsVirtualKeyCode) => {
    for (const type of ['rawKeyDown', 'keyUp']) {
      await browser.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode });
    }
  };
  await browser.waitFor(`document.readyState === 'complete' && !!(${preview})`);
  const initial = await browser.evaluate(preview);
  await browser.evaluate("document.querySelector('[aria-label=\"Passage topic\"]').focus()");
  await press('Enter', 'Enter', 13);
  await browser.waitFor("!!document.querySelector('[role=listbox]')");
  await press('ArrowDown', 'ArrowDown', 40);
  await browser.waitFor("document.activeElement?.textContent === 'Legal'");
  await press('Enter', 'Enter', 13);
  await browser.waitFor(`!!(${preview}) && ${preview} !== ${JSON.stringify(initial)}`);
  const legal = await browser.evaluate(preview);
  await browser.evaluate(`(${button('New passage')}).click()`);
  await browser.waitFor(`!!(${preview}) && ${preview} !== ${JSON.stringify(legal)}`);
  const selected = await browser.evaluate(preview);
  await browser.evaluate("document.querySelector('[data-typing-input]').focus()");
  await browser.send('Input.insertText', { text: selected.slice(0, 1) });
  await browser.waitFor(`!!(${button('Restart')})`);
  await browser.evaluate(`(${button('Restart')}).click()`);
  await browser.waitFor(`!!(${preview})`);
  assert.equal(await browser.evaluate(preview), selected);
  await browser.evaluate(`(${button('15s')}).click()`);
  await browser.waitFor("document.querySelector('[data-typing-clock]').textContent === '0:15'");
  await browser.evaluate("document.querySelector('[data-typing-input]').focus()");
  await browser.send('Input.insertText', { text: selected.slice(0, 1) });
  await browser.waitFor("!!document.querySelector('[aria-label=\"Passage coloured by result\"]')", 20_000);
});

test('60-second reference stays fixed through the final character and results share typing colors', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const browser = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { browser.ws.close(); proc.kill('SIGKILL'); });
  await browser.ready;
  await browser.send('Page.enable');
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 800, height: 900, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: new URL('/', URL_UNDER_TEST).href });
  const preview = "document.querySelector('.reference-preview p')?.textContent";
  const viewport = "document.querySelector('.typing-surface .overflow-hidden')";
  await browser.waitFor(`document.readyState === 'complete' && !!(${preview})`);
  await browser.evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent === '60s').click()");
  await browser.waitFor(`${preview}.length >= 1200`);
  const source = await browser.evaluate(preview);
  assert.equal(await browser.evaluate(`${viewport}.textContent`), source);
  await browser.evaluate("document.querySelector('[data-typing-input]').focus()");
  await browser.send('Input.insertText', { text: source.slice(0, -1) });
  await browser.waitFor(`${viewport}.scrollTop > 0`);
  assert.equal(await browser.evaluate(`${viewport}.textContent`), source);
  await browser.send('Input.insertText', { text: source.at(-1) });
  await browser.waitFor("!!document.querySelector('[aria-label=\"Passage coloured by result\"]')");
  await browser.waitFor("!!document.querySelector('table th.text-typing-correct')");
  const colors = await browser.evaluate(`Array.from(document.querySelectorAll('table tr')).map(row =>
    Array.from(row.cells).slice(1, 5).map(cell => getComputedStyle(cell).color))`);
  assert.equal(colors.length, 4); // Header, Words, Punctuation, All scored items.
  for (const row of colors) {
    assert.deepEqual(row, ['rgb(34, 197, 94)', 'rgb(255, 84, 84)', 'rgb(250, 204, 21)', 'rgb(255, 84, 84)']);
  }
  assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('stenotype:passages:v1')).length > 0"), true);
});

test('timed results collapse the unreached tail and keep genuine omissions marked', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const browser = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { browser.ws.close(); proc.kill('SIGKILL'); });
  await browser.ready;
  await browser.send('Page.enable');
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 800, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: new URL('/', URL_UNDER_TEST).href });
  const comparison = "document.querySelector('[aria-label=\"Passage coloured by result\"]')";
  const source = "document.querySelector('.reference-preview p')?.textContent";
  const screenshots = process.env.STENO_QA_SCREENSHOTS;
  const capture = async (name) => {
    if (!screenshots) return;
    await browser.evaluate("document.querySelector('table').scrollIntoView({block:'start',behavior:'instant'})");
    const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(screenshots, name + '.png'), Buffer.from(data, 'base64'));
  };
  await browser.waitFor(`document.readyState === 'complete' && !!(${source})`);
  await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent === '15s').click()");
  await browser.waitFor("document.querySelector('[data-typing-clock]').textContent === '0:15'");
  const reference = await browser.evaluate(source);
  const firstWords = reference.split(' ').slice(0, 3).join(' ');
  await browser.evaluate("document.querySelector('[data-typing-input]').focus()");
  await browser.send('Input.insertText', { text: firstWords });
  await browser.waitFor(`!!(${comparison})`, 20_000);
  const remaining = `Array.from((${comparison}).parentElement.querySelectorAll('details')).find(item => item.querySelector('summary')?.textContent.startsWith('Show remaining reference'))`;
  assert.equal(await browser.evaluate(`${remaining}.open`), false);
  assert.equal(await browser.evaluate(`${comparison}.querySelectorAll('.text-typing-missed').length`), 0);
  assert.equal(await browser.evaluate(`${comparison}.textContent + ${remaining}.querySelector('p').textContent`), reference);
  await capture('timed-attempt');
  await browser.evaluate(`${remaining}.querySelector('summary').click()`);
  assert.equal(await browser.evaluate(`${remaining}.open`), true);
  await capture('timed-expanded');

  await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim() === 'Try again').click()");
  await browser.waitFor(`!!(${source})`);
  const words = reference.split(' ');
  const skipped = words.slice(0, 9).filter((_, index) => index !== 2).join(' ');
  await browser.evaluate("document.querySelector('[data-typing-input]').focus()");
  await browser.send('Input.insertText', { text: skipped });
  await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim() === 'Submit').click()");
  await browser.waitFor(`!!(${comparison})`);
  assert.ok(await browser.evaluate(`${comparison}.querySelector('.text-typing-missed')?.textContent.trim()`));
  await capture('skipped-word');

  await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim() === 'Try again').click()");
  await browser.waitFor(`!!(${source})`);
  const match = /[A-Za-z]+/.exec(reference);
  assert.ok(match);
  const changed = match[0][0] === match[0][0].toUpperCase() ? match[0].toLowerCase() : match[0].toUpperCase();
  const changedReference = reference.slice(0, match.index) + changed + reference.slice(match.index + match[0].length);
  await browser.evaluate("document.querySelector('[data-typing-input]').focus()");
  await browser.send('Input.insertText', { text: changedReference + ' qqzz' });
  await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim() === 'Submit').click()");
  await browser.waitFor(`!!(${comparison})`);
  assert.equal(await browser.evaluate(`${comparison}.querySelector('.line-through')?.textContent`), 'qqzz');
  const wrong = `${comparison}.querySelector('button[aria-expanded=false]')`;
  await browser.waitFor(`!!(${wrong})`);
  const beforeLayout = await browser.evaluate(`(${comparison}).offsetTop + ':' + (${comparison}).clientHeight`);
  await browser.evaluate(`(${wrong}).focus()`);
  await browser.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  const detail = `document.getElementById((${comparison}).querySelector('button[aria-expanded=true]')?.getAttribute('aria-controls'))`;
  await browser.waitFor(`(${detail})?.textContent.includes(${JSON.stringify(changed)})`);
  assert.equal(await browser.evaluate(`(${comparison}).querySelectorAll('[role=status]').length`), 0);
  assert.equal(await browser.evaluate(`(${detail}).querySelectorAll('dd').length`), 2);
  assert.equal(await browser.evaluate(`(${comparison}).offsetTop + ':' + (${comparison}).clientHeight`), beforeLayout);
  const mistakeSummary = `Array.from((${comparison}).parentElement.querySelectorAll('summary')).find(item => item.textContent.startsWith('Review all mistakes'))`;
  const mistakeDetails = `(${mistakeSummary}).parentElement`;
  assert.equal(await browser.evaluate(`(${mistakeDetails}).open`), false);
  await browser.evaluate(`(${mistakeSummary}).click()`);
  await browser.waitFor(`(${mistakeDetails}).querySelectorAll('tbody tr').length === 2`);
  const rows = await browser.evaluate(`Array.from((${mistakeDetails}).querySelectorAll('tbody tr'), row => Array.from(row.cells, cell => cell.textContent.trim()))`);
  assert.deepEqual(rows, [[match[0], changed], ['Extra item', 'qqzz']]);
  assert.equal(await browser.evaluate(`(${comparison}).querySelector('button[aria-expanded=true]') !== null`), true);
  await capture('inline-corrections');

});

test('the mobile mistake table loads twenty rows at a time', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const browser = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { browser.ws.close(); proc.kill('SIGKILL'); });
  await browser.ready;
  await browser.send('Page.enable');
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 820, deviceScaleFactor: 1, mobile: true });
  await browser.send('Page.navigate', { url: URL_UNDER_TEST });
  const preview = "document.querySelector('.reference-preview p')?.textContent";
  await browser.waitFor(`document.readyState === 'complete' && !!(${preview})`);
  const reference = await browser.evaluate(preview);
  const incorrect = reference.replace(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g, word => 'z'.repeat(word.length));
  await browser.evaluate("document.querySelector('[data-typing-input]').focus()");
  await browser.send('Input.insertText', { text: incorrect });
  await browser.evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Submit').click()");
  const summary = "Array.from(document.querySelectorAll('summary')).find(item => item.textContent.startsWith('Review all mistakes'))";
  const rows = `(${summary}).parentElement.querySelectorAll('tbody tr').length`;
  await browser.waitFor(`!!(${summary})`);
  assert.equal(await browser.evaluate(rows), 0);
  await browser.evaluate(`(${summary}).click()`);
  await browser.waitFor(`${rows} === 20`);
  await browser.evaluate(`(${summary}).parentElement.querySelector('button').click()`);
  await browser.waitFor(`${rows} === 40`);
  assert.ok(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'));
});

test('typing underlines stop before separators in both themes', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const browser = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { browser.ws.close(); proc.kill('SIGKILL'); });
  await browser.ready;
  await browser.send('Page.enable');
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 960, deviceScaleFactor: 1, mobile: false });
  const screenshots = process.env.STENO_QA_SCREENSHOTS;
  const capture = async (name) => {
    if (!screenshots) return;
    const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(screenshots, name + '.png'), Buffer.from(data, 'base64'));
  };
  const excluded = "Array.from(document.querySelectorAll('.typing-wrong, .decoration-dashed.underline')).filter(span => /^\\s|\\s$/.test(span.textContent)).map(span => span.textContent)";
  const results = [];
  for (const theme of ['light', 'dark']) {
    await browser.send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-color-scheme', value: theme },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ] });
    await browser.send('Page.navigate', { url: new URL('/', URL_UNDER_TEST).href });
    const input = "document.querySelector('[data-typing-input]')";
    await browser.waitFor(`document.readyState === 'complete' && !!(${input})`);
    const reference = await browser.evaluate("document.querySelector('.reference-preview p').textContent");
    const words = reference.split(' ');
    const first = words[0];
    await browser.evaluate(`(${input}).focus()`);
    await browser.send('Input.insertText', { text: 'x'.repeat(first.length + 1) + words.slice(1, 11).join(' ') });
    await browser.waitFor("!!document.querySelector('.typing-wrong')");
    await capture('underline-live-' + theme);
    const live = await browser.evaluate(excluded);
    const text = words.slice(0, 14).map((word, index) => index === 0 ? 'zz' : word)
      .filter((_, index) => index !== 4).join(' ');
    await browser.evaluate(`(${input}).select()`);
    await browser.send('Input.insertText', { text });
    await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Submit').click()");
    await browser.waitFor("!!document.querySelector('[aria-label=\"Passage coloured by result\"] .typing-wrong')");
    const review = await browser.evaluate(excluded);
    const styles = await browser.evaluate(`Array.from(document.querySelectorAll('[aria-label="Passage coloured by result"] :is(.typing-wrong, .decoration-dashed.underline)'))
      .map(item => getComputedStyle(item).textDecorationStyle)`);
    await browser.evaluate("document.querySelector('[aria-label=\"Passage coloured by result\"]').scrollIntoView({ block: 'center' })");
    await capture('underline-review-' + theme);
    results.push({ theme, live, review, styles });
  }
  for (const result of results) {
    assert.deepEqual(result.live, [], result.theme + ' live decorated whitespace');
    assert.deepEqual(result.review, [], result.theme + ' review decorated whitespace');
    assert.ok(result.styles.includes('dotted') && result.styles.includes('dashed'), result.theme);
  }
});

test('custom practice preserves the applied passage when a draft is cancelled or modes change', { skip }, async (t) => {
  const { proc, page } = await launchChrome();
  const browser = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { browser.ws.close(); proc.kill('SIGKILL'); });
  await browser.ready;
  await browser.send('Page.enable');
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  // Exercise the real public typing component with a fixture for its
  // session status only. Protected routes and DB operations are not used.
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const request = window.fetch.bind(window);
    window.fetch = (input, ...options) => input === '/api/auth/get-session'
      ? Promise.resolve(Response.json({ user: { id: 'fixture', role: 'student', name: 'Practice student' } }))
      : request(input, ...options);
  ` });
  const button = label => `Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  const text = 'The clerk arranged the finance/legal documents before each witness entered the room.';
  const screenshots = process.env.STENO_QA_SCREENSHOTS;
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 750, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: new URL('/', URL_UNDER_TEST).href });
  await browser.waitFor("!!document.querySelector('button[aria-label=Custom]')");
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth'), 320);
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 750, deviceScaleFactor: 1, mobile: false });
  await browser.evaluate("document.querySelector('button[aria-label=Custom]').click()");
  await browser.waitFor("!!document.querySelector('#custom-passage-editor')");
  assert.ok(await browser.evaluate("document.querySelector('dialog button[aria-label=Close]').getBoundingClientRect().height >= 44"));
  await browser.evaluate("Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText() { return Promise.reject(new Error('Denied')); } } })");
  await browser.evaluate(`(${button('Paste from clipboard')}).click()`);
  await browser.waitFor("document.querySelector('dialog [role=status]')?.textContent.includes('Paste into the text field directly')");
  assert.equal(await browser.evaluate("document.activeElement.id"), 'custom-passage-editor');

  await browser.evaluate("document.querySelector('#custom-passage-editor').focus()");
  await browser.send('Input.insertText', { text });
  const capture = async (filename) => {
    if (!screenshots) return;
    const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(screenshots, filename), Buffer.from(data, 'base64'));
  };
  await capture('custom-editor.png');
  await browser.evaluate(`(${button('Start')}).click()`);
  await browser.waitFor(`!!(${button('Edit passage')})`);
  await browser.evaluate(`(${button('Edit passage')}).click()`);
  assert.equal(await browser.evaluate("document.querySelector('#custom-passage-editor').value"), text);
  await browser.evaluate(`(${button('Clear')}).click()`);
  await browser.evaluate("document.querySelector('dialog input[type=checkbox]').click()");
  await browser.evaluate(`(${button('Cancel')}).click()`);
  await browser.waitFor("!document.querySelector('dialog')");
  await browser.evaluate("document.querySelector('button[aria-label=Free]').click()");
  await browser.evaluate("document.querySelector('button[aria-label=Custom]').click()");
  await browser.waitFor("!!document.querySelector('[data-typing-input]') && !!document.querySelector('.typing-surface .overflow-hidden')");
  assert.equal(await browser.evaluate("document.querySelector('.typing-surface .overflow-hidden').textContent"), text);
  assert.match(await browser.evaluate("document.querySelector('[aria-label=\"Live typing statistics\"]').textContent"), /0\/13/);
  await capture('custom-workspace.png');
  await browser.evaluate("document.querySelector('[data-typing-input]').focus()");
  await browser.send('Input.insertText', { text });
  await browser.waitFor("!!document.querySelector('[aria-label=\"Passage coloured by result\"]')");
  assert.equal(await browser.evaluate("document.querySelector('[aria-label=\"Passage coloured by result\"]').textContent"), text);
  await capture('custom-result.png');

  await browser.evaluate(`(${button('Edit passage')}).click()`);
  await browser.evaluate("document.querySelector('dialog input[type=checkbox]').click()");
  await browser.evaluate(`(${button('Start')}).click()`);
  await browser.waitFor("!!document.querySelector('[data-typing-input]') && document.body.textContent.includes('Reference hidden')");
  const hidden = async () => {
    assert.equal(await browser.evaluate(`document.body.textContent.includes(${JSON.stringify(text)})`), false);
    assert.equal(await browser.evaluate("!!document.querySelector('.reference-preview') || document.body.textContent.includes('Preview prepared text')"), false);
    assert.ok(await browser.evaluate(`!!(${button('Edit passage')})`));
  };
  await hidden();
  assert.equal(await browser.evaluate("document.querySelector('[aria-label=\"Live typing statistics\"]').textContent.includes('Accuracy')"), false);
  await capture('custom-blind-ready.png');
  await browser.evaluate("document.querySelector('[data-typing-input]').focus()");
  await browser.send('Input.insertText', { text: 'The clerk arranged' });
  await hidden();
  assert.equal(await browser.evaluate("!!document.querySelector('.typing-surface .text-typing-correct, .typing-surface .typing-wrong')"), false);
  await browser.evaluate(`(${button('Submit')}).click()`);
  await browser.waitFor("!!document.querySelector('[aria-label=\"Passage coloured by result\"]')");
  assert.ok(await browser.evaluate(`!!(${button('Edit passage')})`));
  assert.equal(await browser.evaluate("!!document.querySelector('[aria-label=\"Live typing statistics\"]')"), false);
  assert.equal(await browser.evaluate("document.querySelector('details:has(summary)').open"), false);

});

test('admin filters and action popovers support keyboard and narrow viewports', {
  skip: skip || (!localStudent || process.env.STENO_DISPOSABLE_DB !== 'YES'
    || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD ? 'requires seeded loopback service' : false),
}, async (t) => {
  const origin = new URL(URL_UNDER_TEST).origin;
  const headers = { Origin: origin, 'Content-Type': 'application/json' };
  const signedIn = await fetch(origin + '/api/auth/sign-in/email', {
    method: 'POST', headers,
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  assert.equal(signedIn.status, 200);
  const cookie = signedIn.headers.getSetCookie().find(line => line.includes('better-auth.session_token=')).split(';')[0];
  const title = 'Administration toolbar fixture';
  const created = await fetch(origin + '/api/admin/dictations', {
    method: 'POST', headers: { ...headers, Cookie: cookie, 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ title, referenceTranscript: 'A transcript for the administration toolbar browser check.', category: 'LEGAL', status: 'DRAFT' }),
  });
  assert.equal(created.status, 201);
  const { dictation } = await created.json();
  t.after(() => fetch(origin + '/api/admin/dictations/' + dictation.id, { method: 'DELETE', headers: { ...headers, Cookie: cookie } }));

  const { proc, page } = await launchChrome();
  const cdp = connect(page.webSocketDebuggerUrl, t);
  t.after(() => { cdp.ws.close(); proc.kill('SIGKILL'); });
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  const listRequests = [];
  const loginRequests = [];
  cdp.ws.addEventListener('message', ({ data }) => {
    const event = JSON.parse(data);
    if (event.method === 'Network.requestWillBeSent' && new URL(event.params.request.url).pathname === '/api/admin/dictations') {
      listRequests.push(event.params.request.url);
    }
    if (event.method === 'Network.requestWillBeSent' && new URL(event.params.request.url).pathname === '/api/admin/login-history') {
      loginRequests.push(event.params.request.url);
    }
  });
  const [name, ...value] = cookie.split('=');
  await cdp.send('Network.setCookie', { name, value: value.join('='), url: origin });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 752, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: origin + '/admin/dictations' });
  const menuButton = 'document.querySelector(\'[aria-label="More actions for Administration toolbar fixture"]\')';
  await cdp.waitFor(`!!(${menuButton})`);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await cdp.evaluate(`(${menuButton}).getBoundingClientRect().right <= innerWidth`), true);

  const press = async (key) => {
    const windowsVirtualKeyCode = { Enter: 13, End: 35, Escape: 27 }[key];
    const event = { key, code: key, windowsVirtualKeyCode };
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...event });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event });
  };
  const openWithKeyboard = async (selector) => {
    const control = `document.querySelector(${JSON.stringify(selector)})`;
    await cdp.waitFor(`(${control})?.dataset.choiceReady === 'true'`);
    await cdp.evaluate(`(${control}).focus()`);
    await press('Enter');
    await cdp.waitFor("document.activeElement?.matches('[role=listbox] [role=option]')");
    await assertAnchored(cdp, control, '[role=listbox]');
  };
  await openWithKeyboard('[role=combobox][aria-label=Category]');
  assert.equal(listRequests.length, 0, 'first authorized page is rendered without a list API request');
  await press('End');
  await cdp.waitFor("document.activeElement?.textContent === 'General'");
  await press('Enter');
  await cdp.waitFor("document.querySelector('[role=combobox][aria-label=Category]').textContent.includes('General')");
  await cdp.waitFor(`!(${menuButton})`);
  await cdp.waitFor("performance.getEntriesByType('resource').some(entry => new URL(entry.name).searchParams.get('category') === 'GENERAL')");
  assert.ok(listRequests.some(url => new URL(url).searchParams.get('category') === 'GENERAL'));
  await cdp.evaluate("document.querySelector('[role=combobox][aria-label=Category]').click()");
  await cdp.waitFor("!!document.querySelector('[role=listbox]')");
  await cdp.evaluate("Array.from(document.querySelectorAll('[role=option]')).find(option => option.textContent === 'All categories').click()");
  await cdp.waitFor(`!!(${menuButton})`);

  await cdp.waitFor(`!(${menuButton}).disabled && !document.querySelector('[role=listbox]')`);
  await cdp.evaluate(`(${menuButton}).focus(); (${menuButton}).click()`);
  const popup = '.admin-row-actions:popover-open[data-positioned]';
  await cdp.waitFor(`!!document.querySelector('${popup}')`);
  await assertAnchored(cdp, menuButton, popup);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 752, deviceScaleFactor: 1, mobile: false });
  await cdp.waitFor(`Math.abs(document.querySelector('${popup}').getBoundingClientRect().right - (${menuButton}).getBoundingClientRect().right) < 2`);
  await assertAnchored(cdp, menuButton, popup);
  assert.equal(await cdp.evaluate("document.querySelector('.admin-row-actions:popover-open').textContent.includes('Delete unused dictation')"), true);
  await press('Escape');
  await cdp.waitFor("!document.querySelector('.admin-row-actions:popover-open')");
  assert.equal(await cdp.evaluate(`document.activeElement === (${menuButton})`), true);

  await cdp.send('Page.navigate', { url: origin + '/admin/login-history' });
  await cdp.waitFor("location.pathname === '/admin/login-history' && !!document.querySelector('tbody tr')");
  await openWithKeyboard('[aria-label=Outcome]');
  assert.equal(loginRequests.length, 0, 'login history renders its first page without calling the list API');
  await press('End');
  await cdp.waitFor("document.activeElement?.textContent === 'Failed'");
  await press('Enter');
  await cdp.waitFor("performance.getEntriesByType('resource').some(entry => new URL(entry.name).searchParams.get('success') === 'false')");

  const studentName = 'Disposable action menu fixture';
  const student = await fetch(origin + '/api/admin/students', {
    method: 'POST', headers: { ...headers, Cookie: cookie },
    body: JSON.stringify({ email: crypto.randomUUID() + '@example.test', name: studentName, password: 'local-browser-fixture-password' }),
  });
  assert.equal(student.status, 201);
  const { student: { id } } = await student.json();
  const deleteUrl = '/api/admin/students/' + id;
  t.after(() => fetch(origin + deleteUrl, { method: 'DELETE', headers: { ...headers, Cookie: cookie } }));
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 510, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: origin + '/admin/students' });
  await cdp.waitFor("document.querySelector('[aria-label=\"Access status\"]')?.dataset.choiceReady === 'true'");
  const studentMenu = `document.querySelector('[aria-label="More actions for ${studentName}"]')`;
  await cdp.evaluate(`(${studentMenu}).scrollIntoView({block:'end'}); (${studentMenu}).focus(); (${studentMenu}).click()`);
  await cdp.waitFor(`!!document.querySelector('${popup}')`);
  await assertAnchored(cdp, studentMenu, popup);
  assert.ok(await cdp.evaluate(`document.querySelector('${popup}').getBoundingClientRect().bottom < (${studentMenu}).getBoundingClientRect().top`), 'menu flips above a low trigger');

  const initialTop = await cdp.evaluate(`(${studentMenu}).getBoundingClientRect().top`);
  await cdp.evaluate('scrollBy(0, -40)');
  await cdp.waitFor(`(${studentMenu}).getBoundingClientRect().top > ${initialTop} + 10`);
  await cdp.waitFor(`Math.abs(document.querySelector('${popup}').getBoundingClientRect().bottom - (${studentMenu}).getBoundingClientRect().top) <= 14`);
  await assertAnchored(cdp, studentMenu, popup);

  const nextEvent = (method) => new Promise(resolve => {
    const listener = ({ data }) => {
      const event = JSON.parse(data);
      if (event.method !== method) return;
      cdp.ws.removeEventListener('message', listener);
      resolve(event.params);
    };
    cdp.ws.addEventListener('message', listener);
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' + deleteUrl, requestStage: 'Response' }] });
  const paused = nextEvent('Fetch.requestPaused');
  const confirmation = nextEvent('Page.javascriptDialogOpening');
  const click = cdp.evaluate("Array.from(document.querySelectorAll('.admin-row-actions:popover-open button')).find(button => button.textContent === 'Delete unused account').click()");
  await confirmation;
  await cdp.send('Page.handleJavaScriptDialog', { accept: true });
  await click;
  const { requestId, responseStatusCode, request } = await paused;
  assert.equal(request.method, 'DELETE');
  assert.equal(responseStatusCode, 200);
  await cdp.waitFor("Array.from(document.querySelectorAll('[role=status]')).some(node => node.textContent === 'Deleting account…')");
  assert.ok(await cdp.evaluate(`!!(${studentMenu})`), 'student remains until deletion is confirmed in the browser');
  await cdp.send('Fetch.continueResponse', { requestId });
  await cdp.send('Fetch.disable');
  await cdp.waitFor(`!(${studentMenu}) && document.body.textContent.includes(${JSON.stringify(studentName + ' deleted.')})`);

});
