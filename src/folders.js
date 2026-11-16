// Link Vault folders: plain functions over a list of folder rows
// ({ id, name, parent_id, position }). No DOM, no network — used by the app,
// the ?mock backend and the unit tests. The database enforces the same rules
// (see supabase/migrations/20261116_01_vault_folders_tags.sql).

export const MAX_DEPTH = 3;
export const UNSORTED = 'unsorted';

const key = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export const cleanFolderName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

export function folderById(folders, id) {
  return id ? folders.find((f) => f.id === id) || null : null;
}

/** Direct subfolders, in their manual order. `parentId` null = top level. */
export function childrenOf(folders, parentId) {
  return folders.filter((f) => (f.parent_id ?? null) === (parentId ?? null)).sort(byPosition);
}

/** [top, …, folder] — the folder and everything above it. */
export function folderPath(folders, id) {
  const out = [];
  let f = folderById(folders, id);
  for (let guard = 0; f && guard < 20; guard++) { out.unshift(f); f = folderById(folders, f.parent_id); }
  return out;
}

/** "Art › Tutorials", or "Unsorted" for no folder. */
export function pathText(folders, id, sep = ' › ') {
  const p = folderPath(folders, id);
  return p.length ? p.map((f) => f.name).join(sep) : 'Unsorted';
}

/** 1 for a top-level folder, 2 for its subfolders… */
export function depthOf(folders, id) { return folderPath(folders, id).length; }

/** Levels in a folder's own subtree: 1 = no subfolders. */
export function heightOf(folders, id) {
  const kids = childrenOf(folders, id);
  return 1 + (kids.length ? Math.max(...kids.map((k) => heightOf(folders, k.id))) : 0);
}

/** The folder and all its subfolders (ids). */
export function subtreeIds(folders, id) {
  const out = new Set([id]);
  for (let added = true; added;) {
    added = false;
    for (const f of folders) if (f.parent_id && out.has(f.parent_id) && !out.has(f.id)) { out.add(f.id); added = true; }
  }
  return out;
}

/** A folder with this name already in that place (ignoring case)? */
export function nameClash(folders, parentId, name, exceptId = null) {
  return childrenOf(folders, parentId).find((f) => f.id !== exceptId && key(f.name) === key(name)) || null;
}

/** Why a new folder can't be made here (or null if it can). */
export function createProblem(folders, parentId, name) {
  const n = cleanFolderName(name);
  if (!n) return 'Please enter a name.';
  if (n.length > 80) return 'That name is too long (80 characters max).';
  if (parentId && depthOf(folders, parentId) >= MAX_DEPTH) return `Folders can only be ${MAX_DEPTH} levels deep, so this folder can’t have subfolders.`;
  const clash = nameClash(folders, parentId, n);
  if (clash) return `There’s already a folder called “${clash.name}” here.`;
  return null;
}

/** Why a folder can't be moved into `newParentId` (null = top level), or null if it can. */
export function moveProblem(folders, id, newParentId) {
  const f = folderById(folders, id);
  if (!f) return 'Folder not found.';
  if (newParentId && subtreeIds(folders, id).has(newParentId)) return 'A folder can’t be moved into itself or one of its own subfolders.';
  const above = newParentId ? depthOf(folders, newParentId) : 0;
  if (above + heightOf(folders, id) > MAX_DEPTH) return `That would make it more than ${MAX_DEPTH} levels deep.`;
  const clash = nameClash(folders, newParentId, f.name, id);
  if (clash) return `There’s already a folder called “${clash.name}” there.`;
  return null;
}

/** Next free position at the end of a place. */
export function nextPosition(folders, parentId) {
  const kids = childrenOf(folders, parentId);
  return kids.length ? Math.max(...kids.map((k) => k.position ?? 0)) + 1 : 0;
}

/**
 * New positions after moving a folder one step up (-1) or down (+1) among its
 * siblings: [{ id, position }] for the rows that change (empty if it can't move).
 */
export function reorder(folders, id, dir) {
  const f = folderById(folders, id);
  if (!f) return [];
  const sibs = childrenOf(folders, f.parent_id);
  const i = sibs.findIndex((s) => s.id === id), j = i + dir;
  if (j < 0 || j >= sibs.length) return [];
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  return sibs.map((s, position) => ({ id: s.id, position })).filter((p) => folderById(folders, p.id).position !== p.position);
}

/** "Name (2)" — a free name in a place (same rule as the database). */
export function freeName(folders, parentId, name, exceptId = null) {
  let n = 1, cand = name;
  while (nameClash(folders, parentId, cand, exceptId)) cand = `${name.slice(0, 74)} (${++n})`;
  return cand;
}

/**
 * What deleting a folder will do (mirrors the database trigger):
 * its links and subfolders move to its parent. Returns
 * { parentId, linkIds, subfolders: [{ id, from, to, position }] }.
 */
