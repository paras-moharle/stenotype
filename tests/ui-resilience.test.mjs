import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/*
 * A failed query must not replace the whole app with Next's generic
 * error page. Each protected area needs its own boundary.
 */

test('student and admin areas have error boundaries', () => {
  for (const path of ['app/student/error.tsx', 'app/admin/error.tsx']) {
    assert.ok(fs.existsSync(path), `${path} is missing`);
    const source = fs.readFileSync(path, 'utf8');
    assert.match(source, /'use client'/, path);
    assert.match(source, /reset/, path);
  }
});

test('admin tables show an empty state instead of a blank table', () => {
  for (const path of [
    'app/admin/students/students-client.tsx',
    'app/admin/dictations/dictations-client.tsx',
  ]) {
    const source = fs.readFileSync(path, 'utf8');
    assert.match(source, /AdminEmptyState/, path);
    assert.match(source, /filtered\.length === 0/, path);
  }
});
