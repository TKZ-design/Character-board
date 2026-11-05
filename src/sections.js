// The hub's sections. To add a new one later:
//   1. add an entry here (id, title, href, the route names it owns, a summary for the home tile)
//   2. add its route(s) to ROUTES in main.js and a header in main.js → sectionHeader()
import { state } from './state.js';

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export const SECTIONS = [
  {
    id: 'characters',
    title: 'Characters',
    short: 'Characters',
    href: '#/characters',
    views: ['characters', 'c', 'compare'],
    count: () => state.characters.length,
    summary() {
      const imgs = state.characters.reduce((n, c) => n + c.images.length, 0);
      const favs = state.characters.filter((c) => c.is_favorite).length;
      return [plural(state.characters.length, 'character'), plural(imgs, 'image'), favs ? plural(favs, 'favorite') : null];
    },
  },
  {
    id: 'links',
    title: 'Link Vault',
    short: 'Links',
    href: '#/links',
    views: ['links', 'l'],
    count: () => state.links.length,
    summary() {
      if (state.linksReady === false) return ['Needs a database update'];
      const todo = state.links.filter((l) => l.status === 'todo').length;
      const favs = state.links.filter((l) => l.is_favorite).length;
      return [plural(state.links.length, 'link'), todo ? `${todo} to watch` : null, favs ? plural(favs, 'favorite') : null];
    },
  },
  {
    id: 'notes',
    title: 'Notes',
    short: 'Notes',
    href: '#/notes',
    views: ['notes'],
    count: () => state.notes.length,
    summary() {
      if (state.notesReady === false) return ['Needs a database update'];
      const today = new Date().toDateString();
      const fresh = state.notes.filter((n) => new Date(n.created_at).toDateString() === today).length;
      return [plural(state.notes.length, 'note'), fresh ? `${fresh} today` : null];
    },
  },
];

/** The section a route belongs to (the Tags page belongs to whichever you came from). */
export function sectionOf(view) {
  if (view === 'tags') return SECTIONS.find((s) => s.id === state.lastSection) || SECTIONS[0];
  return SECTIONS.find((s) => s.views.includes(view)) || null;
}
