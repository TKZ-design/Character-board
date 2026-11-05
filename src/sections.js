// The hub's sections. To add one later: add an entry here, a route in main.js
// (renderView), and its views — the home tiles and the header switcher pick it up.
import { state, coverOf, sortCharacters } from './state.js';
import { linkCover } from './linkmedia.js';

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export const SECTIONS = [
  {
    id: 'characters',
    title: 'Characters',
    href: '#/characters',
    views: ['characters', 'c', 'compare'],       // routes that belong to this section
    count: () => state.characters.length,
    summary() {
      const favs = state.characters.filter((c) => c.is_favorite).length;
      return [plural(state.characters.length, 'character'), favs ? `${favs} ★` : null].filter(Boolean).join(' · ');
    },
    blurb: 'References, images and notes for every character.',
    previews: (n) => sortCharacters(state.characters, 'updated').map(coverOf).filter(Boolean).slice(0, n)
      .map((im) => ({ path: im.thumb_path || im.path })),
  },
  {
    id: 'links',
    title: 'Link Vault',
    href: '#/links',
    views: ['links', 'l'],
    count: () => state.links.length,
    summary() {
      if (!state.linksReady) return 'Needs a database update';
      const todo = state.links.filter((l) => l.status === 'todo').length;
      return [plural(state.links.length, 'link'), todo ? `${todo} to watch` : null].filter(Boolean).join(' · ');
    },
    blurb: 'Videos, posts and articles to watch later.',
    previews: (n) => state.links.map(linkCover).filter(Boolean).slice(0, n),
  },
];

/** Which section a route belongs to (null for shared pages like Tags). */
export function sectionOf(view) {
  return SECTIONS.find((s) => s.views.includes(view)) || null;
}
