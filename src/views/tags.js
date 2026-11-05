import { h, icon, modal, toast, errorToast, confirmDialog, promptDialog } from '../ui.js';
import {
  api, state, tagCounts, linkTagCounts, tagUseCounts, groupedTags, sortedGroups, tagByName, groupById, upsertTags, dropTagsLocally, clearLinkFilters,
} from '../state.js';
import { tagKey } from '../text.js';
import { rerender } from '../nav.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** "3 characters", "2 links" or "3 characters and 2 links" */
function usage(t) {
  const c = tagCounts().get(t.id) || 0, l = linkTagCounts().get(t.id) || 0;
  return [c ? plural(c, 'character') : null, l ? plural(l, 'link') : null].filter(Boolean).join(' and ');
}
const isUnique = (e) => e?.code === '23505' || /duplicate key|unique/i.test(e?.message || '');

/** The Tags page: tags with usage counts, organised by group. */
export function renderTags(root) {
  const counts = tagCounts();
  const sections = groupedTags({ keepEmpty: true })
    .filter((s) => s.group || s.tags.length || !state.groups.length);
  const nTags = state.tagList.length, nGroups = state.groups.length;

  const head = h('header.page-head',
    h('div.titleblock',
      h('p.eyebrow', `Library · ${plural(nTags, 'tag')} · ${plural(nGroups, 'group')}`),
      h('h1.title', 'Tags', h('span.title-dot', '.'))),
    h('div.actions',
      h('button.btn', { onclick: () => newGroup() }, icon('plus'), 'New group'),
      h('button.btn.primary', { onclick: () => newTag() }, 'New tag')));

  const body = !nTags && !nGroups
    ? h('div.empty',
        h('h2', 'No tags yet'),
        h('p.muted', 'Tags you add to characters and links show up here. You can also create groups — like Genre, Role or Mood — to keep them organised.'),
        h('div.row', h('button.btn', { onclick: () => newGroup() }, 'New group'), h('button.btn.primary', { onclick: () => newTag() }, 'New tag')))
    : h('div.tag-groups', sections.map((s) => groupSection(s, counts)));

  root.replaceChildren(head, body);
}

function groupSection({ group, tags }, counts) {
  return h('section.tag-group', { 'data-group': group?.id || 'ungrouped' },
    h('div.tag-group-head',
      h('h2', group ? group.name : 'Ungrouped'),
      h('span.tag-group-count', plural(tags.length, 'tag')),
      h('span.spacer'),
      h('div.tag-group-actions',
        h('button.btn.small-btn', { onclick: () => newTag(group?.id ?? null), 'aria-label': `Add tag to ${group ? group.name : 'Ungrouped'}` }, icon('plus'), 'Tag'),
        group ? h('button.btn.small-btn', { onclick: () => renameGroup(group) }, 'Rename') : null,
        group ? h('button.btn.small-btn', { onclick: () => deleteGroup(group, tags.length) }, 'Delete') : null)),
    tags.length
      ? h('ul.tag-rows', tags.map((t) => tagRow(t, counts.get(t.id) || 0)))
      : h('p.muted.tag-group-empty', group ? 'No tags in this group yet — use “Move to” on a tag, or “+ Tag”.' : 'No ungrouped tags.'),
  );
}

