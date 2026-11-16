// "Manage Vault tags": the Link Vault's own tag list (separate from character
// tags). Rename, merge and delete — no tag groups here.
import { h, icon, modal, toast, errorToast, confirmDialog, promptDialog } from '../ui.js';
import {
  api, state, vaultTagCounts, sortedVaultTags, vaultTagByName, upsertVaultTags, dropVaultTagsLocally, clearLinkFilters,
} from '../state.js';
import { tagKey } from '../text.js';
import { rerender } from '../nav.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const usage = (t) => { const n = vaultTagCounts().get(t.id) || 0; return n ? plural(n, 'link') : ''; };
const tagProblem = (v) => (v.includes(',') ? 'Tag names can’t contain commas.' : null);

export function renderVaultTags(root) {
  const counts = vaultTagCounts();
  const tags = sortedVaultTags();
  const head = h('header.page-head',
    h('div.titleblock',
      h('p.eyebrow', `Link Vault · ${plural(tags.length, 'tag')}`),
      h('h1.title', 'Vault tags', h('span.title-dot', '.'))),
    h('p.muted.page-note', 'These tags are only for links. Character tags live on the Characters Tags page.'));
  const body = !tags.length
    ? h('div.empty',
        h('h2', 'No Vault tags yet'),
        h('p.muted', 'Add tags to a link (in Add link, or Edit on a link’s page) and they show up here.'))
    : h('ul.tag-rows.vault-tag-rows', tags.map((t) => tagRow(t, counts.get(t.id) || 0)));
  root.replaceChildren(head, body);
}

function tagRow(t, n) {
  return h('li.tag-row', { 'data-tag': t.id },
    h('span.tag-name-wrap',
      h('a.tag-name', {
        href: '#/links', title: `Show links tagged ${t.name}`,
        onclick: () => { clearLinkFilters(); state.linkFilter.tags.add(t.id); },
      }, t.name, h('span.tag-count', ` (${n})`))),
    h('div.tag-row-actions',
      h('button.icon-btn.small', { title: 'Rename', 'aria-label': `Rename ${t.name}`, onclick: () => renameTag(t) }, icon('edit')),
      h('button.icon-btn.small', { title: 'Merge into another tag', 'aria-label': `Merge ${t.name} into another tag`, onclick: () => mergeTag(t) }, icon('merge')),
      h('button.icon-btn.small', { title: 'Delete', 'aria-label': `Delete ${t.name}`, onclick: () => deleteTag(t) }, icon('trash'))));
}

async function renameTag(t) {
  const name = await promptDialog(`Rename “${t.name}”`, { label: 'New name', value: t.name, okText: 'Rename', validate: tagProblem });
  if (!name || name === t.name) return;
  const clash = vaultTagByName(name);
  if (clash && clash.id !== t.id) {
    const used = usage(t);
    const ok = await confirmDialog(`“${clash.name}” already exists`,
      `Merge “${t.name}” into “${clash.name}” instead? ${used ? `Its ${used} will be tagged “${clash.name}”` : 'Nothing uses it'}, and “${t.name}” will be removed.`,
      { okText: 'Merge', danger: false });
    if (ok) await doMerge([t], clash);
    return;
  }
  try {
    upsertVaultTags([await api.updateVaultTag(t.id, { name })]);
    toast('Renamed — every link is updated', { type: 'ok', timeout: 2200 });
    rerender();
  } catch (e) { errorToast(e); }
}

async function deleteTag(t) {
  const used = usage(t);
  const ok = await confirmDialog(`Delete “${t.name}”?`,
    used ? `It will be removed from ${used}. The links themselves stay. This can’t be undone.` : 'No link uses this tag. This can’t be undone.');
  if (!ok) return;
  try {
    await api.deleteVaultTag(t.id);
    dropVaultTagsLocally([t.id]);
    toast(`Deleted “${t.name}”`, { type: 'ok' });
    rerender();
  } catch (e) { errorToast(e); }
}

function mergeTag(t) {
  const counts = vaultTagCounts();
  let target = null;
  const search = h('input', { type: 'search', placeholder: 'Find a tag', autocomplete: 'off', 'aria-label': 'Find a tag' });
  const list = h('ul.merge-list', { role: 'listbox', 'aria-label': 'Merge into' });
  const summary = h('p.muted.merge-summary', 'Choose the tag to keep.');
  const ok = h('button.btn.primary', { type: 'submit', disabled: true }, 'Merge');

  function draw() {
    const q = tagKey(search.value);
    const others = state.vaultTags.filter((x) => x.id !== t.id && (!q || tagKey(x.name).includes(q)))
      .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.name.localeCompare(b.name));
    list.replaceChildren(...(others.length ? others.map((x) =>
      h('li', h(`button.merge-option${target === x ? '.on' : ''}`, {
        type: 'button', role: 'option', 'aria-selected': String(target === x),
        onclick: () => { target = x; draw(); },
      }, h('span', x.name, h('span.tag-count', ` (${counts.get(x.id) || 0})`)))))
      : [h('li.muted.char-pick-empty', 'No other tags')]));
    ok.disabled = !target;
    const used = usage(t);
    summary.textContent = target
      ? `${used ? `The ${used} tagged “${t.name}” will be tagged “${target.name}” instead` : `Nothing uses “${t.name}”`}, and “${t.name}” will be removed.`
      : 'Choose the tag to keep.';
  }
  search.addEventListener('input', draw);
  const dlg = modal(
    h('form.dialog-body', { method: 'dialog', onsubmit: (e) => { e.preventDefault(); if (target) { dlg.close(); doMerge([t], target); } } },
      h('p.eyebrow', 'Merge Vault tags'),
      h('h2', `Merge “${t.name}” into…`),
      h('label.search', h('span.search-label', 'Find'), search),
      list, summary,
      h('div.row.end', h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'), ok)));
  draw();
  search.focus();
}

async function doMerge(sources, target) {
  try {
    await api.mergeVaultTags(sources.map((s) => s.id), target.id);
    const wasFiltering = sources.some((s) => state.linkFilter.tags.has(s.id));
    dropVaultTagsLocally(sources.map((s) => s.id), target.id);
    if (wasFiltering) state.linkFilter.tags.add(target.id);
    toast(`Merged into “${target.name}”`, { type: 'ok' });
    rerender();
  } catch (e) { errorToast(e); }
}
