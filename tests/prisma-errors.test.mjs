import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isForeignKeyError,
  isNotFoundError,
  isUniqueViolation,
  prismaErrorCode,
} from '../lib/prisma-errors.ts';

test('reads the Prisma error code', () => {
  assert.equal(prismaErrorCode({ code: 'P2025' }), 'P2025');
  assert.equal(prismaErrorCode(new Error('boom')), null);
  assert.equal(prismaErrorCode(null), null);
  assert.equal(prismaErrorCode('P2025'), null);
  assert.equal(prismaErrorCode({ code: 42 }), null);
});

test('classifies the codes the routes handle', () => {
  assert.equal(isNotFoundError({ code: 'P2025' }), true);
  assert.equal(isNotFoundError({ code: 'P2003' }), false);
  assert.equal(isForeignKeyError({ code: 'P2003' }), true);
  assert.equal(isUniqueViolation({ code: 'P2002' }), true);
  assert.equal(isUniqueViolation({ code: 'P2025' }), false);
});
