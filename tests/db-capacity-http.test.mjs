import test from 'node:test';
import assert from 'node:assert/strict';

const url = process.env.STENO_CAPACITY_TEST_URL;
const enabled = url && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
  && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD;

test('restricted database capacity blocks growth while sign-in and logout work', {
  skip: enabled ? false : 'requires a second loopback server configured at 80% and test admin credentials',
}, async () => {
  const headers = { Origin: new URL(url).origin, 'Content-Type': 'application/json' };
  const signIn = await fetch(url + '/api/auth/sign-in/email', {
    method: 'POST', headers,
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  assert.equal(signIn.status, 200);
  const cookie = signIn.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ');
  const blocked = await fetch(url + '/api/admin/dictations', {
    method: 'POST', headers: { ...headers, cookie },
    body: JSON.stringify({ title: 'Capacity test', category: 'GENERAL', referenceTranscript: 'Temporary draft.' }),
  });
  assert.equal(blocked.status, 503);
  assert.match((await blocked.json()).error, /not saved/i);
  const signOut = await fetch(url + '/api/auth/sign-out', { method: 'POST', headers: { ...headers, cookie } });
  assert.equal(signOut.status, 200);
});