function tagRow(t, n) {
  const nLinks = linkTagCounts().get(t.id) || 0;
  const select = h('select.group-select', {
    'aria-label': `Group for ${t.name}`,
    onchange: async (e) => {
      const group_id = e.target.value || null;
      try {
        upsertTags([await api.updateTag(t.id, { group_id })]);
        toast(`Moved “${t.name}” to ${groupById(group_id)?.name || 'Ungrouped'}`, { type: 'ok', timeout: 1800 });
        rerender();
      } catch (err) { errorToast(err); rerender(); }
    },
  },
    h('option', { value: '', selected: !t.group_id }, 'Ungrouped'),
    sortedGroups().map((g) => h('option', { value: g.id, selected: g.id === t.group_id }, g.name)));

  const showLinks = () => { clearLinkFilters(); state.linkFilter.tags.add(t.id); };
  return h('li.tag-row', { 'data-tag': t.id },
    h('span.tag-name-wrap',
      !n && nLinks
        ? h('a.tag-name', { href: '#/links', title: `Show links tagged ${t.name}`, onclick: showLinks }, t.name, h('span.tag-count', ` (${n})`))
        : h('a.tag-name', {
            href: '#/characters', title: `Show characters tagged ${t.name}`,
            onclick: () => { state.tags.clear(); state.tags.add(t.id); state.search = ''; state.favoritesOnly = false; },
          }, t.name, h('span.tag-count', ` (${n})`)),
      nLinks ? h('a.tag-links', { href: '#/links', title: `Show links tagged ${t.name}`, onclick: showLinks }, plural(nLinks, 'link')) : null),
    h('div.tag-row-actions',
      h('label.move', h('span.sr-only', 'Move to'), select),
      h('button.icon-btn.small', { title: 'Rename', 'aria-label': `Rename ${t.name}`, onclick: () => renameTag(t) }, icon('edit')),
      h('button.icon-btn.small', { title: 'Merge into another tag', 'aria-label': `Merge ${t.name} into another tag`, onclick: () => mergeTag(t) }, icon('merge')),
      h('button.icon-btn.small', { title: 'Delete', 'aria-label': `Delete ${t.name}`, onclick: () => deleteTag(t) }, icon('trash'))),
  );
}

// ---------------- tags ----------------

const tagProblem = (v) => (v.includes(',') ? 'Tag names can’t contain commas.' : null);

async function newTag(groupId = null) {
  const select = h('select.group-select.wide',
    h('option', { value: '' }, 'Ungrouped'),
    sortedGroups().map((g) => h('option', { value: g.id, selected: g.id === groupId }, g.name)));
  const name = await promptDialog('New tag', {
    label: 'Tag name', okText: 'Create', placeholder: 'e.g. Fantasy',
    extra: h('label.field', h('span', 'Group'), select),
    validate: (v) => tagProblem(v) || (tagByName(v) ? `“${tagByName(v).name}” already exists (tags ignore upper/lower case).` : null),
  });
  if (!name) return;
  try {
    upsertTags([await api.createTag({ name, group_id: select.value || null })]);
    toast(`Created “${name}”`, { type: 'ok', timeout: 1800 });
    rerender();
  } catch (e) { errorToast(isUnique(e) ? new Error(`“${name}” already exists`) : e); }
}

async function renameTag(t) {
  const name = await promptDialog(`Rename “${t.name}”`, {
    label: 'New name', value: t.name, okText: 'Rename',
    validate: tagProblem,
  });
  if (!name || name === t.name) return;
  const clash = tagByName(name);
  if (clash && clash.id !== t.id) {
    // same name (ignoring case) as another tag → that's really a merge
    const used = usage(t);
    const ok = await confirmDialog(`“${clash.name}” already exists`,
      `Merge “${t.name}” into “${clash.name}” instead? ${used ? `Its ${used} will be tagged “${clash.name}”` : 'Nothing uses it'}, and “${t.name}” will be removed.`,
      { okText: 'Merge', danger: false });
    if (ok) await doMerge([t], clash);
    return;
  }
  try {
    upsertTags([await api.updateTag(t.id, { name })]);
    toast('Renamed — every character is updated', { type: 'ok', timeout: 2200 });
    rerender();
  } catch (e) { errorToast(e); }
}

async function deleteTag(t) {
  const used = usage(t);
  const ok = await confirmDialog(`Delete “${t.name}”?`,
    used ? `It will be removed from ${used}. They themselves stay. This can’t be undone.`
      : 'Nothing uses this tag. This can’t be undone.');
  if (!ok) return;
  try {
    await api.deleteTag(t.id);
    dropTagsLocally([t.id]);
    toast(`Deleted “${t.name}”`, { type: 'ok' });
    rerender();
  } catch (e) { errorToast(e); }
}

