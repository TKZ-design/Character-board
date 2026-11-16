import { h, icon, toast, errorToast } from '../ui.js';
import {
  state, filteredLinks, linksInScope, hasLinkFilters, clearLinkFilters, sortItems, linkTitle, vaultTagCounts, sortedVaultTags,
  setPref, moveLinksTo, saveVaultOpen,
} from '../state.js';
import { parseUrl, platformLabel, PLATFORMS } from '../links.js';
import { UNSORTED, folderById, folderPath, childrenOf, flattenTree, folderCounts, pathText } from '../folders.js';
import { openAddLink, pasteLinkButton } from './add-link.js';
import { linkCard, linkRow } from './link-card.js';
import { viewBar } from './viewbar.js';
import { folderHref, folderMenu, newFolder, pickFolder } from './folder-ui.js';
import { loadThumbs } from '../thumbs.js';
import { previewsUnavailable } from '../previews.js';
import { go } from '../nav.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** '#/links' → null (All links), '#/links/unsorted' → 'unsorted', '#/links/f/<id>' → id */
export function scopeFromArg(arg = '') {
  if (arg === UNSORTED) return UNSORTED;
  const m = arg.match(/^f\/(.+)$/);
  return m ? m[1] : null;
}
const scopeName = (scope) => (!scope ? 'All links' : scope === UNSORTED ? 'Unsorted' : folderById(state.folders, scope)?.name || 'Folder');

/** Where "Back" / Esc goes from a scope: a folder's parent, else All links. */
export function parentHref(scope) {
  if (!scope) return null;
  if (scope === UNSORTED) return folderHref(null);
  return folderHref(folderById(state.folders, scope)?.parent_id ?? null);
}

/** "Paste or type a link" — opens the Add dialog pre-filled. Pasting submits right away. */
function quickAdd() {
  const input = h('input', {
    type: 'text', inputmode: 'url', placeholder: 'Paste or type a link…', autocomplete: 'off', autocapitalize: 'off',
    spellcheck: false, enterkeyhint: 'go', 'aria-label': 'Link to add',
  });
  const submit = () => {
    const url = parseUrl(input.value);
    if (!url) { toast(input.value.trim() ? 'That doesn’t look like a link.' : 'Paste or type a link first.'); input.focus(); return; }
    input.value = '';
    input.blur();
    openAddLink({ url });
  };
  input.addEventListener('paste', () => setTimeout(() => { if (parseUrl(input.value)) submit(); }, 0));
  return h('form.quick-add', { onsubmit: (e) => { e.preventDefault(); submit(); } },
    h('span.quick-add-icon', icon('plus')),
    input,
    h('button.btn', { type: 'submit' }, 'Add'));
}

function vaultFilterBar(searchInput, rerender) {
  const f = state.linkFilter;
  const pool = linksInScope(state.vaultScope, { deep: true }); // counts for the current folder + subfolders
  const counts = vaultTagCounts();
  for (const id of counts.keys()) counts.set(id, 0);
  for (const l of pool) for (const id of l.tag_ids || []) counts.set(id, (counts.get(id) || 0) + 1);
  const tags = sortedVaultTags().filter((t) => counts.get(t.id) > 0 || f.tags.has(t.id));
  const has = pool.length > 0 || hasLinkFilters();
  const by = (pred) => pool.filter(pred).length;
  const statusBtn = (value, label) => h(`button.filter${f.status === value ? '.on' : ''}`, {
    type: 'button', 'aria-pressed': String(f.status === value),
    onclick: () => { f.status = value; rerender(); },
  }, label, value ? h('span.count', by((l) => l.status === value)) : null);
  const platforms = Object.keys(PLATFORMS).filter((p) => pool.some((l) => l.platform === p) || f.platform === p);
  const platform = h('select.group-select.platform-select', {
    'aria-label': 'Filter by platform',
    onchange: (e) => { f.platform = e.target.value; rerender(); },
  },
    h('option', { value: '', selected: !f.platform }, 'All platforms'),
    platforms.map((p) => h('option', { value: p, selected: f.platform === p }, `${platformLabel(p)} (${by((l) => l.platform === p)})`)));
  const tagButton = (t) => h(`button.filter${f.tags.has(t.id) ? '.on' : ''}`, {
    type: 'button', 'aria-pressed': String(f.tags.has(t.id)),
    onclick: () => { f.tags.has(t.id) ? f.tags.delete(t.id) : f.tags.add(t.id); rerender(); },
  }, t.name, h('span.count', counts.get(t.id)));

  return h('nav.filterbar.vault-filters', { 'aria-label': 'Filters' },
    has
      ? h('div.filters', { role: 'group', 'aria-label': 'Filter links' },
          statusBtn('', 'All'), statusBtn('todo', 'To watch'), statusBtn('done', 'Done'),
          h('span.filter-sep', { 'aria-hidden': 'true' }),
          h(`button.filter.fav-filter${f.favoritesOnly ? '.on' : ''}`, {
            type: 'button', 'aria-pressed': String(f.favoritesOnly), title: 'Show favorites only',
            onclick: () => { f.favoritesOnly = !f.favoritesOnly; rerender(); },
          }, icon('star'), 'Favorites', h('span.count', by((l) => l.is_favorite))),
          platforms.length > 1 ? [h('span.filter-sep', { 'aria-hidden': 'true' }), h('label.platform-filter', h('span.sr-only', 'Platform'), platform)] : null)
      : h('div.filters'),
    h('label.search', h('span.search-label', 'Search'), searchInput),
    tags.length
      ? h('div.filters.tag-filter-row', { role: 'group', 'aria-label': 'Filter by Vault tag' }, tags.map(tagButton))
      : null);
}

