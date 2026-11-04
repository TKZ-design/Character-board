import { h, icon, errorToast, toast } from '../ui.js';
import { go } from '../nav.js';
import { api, state, filtered, hasFilters, coverOf, toggleFavorite, groupedTags, tagCounts, tagNamesOf } from '../state.js';
import { openNewCharacter } from './new-character.js';

/** Tag / favorites filters + search, shown under the title on the board. */
export function filterBar(searchInput, rerender) {
  const counts = tagCounts();
  // only tags that are actually used, organised by group
  const sections = groupedTags({ filter: (t) => counts.get(t.id) > 0 });
  const labelled = sections.some((s) => s.group);
  const favCount = state.characters.filter((c) => c.is_favorite).length;
  const tagButton = (t) =>
    h(`button.filter${state.tags.has(t.id) ? '.on' : ''}`, {
      'aria-pressed': String(state.tags.has(t.id)),
      onclick: () => { state.tags.has(t.id) ? state.tags.delete(t.id) : state.tags.add(t.id); rerender(); },
    }, t.name, h('span.count', counts.get(t.id)));
  const filters = state.characters.length
    ? h('div.filters', { role: 'group', 'aria-label': 'Filter by tag' },
        h(`button.filter${state.tags.size ? '' : '.on'}`, {
          'aria-pressed': String(!state.tags.size),
          title: 'Show all tags',
          onclick: () => { state.tags.clear(); rerender(); },
        }, 'All'),
        sections.map((s) =>
          h('div.filter-cluster', { role: 'group', 'aria-label': s.group ? s.group.name : 'Other tags' },
            labelled ? h('span.filter-group', { 'aria-hidden': 'true' }, s.group ? s.group.name : 'Other') : null,
            s.tags.map(tagButton))),
        h('span.filter-sep', { 'aria-hidden': 'true' }),
        h(`button.filter.fav-filter${state.favoritesOnly ? '.on' : ''}`, {
          'aria-pressed': String(state.favoritesOnly),
          title: 'Show favorites only',
          onclick: () => { state.favoritesOnly = !state.favoritesOnly; rerender(); },
        }, icon('star'), 'Favorites', h('span.count', favCount)))
    : h('div.filters');
  return h('nav.filterbar', { 'aria-label': 'Filters' },
    filters,
    h('label.search', h('span.search-label', 'Search'), searchInput));
}

export function renderGrid(root, rerender) {
  const list = filtered();

  const compareBar = state.compareMode
    ? h('div.compare-bar', { role: 'region', 'aria-label': 'Compare selection' },
        h('span.compare-status', state.compareSel.length ? `${state.compareSel.length} of 3 selected` : 'Tap 2–3 characters to compare'),
        h('button.btn', { onclick: () => { state.compareMode = false; state.compareSel = []; rerender(); } }, 'Cancel'),
        h('button.btn.primary', {
          disabled: state.compareSel.length < 2,
          onclick: () => go(`#/compare/${state.compareSel.join(',')}`),
        }, 'Compare'))
    : null;

  let body;
  if (!state.characters.length) {
    body = h('div.empty',
      h('h2', 'No characters yet'),
      h('p.muted', 'Create your first one — or just drop, paste (Ctrl+V) or share an image to this page.'),
      h('button.btn.primary', { onclick: () => openNewCharacter() }, 'Add character'));
  } else if (!list.length) {
    body = h('div.empty',
      h('h2', 'No matches'),
      h('p.muted', 'Nothing fits the current search and filters.'),
      h('button.btn', { onclick: () => { state.search = ''; state.tags.clear(); state.favoritesOnly = false; document.querySelector('#search')?.value && (document.querySelector('#search').value = ''); rerender(); } }, 'Clear filters'));
  } else {
    body = h('div.masonry', list.map((c) => card(c, rerender)));
    loadThumbs(body, list);
  }

  root.replaceChildren(...[
    hasFilters() && list.length ? h('p.result-count', `${list.length} of ${state.characters.length} characters`) : null,
    body,
    compareBar,
  ].filter(Boolean));
}

function card(c, rerender) {
  const cover = coverOf(c);
  const media = cover
    ? h('div.card-media', { style: `aspect-ratio:${cover.width || 3}/${cover.height || 4}` },
        h('img', { alt: '', loading: 'lazy', decoding: 'async', 'data-path': cover.thumb_path || cover.path }))
    : h('div.card-media.placeholder', 'No image');
  const star = h(`button.star${c.is_favorite ? '.on' : ''}`, {
    title: c.is_favorite ? 'Remove from favorites' : 'Add to favorites',
    'aria-label': c.is_favorite ? `Unfavorite ${c.name}` : `Favorite ${c.name}`,
    'aria-pressed': String(!!c.is_favorite),
    onclick: (e) => {
      e.preventDefault();
      toggleFavorite(c, () => {
        star.classList.toggle('on', c.is_favorite);
        star.setAttribute('aria-pressed', String(c.is_favorite));
        star.setAttribute('aria-label', c.is_favorite ? `Unfavorite ${c.name}` : `Favorite ${c.name}`);
        if (state.favoritesOnly) rerender();
      }).catch(errorToast);
    },
  }, icon('star'));
  const selIdx = state.compareSel.indexOf(c.id);
  const onLink = (e) => {
    if (!state.compareMode) return;
    e.preventDefault();
    if (selIdx >= 0) state.compareSel.splice(selIdx, 1);
    else if (state.compareSel.length >= 3) { toast('You can compare up to 3 characters'); return; }
    else state.compareSel.push(c.id);
    rerender();
  };
  const tags = tagNamesOf(c);
  const tagText = tags.slice(0, 4).join(' · ') + (tags.length > 4 ? ` +${tags.length - 4}` : '');
  const n = c.images.length;
  const countText = `${n} image${n === 1 ? '' : 's'}`;
  return h(`div.card${state.compareMode ? '.selectable' : ''}${selIdx >= 0 ? '.selected' : ''}`, { 'data-id': c.id },
    state.compareMode ? h('span.sel-badge', { 'aria-hidden': 'true' }, selIdx >= 0 ? String(selIdx + 1) : '') : null,
    // the image is a second, mouse-only way into the same link (keyboard/screen readers use the name)
    h('a.card-media-link', { href: `#/c/${c.id}`, onclick: onLink, tabindex: '-1', 'aria-hidden': 'true' }, media),
    h('div.caption',
      h('a.card-link', { href: `#/c/${c.id}`, onclick: onLink, 'aria-pressed': state.compareMode ? String(selIdx >= 0) : null },
        h('h3.card-name', c.name),
        c.source ? h('p.card-source', c.source) : null,
        h('p.card-meta', tagText ? `${tagText} — ${countText}` : countText)),
      star));
}

async function loadThumbs(container, list) {
  const paths = list.map((c) => { const i = coverOf(c); return i && (i.thumb_path || i.path); });
  try {
    const urls = await api.getUrls(paths);
    for (const img of container.querySelectorAll('img[data-path]')) {
      const u = urls[img.dataset.path];
      if (u) { img.onload = () => img.classList.add('loaded'); img.src = u; }
    }
  } catch (e) { console.error(e); }
}