/** Pick a target tag, then merge `t` into it. */
function mergeTag(t) {
  const counts = tagUseCounts();
  let target = null;
  const search = h('input', { type: 'search', placeholder: 'Find a tag', autocomplete: 'off', 'aria-label': 'Find a tag' });
  const list = h('ul.merge-list', { role: 'listbox', 'aria-label': 'Merge into' });
  const summary = h('p.muted.merge-summary', 'Choose the tag to keep.');
  const ok = h('button.btn.primary', { type: 'submit', disabled: true }, 'Merge');

  function draw() {
    const q = tagKey(search.value);
    const others = state.tagList.filter((x) => x.id !== t.id && (!q || tagKey(x.name).includes(q)))
      .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.name.localeCompare(b.name));
    list.replaceChildren(...(others.length ? others.map((x) =>
      h('li', h(`button.merge-option${target === x ? '.on' : ''}`, {
        type: 'button', role: 'option', 'aria-selected': String(target === x),
        onclick: () => { target = x; draw(); },
      },
        h('span', x.name, h('span.tag-count', ` (${counts.get(x.id) || 0})`)),
        h('span.tag-option-group', groupById(x.group_id)?.name || 'Ungrouped'))))
      : [h('li.muted.char-pick-empty', 'No other tags')]));
    ok.disabled = !target;
    const used = usage(t);
    summary.textContent = target
      ? `${used ? `The ${used} tagged “${t.name}” will be tagged “${target.name}” instead` : `Nothing uses “${t.name}”`}, and “${t.name}” will be removed.`
      : 'Choose the tag to keep.';
  }
  search.addEventListener('input', draw);

  const dlg = modal(
    h('form.dialog-body', {
      method: 'dialog',
      onsubmit: (e) => { e.preventDefault(); if (target) { dlg.close(); doMerge([t], target); } },
    },
      h('p.eyebrow', 'Merge tags'),
      h('h2', `Merge “${t.name}” into…`),
      h('label.search', h('span.search-label', 'Find'), search),
      list,
      summary,
      h('div.row.end',
        h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'),
        ok)),
  );
  draw();
  search.focus();
}

async function doMerge(sources, target) {
  try {
    await api.mergeTags(sources.map((s) => s.id), target.id);
    const wasFiltering = sources.some((s) => state.tags.has(s.id));
    dropTagsLocally(sources.map((s) => s.id), target.id);
    if (wasFiltering) state.tags.add(target.id);
    toast(`Merged into “${target.name}”`, { type: 'ok' });
    rerender();
  } catch (e) { errorToast(e); }
}

// ---------------- groups ----------------

const groupClash = (v, except) => state.groups.find((g) => g.id !== except && tagKey(g.name) === tagKey(v));

async function newGroup() {
  const name = await promptDialog('New group', {
    label: 'Group name', okText: 'Create', placeholder: 'e.g. Genre, Role, Mood',
    validate: (v) => (groupClash(v) ? `There’s already a group called “${groupClash(v).name}”.` : null),
  });
  if (!name) return;
  try {
    state.groups.push(await api.createGroup(name));
    toast(`Created group “${name}”`, { type: 'ok', timeout: 1800 });
    rerender();
  } catch (e) { errorToast(e); }
}

async function renameGroup(g) {
  const name = await promptDialog(`Rename “${g.name}”`, {
    label: 'New name', value: g.name, okText: 'Rename',
    validate: (v) => (groupClash(v, g.id) ? `There’s already a group called “${groupClash(v, g.id).name}”.` : null),
  });
  if (!name || name === g.name) return;
  try {
    Object.assign(g, await api.updateGroup(g.id, { name }));
    rerender();
  } catch (e) { errorToast(e); }
}

async function deleteGroup(g, n) {
  const ok = await confirmDialog(`Delete group “${g.name}”?`,
    n ? `Its ${plural(n, 'tag')} will move to Ungrouped. No tags are deleted.` : 'It has no tags.');
  if (!ok) return;
  try {
    await api.deleteGroup(g.id);
    state.groups = state.groups.filter((x) => x.id !== g.id);
    for (const t of state.tagList) if (t.group_id === g.id) t.group_id = null;
    toast(`Deleted group “${g.name}”`, { type: 'ok' });
    rerender();
  } catch (e) { errorToast(e); }
}
