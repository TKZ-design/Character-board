import { h, icon, toast } from '../ui.js';
import {
  state, filteredLinks, hasLinkFilters, clearLinkFilters, sortItems, linkTitle, groupedTags, linkTagCounts, setPref,
} from '../state.js';
import { parseUrl, platformLabel, PLATFORMS } from '../links.js';
import { openAddLink, pasteLinkButton } from './add-link.js';
import { linkCard, linkRow } from './link-card.js';
import { viewBar } from './viewbar.js';
import { loadThumbs } from '../thumbs.js';
import { previewsUnavailable } from '../previews.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

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
  const counts = linkTagCounts();
  const sections = groupedTags({ filter: (t) => counts.get(t.id) > 0 });
  const labelled = sections.some((s) => s.group);
  const has = state.links.length > 0;
  const by = (pred) => state.links.filter(pred).length;
  const statusBtn = (value, label) => h(`button.filter${f.status === value ? '.on' : ''}`, {
    type: 'button', 'aria-pressed': String(f.status === value),
    onclick: () => { f.status = value; rerender(); },
  }, label, value ? h('span.count', by((l) => l.status === value)) : null);
  const platforms = Object.keys(PLATFORMS).filter((p) => state.links.some((l) => l.platform === p));
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
    sections.length
      ? h('div.filters.tag-filter-row', { role: 'group', 'aria-label': 'Filter by tag' },
          sections.map((s) => h('div.filter-cluster', { role: 'group', 'aria-label': s.group ? s.group.name : 'Other tags' },
            labelled ? h('span.filter-group', { 'aria-hidden': 'true' }, s.group ? s.group.name : 'Other') : null,
            s.tags.map(tagButton))))
      : null);
}

/** Title, actions, quick add and filters for the Link Vault page. */
export function vaultMasthead(actions, render, renderView) {
  const f = state.linkFilter;
  const search = h('input#search', {
    type: 'search', placeholder: 'Title, site, notes or tag', value: f.search,
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

export function renderVault(root, rerender) {
  if (state.linksReady === null) { root.replaceChildren(h('div.loading', h('div.spinner'))); return; }
  if (state.linksReady === false) {
    root.replaceChildren(h('div.empty',
      h('h2', 'One quick setup step'),
      h('p.muted', 'The Link Vault needs its database tables. In Supabase → SQL Editor, run the file supabase/migrations/20261104_02_link_vault.sql (the README has the exact steps), then reload this page. Your characters are not affected.'),
      h('button.btn.primary', { onclick: () => location.reload() }, 'Reload')));
    return;
  }
  if (!state.links.length) {
    root.replaceChildren(h('div.empty',
      h('h2', 'No links yet'),
      h('p.muted', 'Paste a link anywhere (Ctrl+V), use Paste link, type one above — or on iPhone, share it with the “Save to Vault” shortcut.'),
      h('div.row', pasteLinkButton(), h('button.btn.primary', { onclick: () => openAddLink() }, 'Add link'))));
    return;
  }

  const list = sortItems(filteredLinks(), state.linkSort, linkTitle);
  const total = state.links.length;
  const bar = viewBar({
    text: hasLinkFilters() ? `${list.length} of ${plural(total, 'link')}` : plural(total, 'link'),
    sort: state.linkSort, view: state.linkView, nameLabel: 'Title',
    onSort: (s) => { state.linkSort = s; setPref('link-sort', s); rerender(); },
    onView: (v) => { state.linkView = v; setPref('link-view', v); rerender(); },
  });
  const after = () => { if (state.linkFilter.favoritesOnly || state.linkFilter.status) rerender(); };

  let body;
  if (!list.length) {
    body = h('div.empty',
      h('h2', 'No matches'),
      h('p.muted', 'Nothing fits the current search and filters.'),
      h('button.btn', { onclick: () => { clearLinkFilters(); rerender(); } }, 'Clear filters'));
  } else if (state.linkView === 'list') {
    body = h('ul.lrows', list.map((l) => linkRow(l, after)));
  } else {
    body = h('div.lgrid', list.map((l) => linkCard(l, after)));
  }
  root.replaceChildren(...[
    bar,
    previewsUnavailable() ? h('p.muted.small.vault-hint', 'Link previews are off until the “link-preview” Edge Function is deployed — see the README.') : null,
    body,
  ].filter(Boolean));
  loadThumbs(root);
}
