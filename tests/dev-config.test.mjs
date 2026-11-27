import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDevConfig, checkLedger, verificationHost } from '../scripts/dev-config.mjs';
import { exactOrigin } from '../lib/auth-origins.ts';
import { signInFailure } from '../lib/auth-errors.ts';

const local = {
  DATABASE_URL: `postgresql://user:placeholder@${verificationHost}/app?sslmode=require`,
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'x'.repeat(64),
};

test('dev refuses missing secrets, conflicting shell values and unsafe database targets', () => {
  assert.throws(() => checkDevConfig({ ...local, BETTER_AUTH_SECRET: '' }, {}), /Set BETTER_AUTH_SECRET/);
  assert.throws(() => checkDevConfig(local, { DATABASE_URL: 'do-not-print' }), {
    message: 'Exported DATABASE_URL conflicts with .env.local. Run set -e DATABASE_URL in fish or remove its startup export.',
  });
  assert.throws(() => checkDevConfig({ ...local, DATABASE_URL: 'postgres://user:password@other.example/app' }, {}), /verification host/);
  assert.throws(() => checkDevConfig({ ...local, DATABASE_URL: local.DATABASE_URL + '&host=other.example' }, {}), /verification host/);
});

test('dev validates localhost port and exact LAN or HTTPS tunnel origins', () => {
  assert.equal(checkDevConfig(local, {}).port, 3000);
  assert.throws(() => checkDevConfig({ ...local, BETTER_AUTH_URL: 'http://localhost:3101' }, {}), /port must match/);
  assert.throws(() => checkDevConfig(local, { PORT: '3101' }), /PORT conflicts/);
  assert.equal(checkDevConfig({ ...local, STENO_DEV_TRUSTED_ORIGINS: 'http://192.168.1.4:3000' }, {}).origins.length, 2);
  assert.equal(checkDevConfig({ ...local, BETTER_AUTH_URL: 'https://test-3000.example.dev' }, {}).port, 3000);
  assert.throws(() => checkDevConfig({ ...local, STENO_DEV_TRUSTED_ORIGINS: 'https://*.example.dev' }, {}), /exact HTTP/);
  assert.equal(exactOrigin('https://example.dev/login'), undefined);
  assert.equal(exactOrigin('https://example.dev/'), 'https://example.dev');
});

test('ledger refuses pending, unfinished, unknown and modified migrations', () => {
  const expected = new Map([['initial', 'digest']]);
  const row = { migration_name: 'initial', checksum: 'digest', finished_at: new Date(), rolled_back_at: null };
  checkLedger(expected, [row]);
  assert.throws(() => checkLedger(expected, []), /pending/);
  assert.throws(() => checkLedger(expected, [{ ...row, finished_at: null }]), /unfinished/);
  assert.throws(() => checkLedger(expected, [{ ...row, checksum: 'wrong' }]), /mismatched/);
  assert.throws(() => checkLedger(expected, [row, { ...row, migration_name: 'unexpected' }]), /unknown/);
});

test('login failures distinguish status without reflecting server messages', () => {
  const data = { message: 'internal secret information' };
  assert.match(signInFailure(401, data), /Invalid email or password/);
  assert.match(signInFailure(403, data), /blocked/);
  assert.match(signInFailure(429, data), /Too many/);
  assert.match(signInFailure(500, data), /temporarily unavailable/);
  assert.match(signInFailure(503, { code: 'AUTH_DATABASE_SCHEMA' }), /database setup/);
});
