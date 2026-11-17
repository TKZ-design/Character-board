import { h, icon, toast, errorToast, sheet } from '../ui.js';
import {
  state, filteredLinks, linksInScope, hasLinkFilters, clearLinkFilters, sortItems, linkTitle, vaultTagCounts, sortedVaultTags,
  setPref, moveLinksTo, saveVaultOpen,
} from '../state.js';
import { platformLabel, PLATFORMS } from '../links.js';
import { UNSORTED, folderById, folderPath, childrenOf, flattenTree, folderCounts, pathText } from '../folders.js';
import { openAddLink, pasteLinkButton } from './add-link.js';
import { linkCard, linkRow } from './link-card.js';
import { viewBar } from './viewbar.js';
import { folderHref, folderMenu, newFolder, pickFolder } from './folder-ui.js';
import { loadThumbs } from '../thumbs.js';
import { previewsUnavailable } from '../previews.js';
import { go } from '../nav.js';
import { moreMenu, chipRow, iconButton, searchBar } from './menu.js';
import { pageHead } from './page-head.js';
import { isSearchOpen, toggleSearch } from '../search.js';

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

const activeFilterCount = () => {
  const f = state.linkFilter;
  return (f.status ? 1 : 0) + (f.favoritesOnly ? 1 : 0) + (f.platform ? 1 : 0) + f.tags.size;
};

/** The Filter sheet: To watch / Done, favorites, platform and Vault tags. Changes apply straight away. */
function openFilters(rerender) {
  const f = state.linkFilter;
  const body = h('div.filter-sheet');
  const draw = () => {
    const pool = linksInScope(state.vaultScope, { deep: true }); // counts for the current folder + subfolders
    const by = (pred) => pool.filter(pred).length;
    const counts = vaultTagCounts();
    for (const id of counts.keys()) counts.set(id, 0);
    for (const l of pool) for (const id of l.tag_ids || []) counts.set(id, (counts.get(id) || 0) + 1);
    const tags = sortedVaultTags().filter((t) => counts.get(t.id) > 0 || f.tags.has(t.id));
    const platforms = Object.keys(PLATFORMS).filter((p) => pool.some((l) => l.platform === p) || f.platform === p);
    const change = (fn) => () => { fn(); rerender(); draw(); };
    const chip = (on, label, count, fn) => h(`button.filter${on ? '.on' : ''}`, { type: 'button', 'aria-pressed': String(on), onclick: change(fn) }, label, count == null ? null : h('span.count', count));
    body.replaceChildren(
      h('div.filter-block', h('p.label', 'Status'),
        h('div.filter-chips',
          chip(!f.status, 'All', null, () => { f.status = ''; }),
          chip(f.status === 'todo', 'To watch', by((l) => l.status === 'todo'), () => { f.status = 'todo'; }),
          chip(f.status === 'done', 'Done', by((l) => l.status === 'done'), () => { f.status = 'done'; }),
          h(`button.filter.fav-filter${f.favoritesOnly ? '.on' : ''}`, { type: 'button', 'aria-pressed': String(f.favoritesOnly), onclick: change(() => { f.favoritesOnly = !f.favoritesOnly; }) },
            icon('star'), 'Favorites', h('span.count', by((l) => l.is_favorite))))),
      platforms.length > 1
        ? h('label.filter-block.field', h('span', 'Platform'),
            h('select.platform-select', { onchange: (e) => { f.platform = e.target.value; rerender(); draw(); } },
              h('option', { value: '', selected: !f.platform }, 'All platforms'),
              platforms.map((p) => h('option', { value: p, selected: f.platform === p }, `${platformLabel(p)} (${by((l) => l.platform === p)})`))))
        : null,
      tags.length
        ? h('div.filter-block', h('p.label', 'Vault tags'),
            h('div.filter-chips', tags.map((t) => chip(f.tags.has(t.id), t.name, counts.get(t.id), () => { f.tags.has(t.id) ? f.tags.delete(t.id) : f.tags.add(t.id); }))))
        : null,
      h('div.row.end.filter-foot',
        h('button.btn.ghost', { type: 'button', disabled: !hasLinkFilters(), onclick: () => { clearLinkFilters(); rerender(); draw(); } }, 'Clear all'),
        h('button.btn.primary', { type: 'button', onclick: () => dlg.close() }, `Show ${plural(filteredLinks(state.vaultScope).length, 'link')}`)));
  };
  const dlg = sheet(body, { title: 'Filter links' });
  draw();
}

/** The top-level folder a scope sits under (so its chip lights up while you are inside a subfolder). */
function topFolderOf(scope) {
  if (!scope || scope === UNSORTED) return null;
  return folderPath(state.folders, scope)[0]?.id ?? null;
}

