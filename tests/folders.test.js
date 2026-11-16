import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  childrenOf, folderPath, pathText, depthOf, heightOf, subtreeIds, createProblem, moveProblem, reorder,
  deletePlan, applyDelete, flattenTree, folderCounts, convertTagsToFolders, UNSORTED,
} from '../src/folders.js';

const F = (id, name, parent_id = null, position = 0) => ({ id, name, parent_id, position });
// Art › Tutorials › Anatomy, Art › Refs, Music
const tree = () => [
  F('art', 'Art', null, 0), F('tut', 'Tutorials', 'art', 0), F('ana', 'Anatomy', 'tut', 0),
  F('refs', 'Refs', 'art', 1), F('music', 'Music', null, 1),
];

test('paths, depth and height', () => {
  const fs = tree();
  assert.equal(pathText(fs, 'ana'), 'Art › Tutorials › Anatomy');
  assert.equal(pathText(fs, null), 'Unsorted');
  assert.deepEqual(folderPath(fs, 'tut').map((f) => f.id), ['art', 'tut']);
  assert.equal(depthOf(fs, 'art'), 1);
  assert.equal(depthOf(fs, 'ana'), 3);
  assert.equal(heightOf(fs, 'art'), 3);
  assert.equal(heightOf(fs, 'music'), 1);
  assert.deepEqual([...subtreeIds(fs, 'art')].sort(), ['ana', 'art', 'refs', 'tut']);
  assert.deepEqual(childrenOf(fs, 'art').map((f) => f.name), ['Tutorials', 'Refs']);
});

test('a 4th level is refused, names must be free', () => {
  const fs = tree();
  assert.equal(createProblem(fs, 'tut', 'Hands'), null);
  assert.match(createProblem(fs, 'ana', 'Hands'), /3 levels deep/);
  assert.match(createProblem(fs, null, '  art '), /already a folder called “Art”/);
  assert.equal(createProblem(fs, 'music', 'Art'), null); // same name in another place is fine
  assert.match(createProblem(fs, null, '   '), /enter a name/);
});

test('moving: not into itself, not deeper than 3 levels', () => {
  const fs = tree();
  assert.match(moveProblem(fs, 'art', 'art'), /into itself/);
  assert.match(moveProblem(fs, 'art', 'ana'), /into itself/);
  assert.equal(moveProblem(fs, 'tut', 'music'), null);
  assert.match(moveProblem(fs, 'art', 'music'), /more than 3 levels/);
  assert.match(moveProblem(fs, 'tut', 'refs'), /more than 3 levels/);
  assert.equal(moveProblem(fs, 'ana', null), null); // to top level
  fs.push(F('m-ana', 'Anatomy', 'music', 0));
  assert.match(moveProblem(fs, 'ana', 'music'), /already a folder/);
});

test('move up / down', () => {
  const fs = tree();
  assert.deepEqual(reorder(fs, 'music', -1), [{ id: 'music', position: 0 }, { id: 'art', position: 1 }]);
  assert.deepEqual(reorder(fs, 'art', -1), []);
  assert.deepEqual(reorder(fs, 'music', 1), []);
});

test('deleting a folder moves links and subfolders to its parent', () => {
  const fs = [...tree(), F('top-tut', 'Tutorials', null, 2)];
  const links = [{ id: 'l1', folder_id: 'art' }, { id: 'l2', folder_id: 'tut' }, { id: 'l3', folder_id: null }];
  const plan = deletePlan(fs, links, 'art');
  assert.deepEqual(plan.linkIds, ['l1']);
  assert.deepEqual(plan.subfolders.map((s) => [s.from, s.to]), [['Tutorials', 'Tutorials (2)'], ['Refs', 'Refs']]);
  const left = applyDelete(fs, links, 'art');
  assert.equal(left.length, 6 - 1);
  assert.equal(links.length, 3); // no link lost
  assert.equal(links[0].folder_id, null);
  assert.equal(links[1].folder_id, 'tut');
  assert.equal(pathText(left, 'ana'), 'Tutorials (2) › Anatomy');
  assert.deepEqual(childrenOf(left, null).map((f) => f.name), ['Music', 'Tutorials', 'Tutorials (2)', 'Refs']);
  // a subfolder's links move to its parent folder
  const fs2 = tree(); const l2 = [{ id: 'x', folder_id: 'ana' }];
  applyDelete(fs2, l2, 'ana');
  assert.equal(l2[0].folder_id, 'tut');
});

