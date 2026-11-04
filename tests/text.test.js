import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTag, tagKey, nameMatch, findSimilar, matchesSearch, sameSource } from '../src/text.js';

test('tags are trimmed and case-insensitive', () => {
  assert.equal(cleanTag('  Dark   Lord '), 'Dark Lord');
  assert.equal(cleanTag('#fantasy'), 'fantasy');
  assert.equal(tagKey('Mage'), tagKey('mage '));
  assert.notEqual(tagKey('Mage'), tagKey('Mages'));
});

test('name matching', () => {
  assert.equal(nameMatch('Kael', 'kael'), 'same');
  assert.equal(nameMatch('  Captain   Vex ', 'captain vex'), 'same');
  assert.equal(nameMatch('Zoë', 'Zoe'), 'same');
  assert.equal(nameMatch('Kael', 'Kaell'), 'close');
  assert.equal(nameMatch('Kael', 'Keal'), null);        // a 2-letter swap is too far for a short name…
  assert.equal(nameMatch('Kael', 'Kail'), 'close');     // …but one letter off is caught
  assert.equal(nameMatch('Geralt', 'Geralt of Rivia'), 'close');
  assert.equal(nameMatch('Alexandria', 'Alexandra'), 'close');
  assert.equal(nameMatch('Vex', 'Rex'), null);          // too short to guess
  assert.equal(nameMatch('Kael', 'Moss Witch'), null);
  assert.equal(nameMatch('K', 'Kael'), null);
});

test('findSimilar: strong only when the source matches too', () => {
  const chars = [
    { id: 1, name: 'Kael', source: 'Original' },
    { id: 2, name: 'Kaell', source: 'Elden Ring' },
    { id: 3, name: 'Moss Witch', source: '' },
  ];
  const r = findSimilar('kael ', 'original', chars);
  assert.deepEqual(r.map((m) => [m.c.id, m.match, m.strong]), [[1, 'same', true], [2, 'close', false]]);
  assert.equal(findSimilar('Moss  witch', '', chars)[0].strong, true); // both empty = same
  assert.deepEqual(findSimilar('K', '', chars), []);
  assert.ok(sameSource(' ELDEN ring', 'Elden Ring'));
});

test('search covers name and source', () => {
  const c = { name: 'Kael', source: 'Elden Ring' };
  assert.ok(matchesSearch(c, 'kae'));
  assert.ok(matchesSearch(c, 'elden'));
  assert.ok(!matchesSearch(c, 'zelda'));
  assert.ok(matchesSearch({ name: 'X', source: null }, ''));
});
