import { realApi } from './api.js';
import { tagKey, matchesSearch } from './text.js';
import { matchesLinkSearch } from './linkutil.js';
import { getPref } from './prefs.js';

export const VIEWS = ['grid', 'list'];
export const SORTS = { added: 'Date added', updated: 'Last updated', name: 'Name' };

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
  charView: getPref('char-view', 'grid', VIEWS),
  charSort: getPref('char-sort', 'added', Object.keys(SORTS)),

  // ---- Link Vault ----
  links: [],              // each has tag_ids: [uuid], character_ids: [uuid]
  linksReady: false,      // false when the Link Vault migration hasn't been run yet
  vault: { search: '', tags: new Set(), status: 'all', favoritesOnly: false, platform: null },
  linkView: getPref('link-view', 'grid', VIEWS),
  linkSort: getPref('link-sort', 'added', Object.keys(SORTS)),
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

/** How many links use each tag: Map(tagId → count) */
export function linkTagCounts() {
  const counts = new Map(state.tagList.map((t) => [t.id, 0]));
  for (const l of state.links) for (const id of l.tag_ids || []) counts.set(id, (counts.get(id) || 0) + 1);
  return counts;
}

/** Characters + links per tag: Map(tagId → { chars, links, total }) */
export function tagUsage() {
  const c = tagCounts(), l = linkTagCounts();
  return new Map(state.tagList.map((t) => {
    const chars = c.get(t.id) || 0, links = l.get(t.id) || 0;
    return [t.id, { chars, links, total: chars + links }];
  }));
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

/** A character's (or link's) tags as objects, in display order (by group, then name). */
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
  for (const id of ids) { state.tags.delete(id); state.vault.tags.delete(id); }
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

const byText = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true });
const newest = (a, b) => String(b || '').localeCompare(String(a || ''));

/** When a character last changed: an edit, or a newly added image. */
export function lastUpdated(c) {
  let t = c.updated_at || c.created_at || '';
  for (const im of c.images || []) if ((im.created_at || '') > t) t = im.created_at;
  return t;
}

export function sortCharacters(list, how = state.charSort) {
  const out = [...list];
  if (how === 'name') out.sort((a, b) => byText(a.name, b.name) || byText(a.source, b.source));
  else if (how === 'updated') out.sort((a, b) => newest(lastUpdated(a), lastUpdated(b)));
  else out.sort((a, b) => newest(a.created_at, b.created_at));
  return out;
}

export function filtered() {
  return sortCharacters(state.characters.filter((c) =>
    (!state.favoritesOnly || c.is_favorite) &&
    matchesSearch(c, state.search) &&
    [...state.tags].every((t) => c.tag_ids?.includes(t)),
  ));
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

// ---------------- links (Link Vault) ----------------

export function findLink(id) {
  return state.links.find((l) => l.id === id);
}

export function sortLinks(list, how = state.linkSort) {
  const out = [...list];
  if (how === 'name') out.sort((a, b) => byText(a.title || a.url, b.title || b.url));
  else if (how === 'updated') out.sort((a, b) => newest(a.updated_at || a.created_at, b.updated_at || b.created_at));
  else out.sort((a, b) => newest(a.created_at, b.created_at));
  return out;
}

export function filteredLinks() {
  const v = state.vault;
  return sortLinks(state.links.filter((l) =>
    (v.status === 'all' || l.status === v.status) &&
    (!v.favoritesOnly || l.is_favorite) &&
    (!v.platform || l.platform === v.platform) &&
    matchesLinkSearch(l, v.search) &&
    [...v.tags].every((t) => l.tag_ids?.includes(t)),
  ));
}

export function hasLinkFilters() {
  const v = state.vault;
  return !!v.search.trim() || v.tags.size > 0 || v.favoritesOnly || v.status !== 'all' || !!v.platform;
}

export function clearLinkFilters() {
  Object.assign(state.vault, { search: '', status: 'all', favoritesOnly: false, platform: null });
  state.vault.tags.clear();
}

/** Links that belong to a character, newest first. */
export function linksOf(c) {
  return sortLinks(state.links.filter((l) => l.character_ids?.includes(c.id)), 'added');
}

/** Saved links with the same normalised address. */
export function duplicatesOf(key, exceptId = null) {
  return key ? state.links.filter((l) => l.url_key === key && l.id !== exceptId) : [];
}

/** Optimistic update of a few fields on a link (star, status…). */
export async function patchLink(l, patch, after) {
  const before = Object.fromEntries(Object.keys(patch).map((k) => [k, l[k]]));
  Object.assign(l, patch);
  after?.();
  try {
    const row = await api.updateLink(l.id, patch);
    Object.assign(l, { updated_at: row.updated_at });
  } catch (e) {
    Object.assign(l, before);
    after?.();
    throw e;
  }
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

export async function saveLinkCharacters(l, ids) {
  const want = [...new Set(ids)].sort().join(',');
  if (want === [...(l.character_ids || [])].sort().join(',')) return;
  l.character_ids = await api.setLinkCharacters(l.id, [...new Set(ids)]);
}
