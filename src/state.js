import { realApi } from './api.js';

export let api = realApi;
export function setApi(a) { api = a; }

export const state = {
  user: null,
  characters: [],
  loaded: false,
  search: '',
  tags: new Set(),        // selected tag filters (character must have ALL of them)
};

export function findChar(id) {
  return state.characters.find((c) => c.id === id);
}

export function normTag(t) {
  return t.trim().replace(/^#/, '').replace(/\s+/g, ' ').toLowerCase();
}

/** [{ tag, count }] sorted by count, then name */
export function allTags() {
  const counts = new Map();
  for (const c of state.characters) for (const t of c.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function filtered() {
  const q = state.search.trim().toLowerCase();
  return state.characters.filter((c) =>
    (!q || c.name.toLowerCase().includes(q)) &&
    [...state.tags].every((t) => c.tags?.includes(t)),
  );
}

export function hasFilters() {
  return !!state.search.trim() || state.tags.size > 0;
}

/** Image used on the grid card */
export function coverOf(c) {
  return c.images[0] || null;
}