/** Title, actions, quick add and filters for the Link Vault page. */
export function vaultMasthead(actions, render, renderView) {
  const f = state.linkFilter;
  const scope = state.vaultScope;
  const search = h('input#search', {
    type: 'search', value: f.search,
    placeholder: scope ? `Search ${scopeName(scope)}${scope !== UNSORTED && childrenOf(state.folders, scope).length ? ' + subfolders' : ''}` : 'Title, site, notes or tag',
    oninput: (e) => { f.search = e.target.value; renderView(); },
  });
  const n = state.links.length;
  const todo = state.links.filter((l) => l.status === 'todo').length;
  return h('header.masthead.vault-head',
    h('div.masthead-row',
      h('div.titleblock',
        h('p.eyebrow', `Vault · ${plural(n, 'link')}${todo ? ` · ${todo} to watch` : ''}`),
        h('h1.title', 'Link Vault', h('span.title-dot', '.'))),
      actions),
    state.linksReady ? quickAdd() : null,
    state.linksReady ? vaultFilterBar(search, render) : null);
}

// ---------------- folder tree (computer) ----------------

function folderTree(counts, rerender) {
  const scope = state.vaultScope;
  const entry = (s, label, ic, n) => h(`a.tree-row.tree-fixed${scope === s ? '.on' : ''}`, {
    href: folderHref(s), 'aria-current': scope === s ? 'page' : null,
  }, h('span.tree-toggle-space'), icon(ic), h('span.tree-name', label), h('span.tree-count', n));
  // keep the way to the current folder open
  for (const f of folderPath(state.folders, scope && scope !== UNSORTED ? scope : null).slice(0, -1)) state.vaultOpen.add(f.id);
  const rows = flattenTree(state.folders, state.vaultOpen).map(({ folder: f, depth, hasKids, open }) =>
    h(`div.tree-item${scope === f.id ? '.on' : ''}`, { style: `--depth:${depth}` },
      hasKids
        ? h('button.tree-toggle', {
            type: 'button', 'aria-expanded': String(open), 'aria-label': `${open ? 'Collapse' : 'Expand'} ${f.name}`,
            onclick: () => { open ? state.vaultOpen.delete(f.id) : state.vaultOpen.add(f.id); saveVaultOpen(); rerender(); },
          }, icon('chevron', open ? 'rot90' : ''))
        : h('span.tree-toggle-space'),
      h('a.tree-row', { href: folderHref(f.id), 'aria-current': scope === f.id ? 'page' : null },
        icon('folder'), h('span.tree-name', f.name), h('span.tree-count', counts.get(f.id) || 0))));
  return h('aside.vault-tree', { 'aria-label': 'Folders' },
    h('nav.tree',
      entry(null, 'All links', 'layers', state.links.length),
      entry(UNSORTED, 'Unsorted', 'tray', counts.get(UNSORTED)),
      h('p.tree-label', 'Folders'),
      rows.length ? rows : h('p.muted.small.tree-empty', 'No folders yet.'),
      h('button.btn.small-btn.tree-new', { type: 'button', onclick: () => newFolder(null) }, icon('plus'), 'New folder')));
}

// ---------------- breadcrumb + folder rows ----------------

