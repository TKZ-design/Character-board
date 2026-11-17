import { h, icon, errorToast, toast } from '../ui.js';
import { go } from '../nav.js';
import { api, state, filtered, hasFilters, coverOf, toggleFavorite, groupedTags, tagCounts, tagNamesOf, sortItems, setPref } from '../state.js';
import { openNewCharacter } from './new-character.js';
import { viewBar, listRow } from './viewbar.js';
import { chipRow } from './menu.js';

/** One sideways-scrolling row of chips: All, Favorites, then the tags (grouped, in order). */
export function filterChips(rerender) {
  const counts = tagCounts();
  // only tags that are actually used, organised by group
  const sections = groupedTags({ filter: (t) => counts.get(t.id) > 0 });
  const labelled = sections.some((s) => s.group);
  const favCount = state.characters.filter((c) => c.is_favorite).length;
  const none = !state.tags.size && !state.favoritesOnly;
  const tagButton = (t) =>
    h(`button.filter${state.tags.has(t.id) ? '.on' : ''}`, {
      type: 'button', 'aria-pressed': String(state.tags.has(t.id)),
      onclick: () => { state.tags.has(t.id) ? state.tags.delete(t.id) : state.tags.add(t.id); rerender(); },
    }, t.name, h('span.count', counts.get(t.id)));
  return chipRow('Filter characters', [
    h(`button.filter${none ? '.on' : ''}`, {
      type: 'button', 'aria-pressed': String(none), title: 'Show everything',
      onclick: () => { state.tags.clear(); state.favoritesOnly = false; rerender(); },
    }, 'All'),
    h(`button.filter.fav-filter${state.favoritesOnly ? '.on' : ''}`, {
      type: 'button', 'aria-pressed': String(state.favoritesOnly), title: 'Show favorites only',
      onclick: () => { state.favoritesOnly = !state.favoritesOnly; rerender(); },
    }, icon('star'), 'Favorites', h('span.count', favCount)),
    sections.map((s) => [
      labelled ? h('span.filter-group', s.group ? s.group.name : 'Other') : null,
      s.tags.map(tagButton),
    ]),
  ]);
}

export function renderGrid(root, rerender) {
  const list = sortItems(filtered(), state.charSort);

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
      h('p.muted', 'Create your first one with the + button — or just drop, paste (Ctrl+V) or share an image to this page.'),
      h('button.btn.primary', { onclick: () => openNewCharacter() }, 'New character'));
  } else if (!list.length) {
    body = h('div.empty',
      h('h2', 'No matches'),
      h('p.muted', 'Nothing fits the current search and filters.'),
      h('button.btn', { onclick: () => { state.search = ''; state.tags.clear(); state.favoritesOnly = false; rerender(); } }, 'Clear filters'));
  } else {
    body = state.charView === 'list'
      ? h('ul.lrows.char-rows', list.map((c) => row(c, rerender)))
      : h('div.cgrid', list.map((c) => card(c, rerender)));
    loadThumbs(body, list);
  }

  const n = state.characters.length;
  const bar = n
    ? viewBar({
        text: hasFilters() ? `${list.length} of ${n} characters` : `${n} character${n === 1 ? '' : 's'}`,
        sort: state.charSort, view: state.charView,
        onSort: (v) => { state.charSort = v; setPref('char-sort', v); rerender(); },
        onView: (v) => { state.charView = v; setPref('char-view', v); rerender(); },
      })
    : null;

  root.replaceChildren(...[
    bar,
    body,
    compareBar,
  ].filter(Boolean));
}

function starFor(c, rerender) {
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
  return star;
}

/** In compare mode, tapping a character selects it instead of opening it. */
function compareClick(c, rerender) {
  const selIdx = state.compareSel.indexOf(c.id);
  const onLink = (e) => {
    if (!state.compareMode) return;
    e.preventDefault();
    if (selIdx >= 0) state.compareSel.splice(selIdx, 1);
    else if (state.compareSel.length >= 3) { toast('You can compare up to 3 characters'); return; }
    else state.compareSel.push(c.id);
    rerender();
  };
  return { selIdx, onLink };
}

function metaText(c) {
  const tags = tagNamesOf(c);
  const tagText = tags.slice(0, 4).join(' · ') + (tags.length > 4 ? ` +${tags.length - 4}` : '');
  const n = c.images.length;
  const countText = `${n} image${n === 1 ? '' : 's'}`;
  return tagText ? `${tagText} — ${countText}` : countText;
}

/** Compact list row: small thumbnail, name, source, tags, image count, star. */
function row(c, rerender) {
  const cover = coverOf(c);
  const { selIdx, onLink } = compareClick(c, rerender);
  return listRow({
    href: `#/c/${c.id}`,
    cls: `${state.compareMode ? '.selectable' : ''}${selIdx >= 0 ? '.selected' : ''}`,
    onclick: onLink,
    pressed: state.compareMode ? String(selIdx >= 0) : null,
    thumb: [
      state.compareMode ? h('span.sel-badge', { 'aria-hidden': 'true' }, selIdx >= 0 ? String(selIdx + 1) : '') : null,
      cover ? h('img', { alt: '', loading: 'lazy', decoding: 'async', 'data-path': cover.thumb_path || cover.path }) : h('span.lrow-noimg', 'No image'),
    ],
    title: c.name,
    sub: c.source || null,
    meta: metaText(c),
    buttons: [starFor(c, rerender)],
  });
}

/** "source · N images" */
function cardMeta(c) {
  const n = c.images.length;
  return [c.source, `${n} image${n === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
}

function card(c, rerender) {
  const cover = coverOf(c);
  const media = cover
    ? h('div.card-media', h('img', { alt: '', loading: 'lazy', decoding: 'async', 'data-path': cover.thumb_path || cover.path }))
    : h('div.card-media.placeholder', 'No image');
  const { selIdx, onLink } = compareClick(c, rerender);
  return h(`div.card${state.compareMode ? '.selectable' : ''}${selIdx >= 0 ? '.selected' : ''}`, { 'data-id': c.id },
    state.compareMode ? h('span.sel-badge', { 'aria-hidden': 'true' }, selIdx >= 0 ? String(selIdx + 1) : '') : null,
    // the image is a second, mouse-only way into the same link (keyboard/screen readers use the name)
    h('a.card-media-link', { href: `#/c/${c.id}`, onclick: onLink, tabindex: '-1', 'aria-hidden': 'true' }, media),
    h('a.card-link', { href: `#/c/${c.id}`, onclick: onLink, 'aria-pressed': state.compareMode ? String(selIdx >= 0) : null },
      h('h3.card-name', c.name),
      h('p.card-meta', cardMeta(c))),
    starFor(c, rerender));
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
