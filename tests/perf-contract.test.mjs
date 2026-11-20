import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/*
 * Performance contract.
 *
 * These are structural guards for the expensive regressions that are
 * easy to reintroduce: a second session read per page, a client-side
 * session fetch on protected pages, an eager dictation request, and
 * duplicated admin auth boilerplate.
 *
 * They read source files on purpose — the behaviour is "how many round
 * trips does a page make", which a unit test cannot observe directly.
 */

const read = (path) => fs.readFileSync(path, 'utf8');

test('getCurrentUser does not run a second user query', () => {
  const source = read('lib/session.ts');
  // No database client at all in this module any more.
  assert.doesNotMatch(source, /from '\.\/db'/);
  assert.doesNotMatch(source, /await db\./);
});

test('the home page does not read the session on the server', () => {
  const source = read('app/(public)/page.tsx');
  assert.doesNotMatch(source, /getSession/);
  assert.doesNotMatch(source, /async function/);
});

test('protected layouts seed the client provider from the server session', () => {
  for (const path of ['app/student/layout.tsx', 'app/admin/layout.tsx']) {
    const source = read(path);
    assert.match(source, /initialUser=/, path);
  }
});

test('the provider skips its fetch when seeded', () => {
  const source = read('lib/auth-provider.tsx');
  assert.match(source, /if \(seeded\) return;/);
});

test('dictation metadata is fetched lazily, not on mount', () => {
  const source = read('components/typing/typing-client.tsx');
  assert.match(source, /mode !== 'dictation'/);
  assert.match(source, /dictationsState/);
});

test('admin routes share one auth gate', () => {
  const files = [
    'app/api/admin/dictations/route.ts',
    'app/api/admin/dictations/[id]/route.ts',
    'app/api/admin/students/route.ts',
    'app/api/admin/students/[id]/route.ts',
    'app/api/admin/users/[id]/ban/route.ts',
    'app/api/admin/login-history/route.ts',
  ];
  for (const path of files) {
    assert.match(read(path), /requireAdmin/, path);
    assert.doesNotMatch(read(path), /auth\.api\.getSession/, path);
  }
});

test('the attempt endpoint enforces one profile lookup through the guard', () => {
  const source = read('app/api/attempts/route.ts');
  assert.match(source, /requireStudent/);
  assert.doesNotMatch(source, /studentProfile\.findUnique/);
});
