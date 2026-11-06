import test from 'node:test';
import assert from 'node:assert/strict';
import { pageSlice } from '../src/Utils/reportPagination.js';

test('report pagination limits rows and clamps stale page numbers', () => {
  const rows = Array.from({ length: 123 }, (_, index) => index);
  assert.deepEqual(pageSlice(rows, 1, 50), rows.slice(0, 50));
  assert.deepEqual(pageSlice(rows, 3, 50), rows.slice(100));
  assert.deepEqual(pageSlice(rows, 99, 50), rows.slice(100));
  assert.deepEqual(pageSlice(rows, 0, 50), rows.slice(0, 50));
});
