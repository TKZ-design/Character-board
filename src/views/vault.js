import { h, icon, errorToast } from '../ui.js';
import { state, filteredLinks, hasLinkFilters, clearLinkFilters, groupedTags, linkTagCounts, tagNamesOf, patchLink } from '../state.js';
import { PLATFORMS, domainOf, platformLabel } from '../linkutil.js';
import { linkMedia, linkTitle, loadLinkImages } from '../linkmedia.js';
import { queueMissingPreviews } from '../previews.js';
import { viewTools } from './view-tools.js';
import { openAddLink, pasteLinkButton } from './add-link.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Status / favorites / platform / tag filters + search, under the Link Vault title. */
export function vaultFilterBar(searchInput, rerender) {
  const v = state.vault;
  if (!state.links.length) return h('nav.filterbar', { 'aria-label': 'Filters' }, h('div.filters'), h('label.search', h('span.search-label', 'Search'), searchInput));
  const counts = linkTagCounts();
  const sections = groupedTags({ filter: (t) => counts.get(t.id) > 0 });
  const labelled = sections.some((s) => s.group);
  const n = (fn) => state.links.filter(fn).length;
  const btn = (on, label, onclick, { count, ico, title } = {}) =>
    h(`button.filter${on ? '.on' : ''}`, { 'aria-pressed': String(on), title, onclick }, ico ? icon(ico) : null, label, count != null ? h('span.count', count) : null);

  const platforms = Object.keys(PLATFORMS).filter((p) => state.links.some((l) => l.platform === p));
  const filters = h('div.filters', { role: 'group', 'aria-label': 'Filter links' },
    h('div.filter-cluster', { role: 'group', 'aria-label': 'Status' },
      btn(v.status === 'all', 'All', () => { v.status = 'all'; rerender(); }),
      btn(v.status === 'todo', 'To watch', () => { v.status = v.status === 'todo' ? 'all' : 'todo'; rerender(); }, { count: n((l) => l.status === 'todo') }),
      btn(v.status === 'done', 'Done', () => { v.status = v.status === 'done' ? 'all' : 'done'; rerender(); }, { count: n((l) => l.status === 'done') })),
    h('span.filter-sep', { 'aria-hidden': 'true' }),
    btn(v.favoritesOnly, 'Favorites', () => { v.favoritesOnly = !v.favoritesOnly; rerender(); }, { count: n((l) => l.is_favorite), ico: 'star', title: 'Show favorites only' }),
    platforms.length > 1 ? h('span.filter-sep', { 'aria-hidden': 'true' }) : null,
    platforms.length > 1
      ? h('div.filter-cluster', { role: 'group', 'aria-label': 'Platform' },
          platforms.map((p) => btn(v.platform === p, platformLabel(p), () => { v.platform = v.platform === p ? null : p; rerender(); },
            { count: n((l) => l.platform === p), title: `Only ${platformLabel(p)} links` })))
      : null,
    sections.length ? h('span.filter-break', { 'aria-hidden': 'true' }) : null,
    sections.map((s) =>
      h('div.filter-cluster', { role: 'group', 'aria-label': s.group ? s.group.name : 'Other tags' },
        labelled ? h('span.filter-group', { 'aria-hidden': 'true' }, s.group ? s.group.name : 'Other') : null,
        s.tags.map((t) => btn(v.tags.has(t.id), t.name, () => { v.tags.has(t.id) ? v.tags.delete(t.id) : v.tags.add(t.id); rerender(); }, { count: counts.get(t.id) })))));
  return h('nav.filterbar.vault-filters', { 'aria-label': 'Filters' },
    filters,
    h('label.search', h('span.search-label', 'Search'), searchInput));
}

