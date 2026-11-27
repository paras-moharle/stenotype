import test from 'node:test';
import assert from 'node:assert/strict';
import { readCapacityPolicy, capacityLevel } from '../lib/db-operational-policy.ts';
import { readFileSync } from 'node:fs';

test('capacity uses inclusive thresholds and conservative defaults', () => {
  assert.deepEqual([49.9, 50, 70, 80].map((percent) => capacityLevel(percent)),
    ['normal', 'warning', 'urgent', 'restricted']);
  const policy = readCapacityPolicy({
    DB_CAPACITY_WARN_PERCENT: '81', DB_CAPACITY_RESTRICT_PERCENT: '80',
    DB_PROJECT_USAGE_PERCENT: '82', DB_STORAGE_BUDGET_BYTES: 'NaN',
  });
  assert.equal(policy.budget, 1_000_000_000);
  assert.equal(policy.thresholds.warn, 50);
  assert.equal(capacityLevel(policy.projectPercent, policy.thresholds), 'restricted');
});

test('reference backfill uses exact UTF-8 bytes and leaves unknown history unassigned', () => {
  const sql = readFileSync(new URL('../prisma/migrations/20261128120000_shared_dictation_references/migration.sql', import.meta.url), 'utf8');
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(sql, /sha256\(convert_to\("referenceSnapshot", 'UTF8'\)\)/);
  assert.match(sql, /WHERE "referenceSnapshot" IS NOT NULL/);
  assert.match(sql, /ON DELETE RESTRICT ON UPDATE RESTRICT/);
  assert.doesNotMatch(sql, /\bDELETE FROM\b|DROP COLUMN/);
});
