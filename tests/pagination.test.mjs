import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  pageSlice,
  parsePageParams,
} from '../lib/pagination.ts';

const request = (query = '') => new Request(`http://localhost/api?${query}`);

test('admin lists default to the standard page size', () => {
  const page = parsePageParams(request());
  assert.equal(page.take, DEFAULT_PAGE_SIZE);
  assert.equal(page.skip, 0);
});

test('limit is clamped to the maximum and never drops below one', () => {
  assert.equal(parsePageParams(request('limit=9999')).take, MAX_PAGE_SIZE);
  assert.equal(parsePageParams(request('limit=0')).take, 1);
  assert.equal(parsePageParams(request('limit=-5')).take, 1);
  assert.equal(parsePageParams(request('limit=abc')).take, DEFAULT_PAGE_SIZE);
});

test('offset is never negative', () => {
  assert.equal(parsePageParams(request('offset=40')).skip, 40);
  assert.equal(parsePageParams(request('offset=-10')).skip, 0);
  assert.equal(parsePageParams(request('offset=abc')).skip, 0);
});

test('hasMore and pageSlice drop the look-ahead row', () => {
  const page = parsePageParams(request('limit=2'));
  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(page.hasMore(rows), true);
  assert.deepEqual(pageSlice(rows, page), [{ id: 1 }, { id: 2 }]);

  const last = [{ id: 1 }, { id: 2 }];
  assert.equal(page.hasMore(last), false);
  assert.deepEqual(pageSlice(last, page), last);
});
