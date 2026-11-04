import { h, icon, errorToast, toast } from '../ui.js';
import { go } from '../nav.js';
import { api, state, allTags, filtered, hasFilters, coverOf, toggleFavorite } from '../state.js';
import { openNewCharacter } from './new-character.js';

export function renderGrid(root, rerender) {
  const tags = allTags();
  const list = filtered();

  const favCount = state.characters.filter((c) => c.is_favorite).length;
  const toolbar = state.characters.length
    ? h('div.toolbar',
        h(`button.btn.fav-filter${state.favoritesOnly ? '.on' : ''}`, {
          'aria-pressed': String(state.favoritesOnly),
          title: 'Show favorites only',
          onclick: () => { state.favoritesOnly = !state.favoritesOnly; rerender(); },
        }, icon('star'), 'Favorites', h('span.count', favCount)),
        h(`button.btn${state.compareMode ? '.on' : ''}`, {
          'aria-pressed': String(state.compareMode),
          title: 'Pick 2–3 characters to view side by side',
          onclick: () => { state.compareMode = !state.compareMode; state.compareSel = []; rerender(); },
        }, icon('columns'), 'Compare'))
    : null;

  const compareBar = state.compareMode
    ? h('div.compare-bar', { role: 'region', 'aria-label': 'Compare selection' },
        h('span', state.compareSel.length ? `${state.compareSel.length} of 3 selected` : 'Tap 2–3 characters to compare'),
        h('button.btn', { onclick: () => { state.compareMode = false; state.compareSel = []; rerender(); } }, 'Cancel'),
        h('button.btn.primary', {
          disabled: state.compareSel.length < 2,
          onclick: () => go(`#/compare/${state.compareSel.join(',')}`),
        }, icon('columns'), 'Compare'))
    : null;

  const tagBar = tags.length
    ? h('div.tagbar', { role: 'group', 'aria-label': 'Filter by tag' },
        tags.map(({ tag, count }) =>
          h(`button.chip.filter${state.tags.has(tag) ? '.on' : ''}`, {
            'aria-pressed': String(state.tags.has(tag)),
            onclick: () => { state.tags.has(tag) ? state.tags.delete(tag) : state.tags.add(tag); rerender(); },
          }, tag, h('span.count', count))),
        state.tags.size ? h('button.chip.clear', { onclick: () => { state.tags.clear(); rerender(); } }, 'Clear') : null)
    : null;

  let body;
  if (!state.characters.length) {
    body = h('div.empty',
      icon('image', 'big'),
      h('h2', 'No characters yet'),
      h('p.muted', 'Create your first one — or just drop or paste (Ctrl+V) an image anywhere on this page.'),
      h('button.btn.primary', { onclick: () => openNewCharacter() }, icon('plus'), 'New character'));
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
    toolbar,
    tagBar,
    hasFilters() && list.length ? h('p.result-count.muted', `${list.length} of ${state.characters.length} characters`) : null,
    body,
    compareBar,
  ].filter(Boolean));
}

function card(c, rerender) {
  const cover = coverOf(c);
  const media = cover
    ? h('div.card-media', { style: `aspect-ratio:${cover.width || 3}/${cover.height || 4}` },
        h('img', { alt: '', loading: 'lazy', decoding: 'async', 'data-path': cover.thumb_path || cover.path }))
    : h('div.card-media.placeholder', icon('image'));
  const star = h(`button.star${c.is_favorite ? '.on' : ''}`, {
    title: c.is_favorite ? 'Remove from favorites' : 'Add to favorites',
    'aria-label': c.is_favorite ? `Unfavorite ${c.name}` : `Favorite ${c.name}`,
    'aria-pressed': String(!!c.is_favorite),
    onclick: (e) => {
      e.preventDefault();
      toggleFavorite(c, () => {
        star.classList.toggle('on', c.is_favorite);
        star.setAttribute('aria-pressed', String(c.is_favorite));
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
  return h(`div.card${state.compareMode ? '.selectable' : ''}${selIdx >= 0 ? '.selected' : ''}`, { 'data-id': c.id },
    state.compareMode ? h('span.sel-badge', { 'aria-hidden': 'true' }, selIdx >= 0 ? String(selIdx + 1) : '') : null,
    h('a.card-link', { href: `#/c/${c.id}`, onclick: onLink, 'aria-pressed': state.compareMode ? String(selIdx >= 0) : null },
      media,
      h('div.card-meta',
        h('h3', c.name),
        c.tags?.length ? h('div.card-tags', c.tags.slice(0, 4).map((t) => h('span.chip.small', t)), c.tags.length > 4 ? h('span.muted.small', `+${c.tags.length - 4}`) : null) : null,
        c.images.length > 1 ? h('span.img-count', { title: `${c.images.length} images` }, icon('image'), c.images.length) : null,
      )),
    star);
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
