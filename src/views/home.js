import { h, icon } from '../ui.js';
import { state, coverOf, sortItems } from '../state.js';
import { SECTIONS } from '../sections.js';
import { linkMedia } from './link-card.js';
import { loadThumbs } from '../thumbs.js';
import { pasteLinkButton } from './add-link.js';
import { openNewCharacter } from './new-character.js';

/** Up to 3 recent pictures for a tile. */
function previews(id) {
  if (id === 'characters') {
    return sortItems(state.characters, 'updated').map(coverOf).filter(Boolean).slice(0, 3)
      .map((im) => h('span.hub-tile-pic', h('img', { alt: '', loading: 'lazy', 'data-path': im.thumb_path || im.path })));
  }
  if (id === 'links') {
    return state.links.slice(0, 3).map((l) => h('span.hub-tile-pic', linkMedia(l, { size: 'tile' })));
  }
  return [];
}

function tile(s) {
  const pics = previews(s.id);
  return h('a.hub-tile', { href: s.href },
    h('span.hub-tile-media', { 'data-n': pics.length }, pics.length ? pics : h('span.hub-tile-empty', 'Nothing here yet')),
    h('span.hub-tile-body',
      h('span.hub-tile-title', s.title, h('span.title-dot', '.')),
      h('span.hub-tile-count', s.summary().filter(Boolean).join(' · ')),
      h('span.hub-tile-go', 'Open', icon('arrow'))));
}

export function renderHome(root) {
  const nonEmpty = SECTIONS.filter((s) => s.count() > 0).length;
  root.replaceChildren(
    h('header.page-head.home-head',
      h('div.titleblock',
        h('p.eyebrow', `Personal hub · ${SECTIONS.length} sections`),
        h('h1.title', nonEmpty ? 'Welcome back' : 'Welcome', h('span.title-dot', '.'))),
      h('div.actions',
        state.linksReady ? pasteLinkButton() : null,
        h('button.btn', { onclick: () => openNewCharacter() }, icon('plus'), 'New character'))),
    h('nav.hub-tiles', { 'aria-label': 'Sections' }, SECTIONS.map(tile)));
  loadThumbs(root);
}
