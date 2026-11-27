import test from 'node:test';
import assert from 'node:assert/strict';

import { rateLimitConfig } from '../lib/auth-config.ts';
import { poolConfig } from '../lib/db-config.ts';
import { messageFrom } from '../lib/auth-errors.ts';

// ─────────────────────────────────────────────────────────────
// Regression guards for the "site hangs / sign-out doesn't work"
// outage. Each of these tests encodes a bug that shipped once.
// ─────────────────────────────────────────────────────────────

test('rate limiting uses memory storage, never the database', () => {
  // 'database' storage runs an interactive Prisma transaction on
  // every auth request (adapter `incrementOne` -> db.$transaction).
  // Under load that exhausts the pg pool and Prisma throws P2028,
  // so /get-session returns 500 and sign-out returns 500 — with no
  // Set-Cookie, which leaves the user logged in.
  assert.equal(rateLimitConfig.storage, 'memory');
});

test('session checks and sign-out are exempt from rate limiting', () => {
  // A 429 on /get-session is indistinguishable from "logged out".
  // A 429 on /sign-out means the cookie is never cleared.
  assert.equal(rateLimitConfig.customRules['/get-session'], false);
  assert.equal(rateLimitConfig.customRules['/sign-out'], false);
});

test('sign-in keeps a real rate limit', () => {
  assert.ok(Number(rateLimitConfig.window) > 0, 'window must be set');
  assert.ok(Number(rateLimitConfig.max) > 0, 'max must be set');
});

test('pg pool is bounded so Prisma cannot starve for a connection', () => {
  assert.equal(typeof poolConfig.max, 'number');
  assert.ok(
    poolConfig.max >= 1 && poolConfig.max <= 10,
    `pool max must be small (got ${poolConfig.max})`
  );
  assert.ok(
    poolConfig.connectionTimeoutMillis > 0,
    'a connection timeout must be set'
  );
  assert.equal(
    poolConfig.allowExitOnIdle,
    true,
    'serverless instances must be able to exit'
  );
});

test('messageFrom reads Better Auth "message", not "error"', () => {
  // The sign-in form used to read data.error, so a 429 lockout was
  // shown as "Invalid email or password" and people kept retrying.
  assert.equal(
    messageFrom(
      { message: 'Too many requests. Please try again later.', code: 'X' },
      'fallback'
    ),
    'Too many requests. Please try again later.'
  );
  assert.equal(
    messageFrom({ error: 'Invalid email or password' }, 'fallback'),
    'fallback',
    'a legacy "error" key must not be trusted'
  );
});

test('messageFrom falls back for empty or malformed payloads', () => {
  assert.equal(messageFrom(null, 'fallback'), 'fallback');
  assert.equal(messageFrom(undefined, 'fallback'), 'fallback');
  assert.equal(messageFrom({ message: '   ' }, 'fallback'), 'fallback');
  assert.equal(messageFrom('not-an-object', 'fallback'), 'fallback');
});

test('Neon runtime verifies peer and hostname regardless of legacy URL mode', async () => {
  const { runtimeDatabaseUrl } = await import('../lib/db-config.ts');
  const raw = 'postgresql://example.neon.tech/app?sslmode=require&sslrootcert=test-ca';
  const result = new URL(runtimeDatabaseUrl(raw));
  assert.equal(result.searchParams.get('sslmode'), 'verify-full');
  assert.equal(result.searchParams.get('sslrootcert'), 'test-ca');
  assert.equal(runtimeDatabaseUrl('postgresql://localhost/dev'), 'postgresql://localhost/dev');
});
