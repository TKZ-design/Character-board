import { realApi } from './api.js';
import { tagKey, matchesSearch } from './text.js';

export let api = realApi;
export function setApi(a) { api = a; }

export const state = {
  user: null,
  characters: [],         // each has tag_ids: [uuid]
  tagList: [],            // [{ id, name, group_id }]
  groups: [],             // [{ id, name }]
  loaded: false,
  search: '',
  tags: new Set(),        // selected tag filters, by tag id (character must have ALL of them)
  favoritesOnly: false,
  compareMode: false,
  compareSel: [],         // ids of characters picked for compare (max 3)
};

export function findChar(id) {
  return state.characters.find((c) => c.id === id);
}

// ---------------- tags ----------------

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export function tagById(id) { return state.tagList.find((t) => t.id === id); }
export function tagByName(name) { const k = tagKey(name); return state.tagList.find((t) => tagKey(t.name) === k); }
export function groupById(id) { return state.groups.find((g) => g.id === id); }
export function sortedGroups() { return [...state.groups].sort(byName); }

/** How many characters use each tag: Map(tagId → count) */
export function tagCounts() {
  const counts = new Map(state.tagList.map((t) => [t.id, 0]));
  for (const c of state.characters) for (const id of c.tag_ids || []) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

/**
 * Tags organised for display: [{ group|null, tags: [tag] }].
 * Groups alphabetically, "Ungrouped" (group = null) last; tags alphabetically.
 * `filter(tag)` can hide tags (e.g. unused ones in the filter bar); empty sections are dropped unless keepEmpty.
 */
export function groupedTags({ filter = () => true, keepEmpty = false } = {}) {
  const sections = [...sortedGroups().map((g) => ({ group: g, tags: [] })), { group: null, tags: [] }];
  const index = new Map(sections.map((s) => [s.group?.id ?? null, s]));
  for (const t of [...state.tagList].sort(byName)) {
    if (!filter(t)) continue;
    (index.get(t.group_id) || index.get(null)).tags.push(t);
  }
  return sections.filter((s) => keepEmpty || s.tags.length);
}

/** A character's tags as objects, in display order (by group, then name). */
export function tagsOf(c) {
  const order = new Map();
  groupedTags().forEach((s, si) => s.tags.forEach((t, ti) => order.set(t.id, si * 10000 + ti)));
  return (c.tag_ids || []).map(tagById).filter(Boolean).sort((a, b) => order.get(a.id) - order.get(b.id));
}
export function tagNamesOf(c) { return tagsOf(c).map((t) => t.name); }

/** Add/replace tag rows we got back from the server. */
export function upsertTags(rows) {
  for (const r of rows) {
    const i = state.tagList.findIndex((t) => t.id === r.id);
    const tag = { id: r.id, name: r.name, group_id: r.group_id ?? null };
    if (i >= 0) state.tagList[i] = tag; else state.tagList.push(tag);
  }
}

/** Save a character's tags (by name — missing ones are created). Skips the request if nothing changed. */
export async function saveCharacterTags(c, names) {
  const want = [...new Set(names.map(tagKey))].sort().join('\n');
  const have = tagNamesOf(c).map(tagKey).sort().join('\n');
  if (want === have) return;
  const rows = await api.setCharacterTags(c.id, names);
  upsertTags(rows);
  c.tag_ids = rows.map((r) => r.id);
}

/** Forget tags locally (after delete/merge) and drop them from filters. */
export function dropTagsLocally(ids, replaceWith = null) {
  const gone = new Set(ids);
  state.tagList = state.tagList.filter((t) => !gone.has(t.id));
  for (const c of state.characters) {
    const had = (c.tag_ids || []).some((id) => gone.has(id));
    c.tag_ids = (c.tag_ids || []).filter((id) => !gone.has(id));
    if (had && replaceWith && !c.tag_ids.includes(replaceWith)) c.tag_ids.push(replaceWith);
  }
  for (const id of ids) state.tags.delete(id);
}

// ---------------- characters ----------------

/** Distinct sources already in use (for autocomplete), most used first. */
export function allSources() {
  const counts = new Map();
  for (const c of state.characters) {
    const s = (c.source || '').trim();
    if (s) counts.set(s, (counts.get(s) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
}

export function filtered() {
  return state.characters.filter((c) =>
    (!state.favoritesOnly || c.is_favorite) &&
    matchesSearch(c, state.search) &&
    [...state.tags].every((t) => c.tag_ids?.includes(t)),
  );
}

export function hasFilters() {
  return !!state.search.trim() || state.tags.size > 0 || state.favoritesOnly;
}

/** Image used on the grid card */
export function coverOf(c) {
  return c.images.find((i) => i.id === c.cover_image_id) || c.images[0] || null;
}

/** Star / unstar a character (optimistic: the UI updates instantly). */
export async function toggleFavorite(c, after) {
  c.is_favorite = !c.is_favorite;
  after?.();
  try {
    await api.updateCharacter(c.id, { is_favorite: c.is_favorite });
  } catch (e) {
    c.is_favorite = !c.is_favorite;
    after?.();
    throw e;
  }
}

/** A random character that matches the current filters (avoids `excludeId` when possible). */
export function randomCharacter(excludeId) {
  const pool = filtered();
  const choices = pool.length > 1 ? pool.filter((c) => c.id !== excludeId) : pool;
  return choices[Math.floor(Math.random() * choices.length)] || null;
}