export function renderVault(root, rerender) {
  if (!state.linksReady) {
    root.replaceChildren(h('div.empty',
      h('h2', 'One more setup step'),
      h('p.muted', 'The Link Vault needs its database tables. In Supabase, run the file supabase/migrations/20261105_01_link_vault.sql (README → “Run the update files”), then reload this page.'),
      h('a.btn', { href: '#/characters' }, 'Go to Characters')));
    return;
  }
  const list = filteredLinks();
  let body;
  if (!state.links.length) {
    body = h('div.empty',
      h('h2', 'Nothing saved yet'),
      h('p.muted', 'Save videos, posts and articles here. Paste a link (Ctrl+V works too), type it in, or use the “Save to Vault” shortcut from your iPhone’s Share sheet.'),
      h('div.row', pasteLinkButton(), h('button.btn.primary', { onclick: () => openAddLink() }, 'Add link')));
  } else if (!list.length) {
    body = h('div.empty',
      h('h2', 'No matches'),
      h('p.muted', 'Nothing fits the current search and filters.'),
      h('button.btn', { onclick: () => { clearLinkFilters(); const s = document.querySelector('#search'); if (s) s.value = ''; rerender(); } }, 'Clear filters'));
  } else if (state.linkView === 'list') {
    body = h('ul.rows.link-rows', list.map((l) => linkRow(l, rerender)));
  } else {
    body = h('div.link-grid', list.map((l) => linkCard(l, rerender)));
  }
  const tools = state.links.length
    ? viewTools({
        count: hasLinkFilters() ? `${list.length} of ${plural(state.links.length, 'link')}` : plural(state.links.length, 'link'),
        key: 'link', view: state.linkView, sort: state.linkSort,
        onChange: ({ view, sort }) => { if (view) state.linkView = view; if (sort) state.linkSort = sort; rerender(); },
      })
    : null;
  root.replaceChildren(...[tools, body].filter(Boolean));
  loadLinkImages(body);
  queueMissingPreviews();
}

function starButton(l, rerender) {
  const b = h(`button.star${l.is_favorite ? '.on' : ''}`, {
    type: 'button',
    title: l.is_favorite ? 'Remove from favorites' : 'Add to favorites',
    'aria-label': `${l.is_favorite ? 'Unfavorite' : 'Favorite'} ${linkTitle(l)}`,
    'aria-pressed': String(!!l.is_favorite),
    onclick: (e) => {
      e.preventDefault();
      patchLink(l, { is_favorite: !l.is_favorite }, () => {
        b.classList.toggle('on', l.is_favorite);
        b.setAttribute('aria-pressed', String(l.is_favorite));
        if (state.vault.favoritesOnly) rerender();
      }).catch(errorToast);
    },
  }, icon('star'));
  return b;
}

/** Tick to mark a link Done (or back to To watch). */
export function doneButton(l, rerender) {
  const done = l.status === 'done';
  return h(`button.star.done-btn${done ? '.on' : ''}`, {
    type: 'button',
    title: done ? 'Done — mark as “To watch” again' : 'Mark as done',
    'aria-label': `${done ? 'Mark as to watch' : 'Mark as done'}: ${linkTitle(l)}`,
    'aria-pressed': String(done),
    onclick: (e) => {
      e.preventDefault();
      patchLink(l, { status: done ? 'todo' : 'done' }, rerender).catch(errorToast);
    },
  }, icon('done'));
}

export const metaLine = (l) => (l.platform === 'web' ? domainOf(l.url) : `${platformLabel(l.platform)} · ${domainOf(l.url)}`);
function tagLine(l) {
  const t = tagNamesOf(l);
  return t.slice(0, 4).join(' · ') + (t.length > 4 ? ` +${t.length - 4}` : '');
}

function linkCard(l, rerender) {
  const href = `#/l/${l.id}`;
  const tags = tagLine(l);
  return h(`div.card.link-card${l.status === 'done' ? '.is-done' : ''}`, { 'data-id': l.id },
    h('a.card-media-link', { href, tabindex: '-1', 'aria-hidden': 'true' }, linkMedia(l)),
    h('div.caption',
      h('a.card-link', { href },
        h('p.link-eyebrow', metaLine(l), l.status === 'done' ? h('span.status-pill', 'Done') : null),
        h('h3.card-name.link-name', linkTitle(l)),
        tags ? h('p.card-meta', tags) : null),
      h('div.card-actions', doneButton(l, rerender), starButton(l, rerender))));
}

function linkRow(l, rerender) {
  const href = `#/l/${l.id}`;
  const tags = tagLine(l);
  return h(`li.row-item${l.status === 'done' ? '.is-done' : ''}`, { 'data-id': l.id },
    h('a.row-thumb.link-thumb', { href, tabindex: '-1', 'aria-hidden': 'true' }, linkMedia(l, { compact: true })),
    h('a.row-text', { href },
      h('span.row-name', linkTitle(l)),
      h('span.row-sub', metaLine(l), ' · ', l.status === 'done' ? 'Done' : 'To watch'),
      tags ? h('span.row-tags', tags) : null),
    h('div.card-actions', doneButton(l, rerender), starButton(l, rerender)));
}