/** Title row (Search · Filter · Random · ⋯), the search box and the folder chips. */
export function vaultHeader({ rerender, renderView, onRandom }) {
  const f = state.linkFilter;
  const scope = state.vaultScope;
  const ready = !!state.linksReady;
  const open = ready && isSearchOpen('links');
  const nFilters = activeFilterCount();
  const inFolder = !!scope && scope !== UNSORTED;
  const sel = state.vaultSelect;

  const actions = ready ? [
    iconButton('search', 'Search (/)', () => toggleSearch('links', rerender), { on: open }),
    iconButton('sliders', nFilters ? `Filter (${nFilters} on)` : 'Filter', () => openFilters(rerender), { dot: nFilters > 0 }),
    iconButton('dice', 'Random', onRandom, { title: 'Random link (R)' }),
    moreMenu([
      { ic: 'check', label: sel ? 'Stop selecting' : 'Select links', pressed: !!sel, disabled: !state.links.length, run: () => { state.vaultSelect = state.vaultSelect ? null : new Set(); rerender(); } },
      { ic: 'folder', label: inFolder ? 'New subfolder' : 'New folder', run: () => newFolder(inFolder ? scope : null) },
      { ic: 'tag', label: 'Manage Vault tags', run: () => go('#/vault-tags') },
    ]),
  ] : null;

  let chips = null;
  if (ready) {
    const counts = folderCounts(state.folders, state.links);
    const topId = topFolderOf(scope);
    const chip = (href, label, count, on, current) => h(`a.filter${on ? '.on' : ''}`, { href, 'aria-current': current ? 'page' : null }, label, count == null ? null : h('span.count', count));
    chips = chipRow('Folders', [
      chip(folderHref(null), 'All', null, scope === null, scope === null),
      chip(folderHref(UNSORTED), 'Unsorted', counts.get(UNSORTED) || 0, scope === UNSORTED, scope === UNSORTED),
      childrenOf(state.folders, null).map((fo) => chip(folderHref(fo.id), fo.name, null, topId === fo.id || scope === fo.id, scope === fo.id)),
    ]);
    chips.classList.add('vault-chips'); // on a laptop the folder tree takes over
  }

  return pageHead({
    title: 'Vault',
    actions,
    below: [
      open ? searchBar({
        value: f.search, label: 'Search links',
        placeholder: scope ? `Search ${scopeName(scope)}${scope !== UNSORTED && childrenOf(state.folders, scope).length ? ' + subfolders' : ''}` : 'Title, site, notes or tag',
        oninput: (e) => { f.search = e.target.value; renderView(); },
        onclose: () => toggleSearch('links', rerender),
      }) : null,
      chips,
    ],
  });
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
  if (!scope) return null;
  const trail = scope !== UNSORTED ? folderPath(state.folders, scope) : [];
  const up = parentHref(scope);
  const upName = scope === UNSORTED ? 'Vault' : (trail.length > 1 ? trail[trail.length - 2].name : 'Vault');
  const f = folderById(state.folders, scope);
  return h('div.vault-crumbs',
    up ? h('a.back.vault-up', { href: up, 'aria-label': `Up to ${upName}` }, icon('back'), h('span', upName)) : null,
    h('nav.breadcrumb', { 'aria-label': 'Folder path' },
      h('ol',
        h('li', h('a', { href: folderHref(null) }, 'Vault')),
        scope === UNSORTED ? h('li', h('span', { 'aria-current': 'page' }, 'Unsorted')) : null,
        trail.map((t, i) => h('li', i === trail.length - 1 ? h('span', { 'aria-current': 'page' }, t.name) : h('a', { href: folderHref(t.id) }, t.name))))),
    h('div.vault-folder-head',
      h('h2.vault-folder-title', icon(scope === UNSORTED ? 'tray' : 'folder'), h('span', scopeName(scope))),
      f ? h('div.vault-folder-actions', folderMenu(f)) : null));
}

/** The "Folders" grid: the subfolders of the folder you are in. */
function folderGrid(scope, counts) {
  if (!scope || scope === UNSORTED) return null;
  const kids = childrenOf(state.folders, scope);
  if (!kids.length) return null;
  return h('section.folder-section', { 'aria-labelledby': 'folders-title' },
    h('h2#folders-title.section-label', 'Folders'),
    h('ul.folder-grid', kids.map((fo) => h('li', h('a.folder-card', { href: folderHref(fo.id) },
      icon('folder'),
      h('span.folder-card-name', fo.name),
      h('span.folder-card-sub', [plural(counts.get(fo.id) || 0, 'link'), subLabel(fo)].filter(Boolean).join(' · ')))))));
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
      h('p.muted', 'Tap + to add one, paste a link anywhere (Ctrl+V) — or on iPhone, share it with the “Save to Vault” shortcut.'),
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
            h('button.btn', { onclick: () => { clearLinkFilters(); state.searchOpen = false; rerender(); } }, 'Clear filters')))
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
      filtering ? null : folderGrid(scope, counts),
      bar,
      previewsUnavailable() ? h('p.muted.small.vault-hint', 'Link previews are off until the “link-preview” Edge Function is deployed — see the README.') : null,
      body,
      sel ? selectBar(list, rerender) : null)));
  loadThumbs(root);
}

