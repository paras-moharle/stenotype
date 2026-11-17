import test from 'node:test';
import assert from 'node:assert/strict';

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
