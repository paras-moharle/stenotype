import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { rateLimitConfig, signUpPolicy } from '../lib/auth-config.ts';

/*
 * Access-control configuration. These are the switches that stop someone
 * from creating their own account and using the site for free.
 */

test('public self-registration is disabled', () => {
  assert.equal(signUpPolicy.disableSignUp, true);
});

test('the auth config actually applies the sign-up policy', () => {
  const source = fs.readFileSync('lib/auth.ts', 'utf8');
  assert.match(source, /\.\.\.signUpPolicy/);
});

test('rate limiting stays in memory (database storage hung the site)', () => {
  assert.equal(rateLimitConfig.storage, 'memory');
});

test('session checks and sign-out are never rate limited', () => {
  assert.equal(rateLimitConfig.customRules?.['/get-session'], false);
  assert.equal(rateLimitConfig.customRules?.['/sign-out'], false);
});

test('the attempt endpoint is rate limited in code', () => {
  const source = fs.readFileSync('app/api/attempts/route.ts', 'utf8');
  assert.match(source, /checkRateLimit/);
  assert.match(source, /requireStudent/);
});

test('the student guard blocks every non-active profile, not just suspended', () => {
  const source = fs.readFileSync('lib/api-guard.ts', 'utf8');
  assert.match(source, /profile\.status !== 'ACTIVE'/);
  assert.doesNotMatch(source, /profile\.status === 'SUSPENDED'/);
});

test('revoking sessions returns 404 for an unknown user', () => {
  const source = fs.readFileSync(
    'app/api/admin/users/[id]/revoke-sessions/route.ts',
    'utf8'
  );
  assert.match(source, /user\.findUnique/);
  assert.match(source, /status: 404/);
});

test('the unused transcript endpoint stays removed', () => {
  assert.equal(
    fs.existsSync('app/api/dictations/[id]/transcript/route.ts'),
    false
  );
});

test('the app ships a CSP report-only policy and hides the framework header', () => {
  const source = fs.readFileSync('next.config.ts', 'utf8');
  assert.match(source, /Content-Security-Policy-Report-Only/);
  assert.match(source, /poweredByHeader:\s*false/);
  assert.match(source, /object-src 'none'/);
  assert.match(source, /frame-ancestors 'self'/);
});

test('HTTP auth does not expose the generic admin management surface', () => {
  const source = fs.readFileSync('app/api/[...all]/route.ts', 'utf8');
  assert.match(source, /isPublicAuthPath/);
  assert.match(source, /status: 404/);
});

test('logout fallback preserves upstream status and reports exceptions', () => {
  const source = fs.readFileSync('app/api/logout/route.ts', 'utf8');
  assert.match(source, /status: response\.status/);
  assert.match(source, /status: 503/);
});
