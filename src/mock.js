// DEVELOPMENT ONLY: an in-memory fake backend, enabled with `?mock` on the
// dev server. Never included in the production build.
import { cleanTag, tagKey } from './text.js';

const delay = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const blobs = new Map(); // path -> Blob
const user = { id: 'mock-user', email: 'you@example.com' };
let chars = [];
let tags = [];      // { id, name, group_id }
let groups = [];    // { id, name }
let links = [];     // { character_id, tag_id }
let vault = [];     // saved links (Link Vault)
let linkTags = [];  // { link_id, tag_id }
let linkChars = []; // { link_id, character_id }

function swatch(color, w, h, label) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.85)'; x.font = `bold ${Math.round(w / 8)}px sans-serif`;
  x.fillText(label, w * 0.08, h * 0.55);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

function uniqueErr(what) {
  return Object.assign(new Error(`duplicate key value violates unique constraint "${what}_user_name_key"`), { code: '23505' });
}
function ensureTag(name) {
  const n = cleanTag(name);
  if (!n) return null;
  let t = tags.find((x) => tagKey(x.name) === tagKey(n));
  if (!t) { t = { id: crypto.randomUUID(), name: n, group_id: null }; tags.push(t); }
  return t;
}
const tagIdsOf = (cid) => links.filter((l) => l.character_id === cid).map((l) => l.tag_id);
const withLinkRefs = (l) => ({
  ...structuredClone(l),
  tag_ids: linkTags.filter((x) => x.link_id === l.id).map((x) => x.tag_id),
  character_ids: linkChars.filter((x) => x.link_id === l.id).map((x) => x.character_id),
});
const withTags = (c) => ({ ...structuredClone(c), tag_ids: tagIdsOf(c.id) });

async function seed() {
  groups = [{ id: crypto.randomUUID(), name: 'Genre' }, { id: crypto.randomUUID(), name: 'Role' }];
  const [genre, role] = groups;
  const demo = [
    ['Captain Vex', 'Original', ['Sci-fi', 'Villain'], '#7c3aed', 300, 420],
    ['Moss Witch', 'Hollow Tales', ['Fantasy', 'Hero'], '#15803d', 400, 300],
    ['Detective Oona', 'Original', ['Noir'], '#b45309', 300, 300],
    ['Pip the Courier', '', ['Fantasy', 'Sidekick', 'cozy'], '#0e7490', 300, 500],
  ];
  for (const [name, source, tagNames, color, w, h] of demo) {
    const id = crypto.randomUUID();
    const imgs = [];
    for (let i = 0; i < 2; i++) {
      const iid = crypto.randomUUID();
      const path = `${user.id}/${id}/${iid}.png`;
      blobs.set(path, await swatch(i ? '#334155' : color, w, h, name.split(' ')[0]));
      imgs.push({ id: iid, character_id: id, path, thumb_path: path, width: w, height: h, position: i, sha256: null, created_at: now() });
    }
    chars.push({ id, user_id: user.id, name, source, notes: `Notes about ${name}.`, links: ['https://example.com/ref'],
      cover_image_id: null, is_favorite: false, created_at: now(), updated_at: now(), images: imgs });
    for (const n of tagNames) links.push({ character_id: id, tag_id: ensureTag(n).id });
  }
  const later = (min) => new Date(Date.now() - min * 60000).toISOString();
  const demoLinks = [
    // [url, url_key, platform, title, status, fav, tags, characters, thumbnail_url, preview_status]
    ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'youtube:aqz-KE-bpKQ', 'youtube', 'Big Buck Bunny — character animation reference', 'todo', true, ['Fantasy', 'Reference'], [1], null, 'ok'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'youtube:dQw4w9WgXcQ', 'youtube', 'Quick pose study', 'done', false, ['Reference'], [], null, 'ok'],
    ['https://x.com/artist/status/1790000000000000000', 'x:1790000000000000000', 'x', 'Moody palette thread', 'todo', false, ['Noir'], [2], null, 'none'],
    ['https://www.instagram.com/reel/C1a2B3c4D5e/', 'instagram:C1a2B3c4D5e', 'instagram', 'Costume turnaround', 'todo', false, ['Fantasy'], [1, 3], null, 'none'],
    ['https://www.reddit.com/r/characterdrawing/comments/1abcde/witch_concepts/', 'reddit:1abcde', 'reddit', 'Witch concepts — feedback thread', 'done', true, [], [1], null, 'none'],
    ['https://example.com/articles/silhouettes', 'example.com/articles/silhouettes', 'web', '', 'todo', false, ['Reference'], [], null, null],
  ];
  demoLinks.forEach(([url, url_key, platform, title, status, fav, tagNames, charIdx, thumb, ps], i) => {
    const id = crypto.randomUUID();
    vault.push({ id, user_id: user.id, url, url_key, platform, title, description: '', site_name: '', notes: i === 0 ? 'Watch the squash & stretch around 2:10.' : '',
      status, is_favorite: fav, thumbnail_url: thumb, image_path: null, image_thumb_path: null, image_width: null, image_height: null,
      preview_status: ps, preview_fetched_at: ps ? now() : null, created_at: later(i * 90), updated_at: later(i * 60) });
    for (const n of tagNames) linkTags.push({ link_id: id, tag_id: ensureTag(n).id });
    for (const ci of charIdx) linkChars.push({ link_id: id, character_id: chars[ci].id });
  });
  for (const t of tags) {
    if (['Sci-fi', 'Fantasy', 'Noir'].includes(t.name)) t.group_id = genre.id;
    if (['Villain', 'Hero', 'Sidekick'].includes(t.name)) t.group_id = role.id;
  }
}

