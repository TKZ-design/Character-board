import { h, icon } from '../ui.js';
import { api, state, allTags, filtered, hasFilters, coverOf } from '../state.js';
import { openNewCharacter } from './new-character.js';

export function renderGrid(root, rerender) {
  const tags = allTags();
  const list = filtered();

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
      h('button.btn', { onclick: () => { state.search = ''; state.tags.clear(); document.querySelector('#search')?.value && (document.querySelector('#search').value = ''); rerender(); } }, 'Clear filters'));
  } else {
    body = h('div.masonry', list.map((c) => card(c)));
    loadThumbs(body, list);
  }

  root.replaceChildren(...[
    tagBar,
    hasFilters() && list.length ? h('p.result-count.muted', `${list.length} of ${state.characters.length} characters`) : null,
    body,
  ].filter(Boolean));
}

function card(c) {
  const cover = coverOf(c);
  const media = cover
    ? h('div.card-media', { style: `aspect-ratio:${cover.width || 3}/${cover.height || 4}` },
        h('img', { alt: '', loading: 'lazy', decoding: 'async', 'data-path': cover.thumb_path || cover.path }))
    : h('div.card-media.placeholder', icon('image'));
  return h('a.card', { href: `#/c/${c.id}`, 'data-id': c.id },
    media,
    h('div.card-meta',
      h('h3', c.name),
      c.tags?.length ? h('div.card-tags', c.tags.slice(0, 4).map((t) => h('span.chip.small', t)), c.tags.length > 4 ? h('span.muted.small', `+${c.tags.length - 4}`) : null) : null,
      c.images.length > 1 ? h('span.img-count', { title: `${c.images.length} images` }, icon('image'), c.images.length) : null,
    ));
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
