import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteMatches, newestFirst, splitLinks, noteDate, wasEdited, MAX_NOTE } from '../src/notes.js';

test('search: case, accents and word order do not matter', () => {
  const n = { body: 'Café idea: a Knight who is afraid of horses' };
  assert.ok(noteMatches(n, ''));
  assert.ok(noteMatches(n, 'cafe'));
  assert.ok(noteMatches(n, 'HORSES knight'));
  assert.ok(!noteMatches(n, 'dragon'));
  assert.ok(!noteMatches(n, 'knight dragon'));
});

test('newest first', () => {
  const list = [{ id: 1, created_at: '2026-01-01T00:00:00Z' }, { id: 2, created_at: '2026-03-01T00:00:00Z' }, { id: 3, created_at: '2026-02-01T00:00:00Z' }];
  assert.deepEqual(newestFirst(list).map((n) => n.id), [2, 3, 1]);
});

test('links in notes become separate parts, never HTML', () => {
  assert.deepEqual(splitLinks('see https://example.com/a. and (https://x.com/b)'), [
    { text: 'see ' }, { url: 'https://example.com/a', text: 'https://example.com/a' }, { text: '. and (' },
    { url: 'https://x.com/b', text: 'https://x.com/b' }, { text: ')' },
  ]);
  assert.deepEqual(splitLinks('no links <b>here</b>'), [{ text: 'no links <b>here</b>' }]);
  assert.deepEqual(splitLinks('javascript:alert(1)'), [{ text: 'javascript:alert(1)' }]);
  assert.deepEqual(splitLinks(''), []);
});

test('dates and the edited flag', () => {
  const now = new Date(2026, 10, 5, 15, 0);
  assert.match(noteDate(new Date(2026, 10, 5, 9, 30).toISOString(), now), /^Today /);
  assert.match(noteDate(new Date(2026, 10, 4, 9, 30).toISOString(), now), /^Yesterday /);
  assert.doesNotMatch(noteDate(new Date(2026, 9, 1).toISOString(), now), /2026/);
  assert.match(noteDate(new Date(2025, 9, 1).toISOString(), now), /2025/);
  assert.equal(noteDate('nope', now), '');
  assert.equal(wasEdited({ created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:30Z' }), false);
  assert.equal(wasEdited({ created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }), true);
  assert.equal(MAX_NOTE, 5000);
});