function crumbs(scope) {
  const trail = scope && scope !== UNSORTED ? folderPath(state.folders, scope) : [];
  const up = parentHref(scope);
  const upName = scope === UNSORTED ? 'Vault' : (trail.length > 1 ? trail[trail.length - 2].name : 'Vault');
  const f = folderById(state.folders, scope);
  return h('div.vault-crumbs',
    up ? h('a.back.vault-up', { href: up, 'aria-label': `Up to ${upName}` }, icon('back'), h('span', upName)) : null,
    h('nav.breadcrumb', { 'aria-label': 'Folder path' },
      h('ol',
        h('li', scope ? h('a', { href: folderHref(null) }, 'Vault') : h('span', { 'aria-current': 'page' }, 'Vault')),
        scope === UNSORTED ? h('li', h('span', { 'aria-current': 'page' }, 'Unsorted')) : null,
        trail.map((t, i) => h('li', i === trail.length - 1 ? h('span', { 'aria-current': 'page' }, t.name) : h('a', { href: folderHref(t.id) }, t.name))))),
    h('div.vault-folder-head',
      h('h2.vault-folder-title', icon(!scope ? 'layers' : scope === UNSORTED ? 'tray' : 'folder'), h('span', scopeName(scope))),
      h('div.vault-folder-actions',
        f ? folderMenu(f) : null,
        scope !== UNSORTED ? h('button.btn.small-btn', { type: 'button', onclick: () => newFolder(f ? f.id : null) }, icon('plus'), f ? 'Subfolder' : 'New folder') : null)));
}

function folderRows(scope, counts) {
  const entries = [];
  if (!scope) {
    entries.push({ href: folderHref(UNSORTED), name: 'Unsorted', ic: 'tray', n: counts.get(UNSORTED), sub: 'Links in no folder' });
    for (const f of childrenOf(state.folders, null)) entries.push({ href: folderHref(f.id), name: f.name, ic: 'folder', n: counts.get(f.id), sub: subLabel(f) });
  } else if (scope !== UNSORTED) {
    for (const f of childrenOf(state.folders, scope)) entries.push({ href: folderHref(f.id), name: f.name, ic: 'folder', n: counts.get(f.id), sub: subLabel(f) });
  }
  if (!entries.length) return null;
  return h(`ul.folder-rows${!scope ? '.phone-only' : ''}`, { 'aria-label': 'Folders' },
    entries.map((e) => h('li', h('a.folder-row', { href: e.href },
      icon(e.ic),
      h('span.folder-row-text', h('span.folder-row-name', e.name), e.sub ? h('span.folder-row-sub', e.sub) : null),
      h('span.folder-row-count', plural(e.n || 0, 'link')),
      icon('chevron')))));
}
function subLabel(f) {
  const kids = childrenOf(state.folders, f.id).length;
  return kids ? plural(kids, 'subfolder') : null;
}

// ---------------- select & move ----------------

function selectBar(list, rerender) {
  const sel = state.vaultSelect;
  const allOn = list.length > 0 && list.every((l) => sel.has(l.id));
  return h('div.compare-bar.select-bar', { role: 'region', 'aria-label': 'Selected links' },
    h('span.compare-status', sel.size ? `${sel.size} selected` : 'Tap links to select them'),
    h('button.btn', { type: 'button', onclick: () => { if (allOn) list.forEach((l) => sel.delete(l.id)); else list.forEach((l) => sel.add(l.id)); rerender(); } },
      allOn ? 'Select none' : 'Select all'),
    h('button.btn', { type: 'button', onclick: () => { state.vaultSelect = null; rerender(); } }, 'Cancel'),
    h('button.btn.primary', { type: 'button', disabled: !sel.size, onclick: () => moveSelected(rerender) }, icon('folder'), 'Move to folder…'));
}

async function moveSelected(rerender) {
  const links = state.links.filter((l) => state.vaultSelect?.has(l.id));
  if (!links.length) return;
  const target = await pickFolder({
    title: `Move ${plural(links.length, 'link')} to…`, okText: 'Move here',
    current: links.every((l) => (l.folder_id ?? null) === (links[0].folder_id ?? null)) ? (links[0].folder_id ?? null) : undefined,
  });
  if (target === undefined) return;
  try {
    const n = await moveLinksTo(links, target);
    state.vaultSelect = null;
    toast(n ? `Moved ${plural(n, 'link')} to ${pathText(state.folders, target)}` : 'Already there', { type: 'ok', timeout: 2500 });
    rerender();
  } catch (e) { errorToast(e); }
}

// ---------------- the page ----------------

