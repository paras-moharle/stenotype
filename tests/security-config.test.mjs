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
