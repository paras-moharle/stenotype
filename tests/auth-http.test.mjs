import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

/**
 * End-to-end auth smoke test against a running server.
 *
 * Skipped by default. Run it against a production build:
 *
 *   NODE_ENV=production pnpm build
 *   NODE_ENV=production pnpm start &
 *   SMOKE_BASE_URL=http://localhost:3000 \
 *   SMOKE_EMAIL=you@example.com \
 *   SMOKE_PASSWORD=your-password \
 *   pnpm test:smoke
 *
 * It signs in, checks the session, signs out, and asserts the session
 * is actually dead afterwards. That last assertion is the one that
 * would have caught the P2028 sign-out outage: a failed sign-out
 * leaves the session alive even though the UI redirects to /login.
 */
const base = process.env.SMOKE_BASE_URL?.replace(/\/+$/, '');
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

const skip =
  !base || !email || !password
    ? 'set SMOKE_BASE_URL, SMOKE_EMAIL and SMOKE_PASSWORD to run'
    : false;

// Better Auth allows three sign-ins in a ten-second window per IP.
async function waitForSignInWindow(response) {
  if (response.status !== 429) return false;
  const seconds = Number(response.headers.get('x-retry-after') ?? NaN);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 10) return false;
  await delay(seconds * 1000 + 150);
  return true;
}

const cookieHeader = (headers) =>
  headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');

// Better Auth rejects state-changing requests that arrive without an
// Origin header (CSRF protection). Browsers always send one, so the
// test must too.
const jsonHeaders = {
  'Content-Type': 'application/json',
  Origin: base,
};

test('sign-out clears the cookie and kills the session', { skip }, async () => {
  // 1. Sign in.
  const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  });
  assert.equal(signIn.status, 200, `sign-in returned ${signIn.status}`);

  const cookie = cookieHeader(signIn.headers);
  assert.match(cookie, /better-auth\.session_token=/, 'no session cookie set');

  // 2. The session is alive.
  const before = await fetch(`${base}/api/auth/get-session`, {
    headers: { cookie },
  });
  assert.equal(before.status, 200, 'get-session failed');
  assert.ok((await before.json())?.user, 'session should exist after sign-in');

  // 3. Sign out the same way the browser does (JSON body + header).
  const signOut = await fetch(`${base}/api/auth/sign-out`, {
    method: 'POST',
    headers: { ...jsonHeaders, cookie },
    body: '{}',
  });
  assert.equal(
    signOut.status,
    200,
    'sign-out must not return 415 (missing Content-Type) or 500 (P2028)'
  );
  assert.match(
    signOut.headers.getSetCookie().join('\n'),
    /better-auth\.session_token=;/,
    'sign-out must send a Set-Cookie that clears the session token'
  );

  // 4. The session is dead — this is what "logout is broken" means.
  const after = await fetch(`${base}/api/auth/get-session`, {
    headers: { cookie },
  });
  assert.equal(after.status, 200, 'get-session failed after sign-out');
  assert.equal(await after.json(), null, 'session survived sign-out');
});

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const localSuite = !skip && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname);