test('tree rows and counts', () => {
  const fs = tree();
  assert.deepEqual(flattenTree(fs, new Set()).map((r) => r.folder.name), ['Art', 'Music']);
  assert.deepEqual(flattenTree(fs, new Set(['art'])).map((r) => `${r.depth}:${r.folder.name}`), ['1:Art', '2:Tutorials', '2:Refs', '1:Music']);
  assert.equal(flattenTree(fs).length, 5);
  const counts = folderCounts(fs, [{ folder_id: 'ana' }, { folder_id: 'art' }, { folder_id: null }, { folder_id: 'gone' }]);
  assert.equal(counts.get('art'), 2);
  assert.equal(counts.get('tut'), 1);
  assert.equal(counts.get('music'), 0);
  assert.equal(counts.get(UNSORTED), 2); // no folder, or a folder that no longer exists
});

// Same example as tests/migration.test.js
const SEED = () => {
  const names = ['Tutorial', 'Sci-fi', 'Fantasy', 'Animation', 'cozy', 'Noir', 'Villain', 'Lonely', 'Alpha', 'Beta'];
  const tags = names.map((name) => ({ id: 't-' + name, name }));
  const lt = (link, ...ns) => ns.map((n) => ({ link_id: link, tag_id: 't-' + n }));
  return {
    tags,
    linkTags: [...lt('L1', 'Tutorial'), ...lt('L2', 'Tutorial', 'Sci-fi'), ...lt('L3', 'Fantasy'), ...lt('L4', 'Fantasy', 'Animation'),
      ...lt('L5', 'cozy'), ...lt('L6', 'Noir'), ...lt('L8', 'Beta', 'Alpha')],
    characterTags: [{ character_id: 'c1', tag_id: 't-Fantasy' }, { character_id: 'c1', tag_id: 't-Villain' }, { character_id: 'c2', tag_id: 't-Noir' }],
  };
};

test('conversion: most-used tag becomes the folder, the rest Vault tags', () => {
  const r = convertTagsToFolders(SEED());
  assert.deepEqual(Object.fromEntries(r.linkFolder), { L1: 'Tutorial', L2: 'Tutorial', L3: 'Fantasy', L4: 'Fantasy', L5: 'cozy', L6: 'Noir', L8: 'Alpha' });
  assert.deepEqual(r.folders.map((f) => f.name), ['Alpha', 'cozy', 'Fantasy', 'Noir', 'Tutorial']);
  assert.deepEqual(r.vaultTags.sort(), ['Animation', 'Beta', 'Sci-fi']);
  assert.deepEqual(r.vaultLinkTags, [{ link_id: 'L2', name: 'Sci-fi' }, { link_id: 'L4', name: 'Animation' }, { link_id: 'L8', name: 'Beta' }]);
  // character tags still used by a character survive; unused-anywhere "Lonely" is left alone
  assert.deepEqual(r.deleteTagIds.sort(), ['t-Alpha', 't-Animation', 't-Beta', 't-Sci-fi', 't-Tutorial', 't-cozy']);
});

test('conversion: running it again changes nothing', () => {
  const r = convertTagsToFolders(SEED());
  // after the first run links no longer use shared tags
  const again = convertTagsToFolders({ ...SEED(), linkTags: [], folders: r.folders.map((f, i) => F('f' + i, f.name, null, f.position)) });
  assert.deepEqual(again.folders, []);
  assert.equal(again.linkFolder.size, 0);
  assert.deepEqual(again.deleteTagIds, []);
  // and existing folders with the same name are reused, not duplicated
  const reuse = convertTagsToFolders({ ...SEED(), folders: [F('x', 'tutorial', null, 0)] });
  assert.equal(reuse.linkFolder.get('L1'), 'tutorial');
  assert.ok(!reuse.folders.some((f) => f.name.toLowerCase() === 'tutorial'));
});
