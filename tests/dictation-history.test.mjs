import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('attempt history filters legacy rows before loading the required relation', () => {
  for (const page of [
    'app/admin/page.tsx',
    'app/admin/results/page.tsx',
    'app/student/dashboard/page.tsx',
    'app/student/results/page.tsx',
    'app/api/student/attempts/route.ts',
  ]) {
    assert.match(source(page), /where:\s*(?:attemptWhere|\{[^}]*dictationAttemptsWhere)/, page);
  }
  assert.match(source('app/admin/page.tsx'), /attempt\.dictation\?\.title/);
  assert.match(source('lib/dictation-history.ts'), /dictation:\s*\{\s*is:\s*\{\s*status:/);
});
