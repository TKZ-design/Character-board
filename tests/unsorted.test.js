import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newInUnsorted, advanceSeen, firstSeen } from '../src/unsorted.js';

const link = (id, iso) => ({ id, created_at: iso });
const A = link('a', '2026-11-17T09:00:00.000Z');
const B = link('b', '2026-11-17T10:00:00.000Z');
const C = link('c', '2026-11-17T11:00:00.000+00:00'); // the database writes times like this

test('only links newer than "last looked" count as new', () => {
  assert.deepEqual(newInUnsorted([A, B, C], '2026-11-17T09:30:00.000Z').map((l) => l.id), ['b', 'c']);
  assert.deepEqual(newInUnsorted([A, B, C], '2026-11-17T11:00:00.000Z'), []);
});

test('nothing is announced before this device has a "last looked" time', () => {
  assert.deepEqual(newInUnsorted([A, B, C], ''), []);
  assert.deepEqual(newInUnsorted([A, B, C], undefined), []);
});

test('links you added yourself in the app never count', () => {
  assert.deepEqual(newInUnsorted([A, B, C], '2026-11-17T08:00:00Z', ['b']).map((l) => l.id), ['a', 'c']);
});

test('the two ways of writing a time compare correctly', () => {
  assert.equal(newInUnsorted([C], '2026-11-17T11:00:00.000Z').length, 0);
  assert.equal(newInUnsorted([C], '2026-11-17T10:59:59.000Z').length, 1);
});

test('"last looked" only moves forward', () => {
  assert.equal(advanceSeen('2026-11-17T10:00:00.000Z', [A]), '2026-11-17T10:00:00.000Z');
  assert.equal(advanceSeen('2026-11-17T10:00:00.000Z', [A, C]), C.created_at);
  assert.equal(advanceSeen('', [A, B]), B.created_at);
  assert.equal(advanceSeen('', []), '');
});

test('first run starts from the newest link, or from now when there are none', () => {
  assert.equal(firstSeen([A, B], '2030-01-01T00:00:00.000Z'), B.created_at);
  assert.equal(firstSeen([], '2030-01-01T00:00:00.000Z'), '2030-01-01T00:00:00.000Z');
});
