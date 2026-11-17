// Recent: links you still want to watch, then the 30 newest things added (characters and links mixed).
import { h } from '../ui.js';
import { state, coverOf, linkTitle, sortItems } from '../state.js';
import { linkRow } from './link-card.js';
import { listRow } from './viewbar.js';
import { loadThumbs } from '../thumbs.js';

export const RECENT_COUNT = 30;
const TODO_PREVIEW = 10;
let showAllTodo = false;

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function characterRow(c) {
  const cover = coverOf(c);
  const n = c.images.length;
  return listRow({
    href: `#/c/${c.id}`,
    thumb: cover
      ? h('img', { alt: '', loading: 'lazy', decoding: 'async', 'data-path': cover.thumb_path || cover.path })
      : h('span.lrow-noimg', 'No image'),
    title: c.name,
    sub: [c.source, plural(n, 'image')].filter(Boolean).join(' · '),
    meta: 'Character',
  });
}

/** The newest characters and links (links you still want to watch are shown above, not repeated here). */
export function latestItems(limit = RECENT_COUNT) {
  const mixed = [
    ...state.characters.map((item) => ({ kind: 'character', item })),
    ...(state.linksReady ? state.links.filter((l) => l.status !== 'todo').map((item) => ({ kind: 'link', item })) : []),
  ];
  mixed.sort((a, b) => String(b.item.created_at).localeCompare(String(a.item.created_at)));
  return mixed.slice(0, limit);
}

export function renderRecent(root, rerender) {
  const todo = state.linksReady ? sortItems(state.links.filter((l) => l.status === 'todo'), 'added', linkTitle) : [];
  const latest = latestItems();

  if (!todo.length && !latest.length) {
    root.replaceChildren(h('div.empty',
      h('h2', 'Nothing here yet'),
      h('p.muted', 'Things you add show up here, newest first — and links marked “To watch” wait at the top.')));
    return;
  }

  const shownTodo = showAllTodo ? todo : todo.slice(0, TODO_PREVIEW);
  const sections = [];
  if (todo.length) {
    sections.push(h('section.recent-section', { 'aria-labelledby': 'recent-todo' },
      h('div.section-head', h('h2#recent-todo', 'To watch'), h('span.muted', plural(todo.length, 'link'))),
      h('ul.lrows', shownTodo.map((l) => linkRow(l, rerender))),
      todo.length > TODO_PREVIEW
        ? h('button.btn.ghost.more-btn', { type: 'button', onclick: () => { showAllTodo = !showAllTodo; rerender(); } },
            showAllTodo ? 'Show fewer' : `Show all ${todo.length}`)
        : null));
  }
  if (latest.length) {
    sections.push(h('section.recent-section', { 'aria-labelledby': 'recent-latest' },
      h('div.section-head', h('h2#recent-latest', 'Recently added'), h('span.muted', 'Newest first')),
      h('ul.lrows', latest.map((e) => (e.kind === 'character' ? characterRow(e.item) : linkRow(e.item, rerender))))));
  }
  root.replaceChildren(...sections);
  loadThumbs(root);
}
