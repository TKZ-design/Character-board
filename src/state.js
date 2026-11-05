import { realApi } from './api.js';
import { tagKey, matchesSearch, normName } from './text.js';
import { linkMatches } from './links.js';

export let api = realApi;
export function setApi(a) { api = a; }

// ---------------- per-device preferences (view mode, sort) ----------------
export function getPref(key, fallback, allowed) {
  try { const v = localStorage.getItem('cb-' + key); if (v && (!allowed || allowed.includes(v))) return v; } catch {}
  return fallback;
}
export function setPref(key, value) {
  try { localStorage.setItem('cb-' + key, value); } catch {}
}
export const VIEWS = ['grid', 'list'];
export const SORTS = ['added', 'name', 'updated'];

export const state = {
  user: null,
  links: [],              // Link Vault: each has tag_ids and character_ids
  lastSection: 'characters', // where the Tags page's back link goes
  linksReady: null,       // null = loading, true = ok, false = database table missing (migration not run)
  linkFilter: { search: '', tags: new Set(), status: '', favoritesOnly: false, platform: '' },
  charView: getPref('char-view', 'grid', VIEWS),
  charSort: getPref('char-sort', 'added', SORTS),
  linkView: getPref('link-view', 'grid', VIEWS),
  linkSort: getPref('link-sort', 'added', SORTS),
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

/** How many links use each tag: Map(tagId → count) */
export function linkTagCounts() {
  const counts = new Map(state.tagList.map((t) => [t.id, 0]));
  for (const l of state.links) for (const id of l.tag_ids || []) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

/** Characters + links per tag: Map(tagId → number). */
export function tagUseCounts() {
  const counts = tagCounts();
  for (const [id, n] of linkTagCounts()) counts.set(id, (counts.get(id) || 0) + n);
  return counts;
}

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
  for (const l of state.links) {
    const had = (l.tag_ids || []).some((id) => gone.has(id));
    l.tag_ids = (l.tag_ids || []).filter((id) => !gone.has(id));
    if (had && replaceWith && !l.tag_ids.includes(replaceWith)) l.tag_ids.push(replaceWith);
  }
  for (const id of ids) { state.tags.delete(id); state.linkFilter.tags.delete(id); }
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

// ---------------- sorting (characters and links) ----------------

/** Newest of: the row's own update, and (for characters) its newest image. */
export function lastUpdated(item) {
  let t = item.updated_at || item.created_at || '';
  for (const im of item.images || []) if (im.created_at > t) t = im.created_at;
  return t;
}

/** Sort a copy: 'added' (newest first), 'name' (A–Z) or 'updated' (most recent first). */
export function sortItems(list, sort, nameOf = (x) => x.name) {
  const out = [...list];
  if (sort === 'name') out.sort((a, b) => String(nameOf(a)).localeCompare(String(nameOf(b)), undefined, { sensitivity: 'base', numeric: true }));
  else if (sort === 'updated') out.sort((a, b) => lastUpdated(b).localeCompare(lastUpdated(a)));
  else out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return out;
}

// ---------------- Link Vault ----------------

export function findLink(id) {
  return state.links.find((l) => l.id === id);
}

/** Display title: your title, else the site's, else the address. */
export function linkTitle(l) {
  return l.title?.trim() || l.url.replace(/^https?:\/\/(www\.)?/, '');
}

export function filteredLinks() {
  const f = state.linkFilter;
  return state.links.filter((l) =>
    (!f.favoritesOnly || l.is_favorite) &&
    (!f.status || l.status === f.status) &&
    (!f.platform || l.platform === f.platform) &&
    [...f.tags].every((t) => l.tag_ids?.includes(t)) &&
    (linkMatches(l, f.search, normName) || tagNamesOf(l).some((t) => normName(t).includes(normName(f.search)))),
  );
}

export function hasLinkFilters() {
  const f = state.linkFilter;
  return !!f.search.trim() || f.tags.size > 0 || !!f.status || f.favoritesOnly || !!f.platform;
}

export function clearLinkFilters() {
  Object.assign(state.linkFilter, { search: '', status: '', favoritesOnly: false, platform: '' });
  state.linkFilter.tags.clear();
}

/** Links connected to a character. */
export function linksOf(c) {
  return state.links.filter((l) => l.character_ids?.includes(c.id));
}

/** Save a link's tags by name (missing ones are created). */
export async function saveLinkTags(l, names) {
  const want = [...new Set(names.map(tagKey))].sort().join('\n');
  const have = tagNamesOf(l).map(tagKey).sort().join('\n');
  if (want === have) return;
  const rows = await api.setLinkTags(l.id, names);
  upsertTags(rows);
  l.tag_ids = rows.map((r) => r.id);
}

/** Save which characters a link is connected to. */
export async function saveLinkCharacters(l, ids) {
  const before = l.character_ids || [];
  if ([...ids].sort().join() === [...before].sort().join()) return;
  await api.setLinkCharacters(l.id, ids, before);
  l.character_ids = [...ids];
}

/** Optimistic update of a link's own fields (favorite, status…). */
export async function patchLink(l, patch, after) {
  const before = Object.fromEntries(Object.keys(patch).map((k) => [k, l[k]]));
  Object.assign(l, patch);
  after?.();
  try {
    const row = await api.updateLink(l.id, patch);
    l.updated_at = row.updated_at;
  } catch (e) {
    Object.assign(l, before);
    after?.();
    throw e;
  }
}

export function randomLink(excludeId) {
  const pool = filteredLinks();
  const choices = pool.length > 1 ? pool.filter((l) => l.id !== excludeId) : pool;
  return choices[Math.floor(Math.random() * choices.length)] || null;
}