let seeded;
export const mockApi = {
  async getUser() { await (seeded ||= seed()); return user; },
  onAuthChange() {},
  async sendMagicLink() { await delay(); },
  async verifyCode() { await delay(); },
  async signOut() { location.reload(); },
  async listCharacters() { await delay(); return chars.map(withTags); },
  async createCharacter(f) {
    const c = { id: crypto.randomUUID(), user_id: user.id, source: '', notes: '', links: [], cover_image_id: null,
      is_favorite: false, ...f, created_at: now(), updated_at: now(), images: [] };
    chars.unshift(c); return withTags(c);
  },
  async updateCharacter(id, patch) {
    const c = chars.find((x) => x.id === id); Object.assign(c, patch, { updated_at: now() });
    const { images, ...row } = c; return structuredClone(row);
  },
  async deleteCharacter(ch) {
    chars = chars.filter((c) => c.id !== ch.id);
    links = links.filter((l) => l.character_id !== ch.id);
    linkChars = linkChars.filter((l) => l.character_id !== ch.id);
  },
  async uploadImage(_u, characterId, img, position) {
    await delay(150);
    const id = crypto.randomUUID();
    const path = `${user.id}/${characterId}/${id}.${img.ext}`;
    const thumb_path = `${user.id}/${characterId}/${id}_thumb.${img.ext}`;
    blobs.set(path, img.full); blobs.set(thumb_path, img.thumb);
    const row = { id, character_id: characterId, path, thumb_path, width: img.width, height: img.height, position,
      sha256: img.sha256 || null, created_at: now() };
    chars.find((c) => c.id === characterId).images.push(row);
    return structuredClone(row);
  },
  async deleteImage(image) {
    for (const c of chars) c.images = c.images.filter((i) => i.id !== image.id);
  },

  // ---------- tags ----------
  async listTags() { await delay(); return structuredClone(tags); },
  async listGroups() { await delay(); return structuredClone(groups); },
  async setCharacterTags(characterId, names) {
    await delay();
    const ids = [...new Set(names.map(ensureTag).filter(Boolean).map((t) => t.id))];
    links = links.filter((l) => l.character_id !== characterId).concat(ids.map((tag_id) => ({ character_id: characterId, tag_id })));
    return structuredClone(tags.filter((t) => ids.includes(t.id)));
  },
  async createTag({ name, group_id = null }) {
    await delay();
    const n = cleanTag(name);
    if (tags.some((t) => tagKey(t.name) === tagKey(n))) throw uniqueErr('tags');
    const t = { id: crypto.randomUUID(), name: n, group_id };
    tags.push(t); return structuredClone(t);
  },
  async updateTag(id, patch) {
    await delay();
    const t = tags.find((x) => x.id === id);
    if (patch.name != null) {
      patch = { ...patch, name: cleanTag(patch.name) };
      if (tags.some((x) => x.id !== id && tagKey(x.name) === tagKey(patch.name))) throw uniqueErr('tags');
    }
    Object.assign(t, patch); return structuredClone(t);
  },
  async deleteTag(id) {
    await delay();
    tags = tags.filter((t) => t.id !== id);
    links = links.filter((l) => l.tag_id !== id);
    linkTags = linkTags.filter((l) => l.tag_id !== id);
  },
  async mergeTags(sourceIds, targetId) {
    await delay();
    const src = new Set(sourceIds.filter((id) => id !== targetId));
    for (const l of links.filter((x) => src.has(x.tag_id))) {
      if (!links.some((x) => x.character_id === l.character_id && x.tag_id === targetId)) links.push({ character_id: l.character_id, tag_id: targetId });
    }
    links = links.filter((l) => !src.has(l.tag_id));
    for (const l of linkTags.filter((x) => src.has(x.tag_id))) {
      if (!linkTags.some((x) => x.link_id === l.link_id && x.tag_id === targetId)) linkTags.push({ link_id: l.link_id, tag_id: targetId });
    }
    linkTags = linkTags.filter((l) => !src.has(l.tag_id));
    tags = tags.filter((t) => !src.has(t.id));
  },
  async createGroup(name) {
    await delay();
    const n = cleanTag(name);
    if (groups.some((g) => tagKey(g.name) === tagKey(n))) throw uniqueErr('tag_groups');
    const g = { id: crypto.randomUUID(), name: n };
    groups.push(g); return structuredClone(g);
  },
  async updateGroup(id, patch) {
    await delay();
    const n = cleanTag(patch.name);
    if (groups.some((g) => g.id !== id && tagKey(g.name) === tagKey(n))) throw uniqueErr('tag_groups');
    const g = groups.find((x) => x.id === id); g.name = n; return structuredClone(g);
  },
  async deleteGroup(id) {
    await delay();
    groups = groups.filter((g) => g.id !== id);
    for (const t of tags) if (t.group_id === id) t.group_id = null;
  },

  // ---------- links ----------
  async listLinks() { await delay(); return vault.map(withLinkRefs); },
  async createLink(f) {
    await delay();
    const l = { id: crypto.randomUUID(), user_id: user.id, title: '', description: '', site_name: '', notes: '', status: 'todo',
      is_favorite: false, thumbnail_url: null, image_path: null, image_thumb_path: null, image_width: null, image_height: null,
      preview_status: null, preview_fetched_at: null, platform: 'web', url_key: '', ...f, created_at: now(), updated_at: now() };
    vault.unshift(l); return withLinkRefs(l);
  },
  async updateLink(id, patch) {
    await delay();
    const l = vault.find((x) => x.id === id); Object.assign(l, patch, { updated_at: now() }); return structuredClone(l);
  },
  async deleteLink(link) {
    await delay();
    vault = vault.filter((l) => l.id !== link.id);
    linkTags = linkTags.filter((x) => x.link_id !== link.id);
    linkChars = linkChars.filter((x) => x.link_id !== link.id);
  },
  async setLinkTags(linkId, names) {
    await delay();
    const ids = [...new Set(names.map(ensureTag).filter(Boolean).map((t) => t.id))];
    linkTags = linkTags.filter((l) => l.link_id !== linkId).concat(ids.map((tag_id) => ({ link_id: linkId, tag_id })));
    return structuredClone(tags.filter((t) => ids.includes(t.id)));
  },
  async setLinkCharacters(linkId, ids) {
    await delay();
    const ok = ids.filter((id) => chars.some((c) => c.id === id));
    linkChars = linkChars.filter((l) => l.link_id !== linkId).concat(ok.map((character_id) => ({ link_id: linkId, character_id })));
    return ok;
  },
  async fetchPreview(linkId) {
    await delay(400);
    const l = vault.find((x) => x.id === linkId);
    if (!l) return null;
    // pretend: ordinary websites have Open Graph data, X / Instagram don't
    if (l.platform === 'web') {
      Object.assign(l, { preview_status: 'ok', title: l.title || 'Designing readable silhouettes', site_name: l.site_name || 'Example Journal',
        description: l.description || 'Why a character should read at thumbnail size.', thumbnail_url: null });
      const key = `${user.id}/links/${l.id}/og.png`;
      blobs.set(key, await swatch('#9a3412', 1200, 630, 'OG image'));
      Object.assign(l, { image_path: null, thumbnail_url: (blobs.get(key).__url ||= URL.createObjectURL(blobs.get(key))) });
    } else l.preview_status = 'none';
    l.preview_fetched_at = now();
    return structuredClone(l);
  },
  async uploadLinkImage(_u, linkId, img) {
    await delay(150);
    const base = `${user.id}/links/${linkId}/${crypto.randomUUID()}`;
    const image_path = `${base}.${img.ext}`, image_thumb_path = `${base}_thumb.${img.ext}`;
    blobs.set(image_path, img.full); blobs.set(image_thumb_path, img.thumb);
    return { image_path, image_thumb_path, image_width: img.width, image_height: img.height };
  },
  async removeFiles(paths) { for (const p of paths) blobs.delete(p); },

  async getUrls(paths) {
    const out = {};
    for (const p of paths) if (blobs.has(p)) out[p] = (blobs.get(p).__url ||= URL.createObjectURL(blobs.get(p)));
    return out;
  },
  async downloadImage(path) { return blobs.get(path); },
};