export function renderVault(root, rerender, arg = '') {
  if (state.linksReady === null) { root.replaceChildren(h('div.loading', h('div.spinner'))); return; }
  if (state.linksReady === false) {
    root.replaceChildren(h('div.empty',
      h('h2', 'One quick setup step'),
      h('p.muted', 'The Link Vault needs a database update. In Supabase → SQL Editor, run the files in supabase/migrations that you haven’t run yet, oldest first — the newest is 20261116_01_vault_folders_tags.sql (the README has the exact steps). Then reload this page. Your characters are not affected.'),
      h('button.btn.primary', { onclick: () => location.reload() }, 'Reload')));
    return;
  }
  const scope = scopeFromArg(arg);
  if (scope && scope !== UNSORTED && !folderById(state.folders, scope)) {
    root.replaceChildren(h('div.empty', h('h2', 'Folder not found'), h('p.muted', 'It may have been deleted.'), h('a.btn', { href: '#/links' }, 'All links')));
    return;
  }
  if (!state.links.length && !state.folders.length) {
    root.replaceChildren(h('div.empty',
      h('h2', 'No links yet'),
      h('p.muted', 'Paste a link anywhere (Ctrl+V), use Paste link, type one above — or on iPhone, share it with the “Save to Vault” shortcut.'),
      h('div.row', pasteLinkButton(), h('button.btn.primary', { onclick: () => openAddLink() }, 'Add link'))));
    return;
  }

  const counts = folderCounts(state.folders, state.links);
  const filtering = hasLinkFilters();
  // In a folder: its own links; while searching/filtering: the folder + all its subfolders.
  const pool = filtering ? filteredLinks(scope) : linksInScope(scope);
  const list = sortItems(pool, state.linkSort, linkTitle);
  const showPath = !scope || (filtering && scope !== UNSORTED && childrenOf(state.folders, scope).length > 0);
  const deepTotal = scope && scope !== UNSORTED ? counts.get(scope) : null;

  let text;
  if (filtering) text = `${list.length} found${scope ? ` in ${scopeName(scope)}${scope !== UNSORTED && deepTotal !== linksInScope(scope).length ? ' + subfolders' : ''}` : ''}`;
  else if (deepTotal != null && deepTotal !== list.length) text = `${plural(list.length, 'link')} here · ${deepTotal} with subfolders`;
  else text = plural(list.length, 'link');

  const sel = state.vaultSelect;
  const bar = viewBar({
    text, sort: state.linkSort, view: state.linkView, nameLabel: 'Title',
    onSort: (s) => { state.linkSort = s; setPref('link-sort', s); rerender(); },
    onView: (v) => { state.linkView = v; setPref('link-view', v); rerender(); },
    extra: list.length ? h(`button.btn.select-btn${sel ? '.on' : ''}`, {
      type: 'button', 'aria-pressed': String(!!sel), title: 'Select links to move them to a folder',
      onclick: () => { state.vaultSelect = sel ? null : new Set(); rerender(); },
    }, icon('check'), 'Select') : null,
  });
  const after = () => { if (state.linkFilter.favoritesOnly || state.linkFilter.status) rerender(); };
  const opts = (l) => ({
    showPath,
    select: sel ? { selected: sel.has(l.id), toggle: () => { sel.has(l.id) ? sel.delete(l.id) : sel.add(l.id); rerender(); } } : null,
  });

  let body;
  if (!list.length) {
    body = filtering
      ? h('div.empty.small-empty',
          h('h2', 'No matches'),
          h('p.muted', scope ? `Nothing in ${scopeName(scope)} fits the current search and filters.` : 'Nothing fits the current search and filters.'),
          h('div.row',
            scope ? h('button.btn', { onclick: () => go(folderHref(null)) }, 'Search all links') : null,
            h('button.btn', { onclick: () => { clearLinkFilters(); rerender(); } }, 'Clear filters')))
      : h('div.empty.small-empty',
          h('h2', scope === UNSORTED ? 'Nothing unsorted' : 'Empty folder'),
          h('p.muted', scope === UNSORTED ? 'Every link is in a folder.' : 'Add a link here, or select links elsewhere and use “Move to folder…”.'),
          scope !== UNSORTED ? h('button.btn.primary', { onclick: () => openAddLink() }, 'Add link here') : null);
  } else if (state.linkView === 'list') {
    body = h('ul.lrows', list.map((l) => linkRow(l, after, opts(l))));
  } else {
    body = h('div.lgrid', list.map((l) => linkCard(l, after, opts(l))));
  }

  root.replaceChildren(h('div.vault-layout',
    folderTree(counts, rerender),
    h('section.vault-main',
      crumbs(scope),
      filtering ? null : folderRows(scope, counts),
      bar,
      previewsUnavailable() ? h('p.muted.small.vault-hint', 'Link previews are off until the “link-preview” Edge Function is deployed — see the README.') : null,
      body,
      sel ? selectBar(list, rerender) : null)));
  loadThumbs(root);
}