test('local admin policy, provisioning and idempotent dictation history', {
  skip: !localSuite || !adminEmail || !adminPassword ? 'requires seeded loopback CI credentials' : false,
}, async () => {
  async function call(path, { method = 'GET', cookie, body } = {}) {
    return fetch(`${base}${path}`, {
      method,
      redirect: 'manual',
      headers: { ...(method === 'GET' ? {} : jsonHeaders), ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  async function signInResponse(email, password) {
    const request = () => call('/api/auth/sign-in/email', { method: 'POST', body: { email, password } });
    let response = await request();
    if (await waitForSignInWindow(response)) response = await request();
    return response;
  }

  async function signIn(email, password) {
    const response = await signInResponse(email, password);
    assert.equal(response.status, 200);
    return cookieHeader(response.headers);
  }

  const wrongOrigin = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST', headers: { ...jsonHeaders, Origin: 'https://invalid.example' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await signInResponse(adminEmail, 'incorrect-ci-password')).status, 401);
  const admin = await signIn(adminEmail, adminPassword);
  assert.equal((await call('/admin', { cookie: admin })).status, 200);
  assert.equal((await call('/api/auth/admin/list-users', { cookie: admin })).status, 404);

  const adminSession = await call('/api/auth/get-session', { cookie: admin });
  const adminIdentity = (await adminSession.json()).user;
  assert.equal((await call(`/api/admin/users/${adminIdentity.id}/ban`, {
    method: 'POST', cookie: admin, body: { banned: true },
  })).status, 400);

  const email = `practice-${crypto.randomUUID()}@example.test`;
  const password = 'local-only-test-password';
  const created = await call('/api/admin/students', {
    method: 'POST', cookie: admin, body: { email, password, name: 'Practice Test' },
  });
  assert.equal(created.status, 201);
  const { student } = await created.json();
  const duplicateStudent = await call('/api/admin/students', {
    method: 'POST', cookie: admin, body: { email, password, name: 'Practice Test' },
  });
  assert.equal(duplicateStudent.status, 409);
  const studentCookie = await signIn(email, password);
  assert.equal((await call('/api/admin/students', { cookie: studentCookie })).status, 403);
  assert.equal((await call('/student/dashboard', { cookie: studentCookie })).status, 200);

  const transcript = 'Alpha beta gamma delta.';
  const published = await call('/api/admin/dictations', {
    method: 'POST',
    cookie: admin,
    body: { title: 'CI dictation', category: 'GENERAL', referenceTranscript: transcript, status: 'PUBLISHED', youtubeId: 'dQw4w9WgXcQ', durationSeconds: 198 },
  });
  assert.equal(published.status, 201);
  const { dictation } = await published.json();
  const metadata = await call(`/api/dictations?id=${dictation.id}`, { cookie: studentCookie });
  assert.equal(metadata.status, 200);
  const { dictation: selected } = await metadata.json();
  assert.equal(selected.id, dictation.id);
  assert.equal(Object.hasOwn(selected, 'referenceTranscript'), false);
  const catalog = await call('/student/dictations?q=CI+dictation', { cookie: studentCookie });
  assert.equal(catalog.status, 200);
  const catalogHtml = await catalog.text();
  assert.ok(catalogHtml.includes(`/student/results?dictationId=${dictation.id}`));
  assert.match(catalogHtml, /youtube\.com\/watch\?v=dQw4w9WgXcQ/);
  assert.match(catalogHtml, /View dictation/);
  assert.ok(catalogHtml.includes(`/student/typing?mode=dictation&amp;dictationId=${dictation.id}`));
  assert.ok(!catalogHtml.includes(transcript));
  const practice = await call(`/student/typing?mode=dictation&dictationId=${dictation.id}`, { cookie: studentCookie });
  assert.equal(practice.status, 200);
  const practiceHtml = await practice.text();
  // The browser suite checks the selected title after client hydration.
  assert.ok(!practiceHtml.includes(transcript));
  const studyPath = `/api/dictations/${dictation.id}/study`;
  assert.equal((await call(studyPath)).status, 401);
  const study = await call(studyPath, { cookie: studentCookie });
  assert.equal(study.status, 200);
  assert.match(study.headers.get('cache-control'), /no-store/);
  const studyData = await study.json();
  assert.equal(studyData.transcript, transcript);
  assert.deepEqual(studyData.dictation, selected);

  const body = {
    passageId: dictation.id, typed: transcript, elapsedMs: 60_000, submissionKey: crypto.randomUUID(),
  };
  const posts = await Promise.all([1, 2].map(() =>
    call('/api/attempts', { method: 'POST', cookie: studentCookie, body })
  ));
  assert.deepEqual(posts.map((response) => response.status), [200, 200]);
  const [result, duplicate] = await Promise.all(posts.map((response) => response.json()));
  assert.equal(result.attemptId, duplicate.attemptId);
  assert.equal(result.score.accuracy, 100);

  const editorRead = await call(`/api/admin/dictations/${dictation.id}`, { cookie: admin });
  const editorVersion = (await editorRead.json()).dictation.updatedAt;
  const edit = await call(`/api/admin/dictations/${dictation.id}`, {
    method: 'PUT', cookie: admin, body: { referenceTranscript: 'An updated practice passage.', youtubeId: 'abcdefghijk' },
  });
  assert.equal(edit.status, 200);
  assert.equal((await edit.json()).dictation.durationSeconds, null);
  const stale = await call(`/api/admin/dictations/${dictation.id}`, {
    method: 'PUT', cookie: admin, body: { title: 'Stale draft', expectedUpdatedAt: editorVersion },
  });
  assert.equal(stale.status, 409);
  const retry = await call('/api/attempts', { method: 'POST', cookie: studentCookie, body });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).reference, transcript);
  // The first two replies and the immutable-reference replay used three
  // slots. Saturate the normal per-process budget using the original key.
  for (let index = 0; index < 27; index++) {
    const replay = await call('/api/attempts', { method: 'POST', cookie: studentCookie, body });
    assert.equal(replay.status, 200);
  }
  const limited = await call('/api/attempts', {
    method: 'POST', cookie: studentCookie, body: { ...body, submissionKey: crypto.randomUUID() },
  });
  assert.equal(limited.status, 429);
  for (let index = 0; index < 3; index++) {
    const recovered = await call('/api/attempts', { method: 'POST', cookie: studentCookie, body });
    assert.equal(recovered.status, 200);
    assert.equal((await recovered.json()).attemptId, result.attemptId);
  }
  assert.equal((await call('/api/attempts', { method: 'POST', cookie: studentCookie, body })).status, 429);

  const otherStudent = await signIn(process.env.SMOKE_EMAIL, process.env.SMOKE_PASSWORD);
  const otherHistory = await call(`/api/student/attempts?dictationId=${dictation.id}`, { cookie: otherStudent });
  assert.deepEqual((await otherHistory.json()).attempts, []);
  const otherDetail = await call(`/student/results/${result.attemptId}`, { cookie: otherStudent });
  if (otherDetail.status === 200) {
    // Next.js can stream the not-found boundary after sending HTTP 200.
    assert.match(await otherDetail.text(), /Page not found/);
  } else {
    assert.equal(otherDetail.status, 404);
  }

  const history = await call(`/api/student/attempts?dictationId=${dictation.id}`, { cookie: studentCookie });
  assert.equal((await history.json()).attempts.length, 1);

  const unpublish = await call(`/api/admin/dictations/${dictation.id}`, {
    method: 'PUT', cookie: admin, body: { status: 'DRAFT' },
  });
  assert.equal(unpublish.status, 200);
  assert.equal((await call(studyPath, { cookie: studentCookie })).status, 404);
  assert.equal((await call(`/api/dictations?id=${dictation.id}`, { cookie: studentCookie })).status, 404);

  const status = await call(`/api/admin/students/${student.id}`, {
    method: 'PUT', cookie: admin, body: { status: 'INACTIVE' },
  });
  assert.equal(status.status, 200);
  assert.equal((await call('/api/dictations', { cookie: studentCookie })).status, 403);
  assert.equal((await call('/api/student/attempts', { cookie: studentCookie })).status, 403);
  assert.match((await call('/student/dashboard', { cookie: studentCookie })).headers.get('location'), /\/login\?denied=1/);

  const studentIdentity = (await (await call('/api/auth/get-session', { cookie: studentCookie })).json()).user;
  const studentAccount = `/api/admin/users/${studentIdentity.id}`;
  const activation = await call(`/api/admin/students/${student.id}`, {
    method: 'PUT', cookie: admin, body: { status: 'ACTIVE' },
  });
  assert.equal(activation.status, 200);
  assert.equal((await call('/api/student/attempts', { cookie: studentCookie })).status, 200);

  const revoked = await call(`${studentAccount}/revoke-sessions`, { method: 'POST', cookie: admin });
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).revoked, 1);
  assert.equal((await call('/api/dictations', { cookie: studentCookie })).status, 401);

  const newCookie = await signIn(email, password);
  const ban = await call(`${studentAccount}/ban`, { method: 'POST', cookie: admin, body: { banned: true } });
  assert.equal(ban.status, 200);
  assert.equal((await call('/api/dictations', { cookie: newCookie })).status, 401);
  const blockedSignIn = await signInResponse(email, password);
  assert.equal(blockedSignIn.status, 403);
  const unban = await call(`${studentAccount}/ban`, { method: 'POST', cookie: admin, body: { banned: false } });
  assert.equal(unban.status, 200);
  assert.ok(await signIn(email, password));
});

test('concurrent local sign-ins leave one usable session', { skip: !localSuite ? 'requires a loopback URL and seeded student credentials' : false }, async () => {
  const requestPair = () => Promise.all([1, 2].map(() => fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  })));
  let attempts = await requestPair();
  const limited = attempts.find(response => response.status === 429);
  if (limited && await waitForSignInWindow(limited)) {
    attempts = await requestPair();
  }
  const cookies = attempts.filter((response) => response.ok).map((response) => cookieHeader(response.headers));
  assert.equal(cookies.length, 2);
  const sessions = await Promise.all(cookies.map(async (cookie) => {
    const response = await fetch(`${base}/api/auth/get-session`, { headers: { cookie } });
    assert.equal(response.status, 200);
    return (await response.json())?.user;
  }));
  assert.equal(sessions.filter(Boolean).length, 1);
});
