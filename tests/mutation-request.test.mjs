import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, rejectCrossOriginMutation } from '../lib/mutation-request.ts';
import { isPublicAuthPath } from '../lib/auth-config.ts';

test('only the application auth entry points are public', () => {
  assert.equal(isPublicAuthPath('/api/auth/sign-in/email'), true);
  assert.equal(isPublicAuthPath('/api/auth/get-session'), true);
  assert.equal(isPublicAuthPath('/api/auth/sign-out/'), true);
  assert.equal(isPublicAuthPath('/api/auth/admin/ban-user'), false);
  assert.equal(isPublicAuthPath('/api/auth/sign-up/email'), false);
});

test('cross-site browser mutations are rejected', () => {
  const request = new Request('https://example.test/api/attempts', {
    method: 'POST',
    headers: { 'sec-fetch-site': 'cross-site' },
  });
  assert.equal(rejectCrossOriginMutation(request)?.status, 403);
});

test('JSON limit measures bytes and rejects other media types', async () => {
  const request = (body, type) => new Request('https://example.test/api', {
    method: 'POST',
    body,
    headers: { 'content-type': type },
  });
  const body = '{"字":"✓"}';
  assert.deepEqual(await readJson(request(body, 'application/json; charset=utf-8'), 20), {
    ok: true, data: { 字: '✓' },
  });
  assert.equal((await readJson(request(body, 'application/json'), body.length)).response.status, 413);
  assert.equal((await readJson(request(body, 'text/plain'), 20)).response.status, 415);
  assert.equal((await readJson(request('{', 'application/json'), 20)).response.status, 400);
});

test('development accepts exact approved origins and production ignores the development allowlist', () => {
  const keys = ['NODE_ENV', 'BETTER_AUTH_URL', 'STENO_DEV_TRUSTED_ORIGINS'];
  const before = keys.map(key => process.env[key]);
  try {
    process.env.NODE_ENV = 'development';
    process.env.BETTER_AUTH_URL = 'https://canonical.example';
    process.env.STENO_DEV_TRUSTED_ORIGINS = 'https://tunnel.example';
    const mutation = (origin, mode = 'same-origin') => new Request('http://localhost:3000/api/attempts', {
      method: 'POST',
      headers: { origin, 'sec-fetch-site': mode, 'x-forwarded-host': 'attacker.example' },
    });
    assert.equal(rejectCrossOriginMutation(mutation('https://tunnel.example')), null);
    assert.equal(rejectCrossOriginMutation(mutation('https://tunnel.example.attacker.example'))?.status, 403);
    assert.equal(rejectCrossOriginMutation(mutation('https://tunnel.example', 'cross-site'))?.status, 403);
    process.env.NODE_ENV = 'production';
    assert.equal(rejectCrossOriginMutation(mutation('https://tunnel.example'))?.status, 403);
    assert.equal(rejectCrossOriginMutation(mutation('https://canonical.example')), null);
  } finally {
    keys.forEach((key, index) => {
      if (before[index] === undefined) delete process.env[key];
      else process.env[key] = before[index];
    });
  }
});