export function deletePlan(folders, links, id) {
  const f = folderById(folders, id);
  const parentId = f?.parent_id ?? null;
  const rest = folders.filter((x) => x.id !== id);
  let pos = Math.max(-1, ...childrenOf(rest, parentId).map((x) => x.position ?? 0));
  const moved = [];
  const working = rest.map((x) => ({ ...x }));
  for (const kid of childrenOf(folders, id)) {
    const w = working.find((x) => x.id === kid.id);
    const to = freeName(working.filter((x) => x.id !== kid.id), parentId, kid.name);
    Object.assign(w, { parent_id: parentId, name: to, position: ++pos });
    moved.push({ id: kid.id, from: kid.name, to, position: pos });
  }
  return { parentId, linkIds: links.filter((l) => l.folder_id === id).map((l) => l.id), subfolders: moved };
}

/** Apply deletePlan to local rows (mutates `folders` items and `links`); returns the remaining folders. */
export function applyDelete(folders, links, id) {
  const plan = deletePlan(folders, links, id);
  for (const l of links) if (l.folder_id === id) l.folder_id = plan.parentId;
  for (const m of plan.subfolders) Object.assign(folderById(folders, m.id), { parent_id: plan.parentId, name: m.to, position: m.position });
  return folders.filter((f) => f.id !== id);
}

/**
 * Tree rows in display order: [{ folder, depth, hasKids, open }]. Children
 * of folders not in `open` are skipped (pass null to include everything).
 */
export function flattenTree(folders, open = null, parentId = null, depth = 1, out = []) {
  for (const f of childrenOf(folders, parentId)) {
    const hasKids = folders.some((x) => x.parent_id === f.id);
    const isOpen = open === null || open.has(f.id);
    out.push({ folder: f, depth, hasKids, open: isOpen });
    if (hasKids && isOpen) flattenTree(folders, open, f.id, depth + 1, out);
  }
  return out;
}

/** Links in a folder's whole subtree, per folder id: Map(id → count). Also counts[UNSORTED]. */
export function folderCounts(folders, links) {
  const direct = new Map();
  let unsorted = 0;
  for (const l of links) {
    if (l.folder_id && folderById(folders, l.folder_id)) direct.set(l.folder_id, (direct.get(l.folder_id) || 0) + 1);
    else unsorted++;
  }
  const out = new Map();
  for (const f of folders) {
    let n = 0;
    for (const id of subtreeIds(folders, f.id)) n += direct.get(id) || 0;
    out.set(f.id, n);
  }
  out.set(UNSORTED, unsorted);
  return out;
}

/**
 * The one-time conversion, as plain JavaScript (same rules as the SQL file):
 * every link goes into a top-level folder named after its most-used tag
 * (ties: alphabetical); its other tags become Vault tags; shared tags that
 * were on links and that no character uses are deleted.
 *
 * input: { tags: [{id, name}], linkTags: [{link_id, tag_id}], characterTags: [{character_id, tag_id}], folders?: [] }
 * returns { folders: [{name, position}] (new ones only), linkFolder: Map(linkId → folder name),
 *           vaultTags: [name], vaultLinkTags: [{link_id, name}], deleteTagIds: [id] }
 */
export function convertTagsToFolders({ tags, linkTags, characterTags, folders = [] }) {
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const pairs = linkTags.filter((p) => tagName.has(p.tag_id));
  const uses = new Map();
  for (const p of pairs) uses.set(p.tag_id, (uses.get(p.tag_id) || 0) + 1);

  const byLink = new Map();
  for (const p of pairs) (byLink.get(p.link_id) || byLink.set(p.link_id, []).get(p.link_id)).push(p.tag_id);

  const cmp = (a, b) => (uses.get(b) - uses.get(a))
    || (key(tagName.get(a)) < key(tagName.get(b)) ? -1 : key(tagName.get(a)) > key(tagName.get(b)) ? 1 : 0)
    || (tagName.get(a) < tagName.get(b) ? -1 : tagName.get(a) > tagName.get(b) ? 1 : 0)
    || (a < b ? -1 : 1);

  const linkFolder = new Map();
  const vaultLinkTags = [];
  const folderNames = new Map(); // key → name
  const vaultTagNames = new Map();
  for (const [linkId, ids] of byLink) {
    const [first, ...rest] = [...ids].sort(cmp);
    const name = tagName.get(first);
    if (!folderNames.has(key(name))) folderNames.set(key(name), name);
    linkFolder.set(linkId, folderNames.get(key(name)));
    for (const id of rest) {
      const n = tagName.get(id);
      if (!vaultTagNames.has(key(n))) vaultTagNames.set(key(n), n);
      vaultLinkTags.push({ link_id: linkId, name: vaultTagNames.get(key(n)) });
    }
  }

  const existingTop = new Map(folders.filter((f) => !f.parent_id).map((f) => [key(f.name), f]));
  let pos = Math.max(-1, ...folders.filter((f) => !f.parent_id).map((f) => f.position ?? 0));
  const newFolders = [...folderNames.values()]
    .filter((n) => !existingTop.has(key(n)))
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
    .map((name) => ({ name, position: ++pos }));
  for (const [linkId, name] of linkFolder) linkFolder.set(linkId, existingTop.get(key(name))?.name ?? name);

  const charUsed = new Set(characterTags.map((c) => c.tag_id));
  const deleteTagIds = [...uses.keys()].filter((id) => !charUsed.has(id));
  return { folders: newFolders, linkFolder, vaultTags: [...vaultTagNames.values()], vaultLinkTags, deleteTagIds };
}
