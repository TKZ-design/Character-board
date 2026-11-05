// All talking to the backend goes through this file.
// In development you can open the app with `?mock` to use an in-memory fake
// backend instead (see mock.js) — handy for trying the UI without Supabase.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, BUCKET } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

const URL_TTL = 60 * 60; // signed URLs live for 1 hour
const urlCache = new Map(); // path -> { url, exp }

function check({ data, error }) {
  if (error) throw error;
  return data;
}

function sortImages(c) {
  c.images = (c.images || []).sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
  );
  return c;
}

function linkRow(l) {
  l.tag_ids = (l.link_tags || []).map((x) => x.tag_id);
  l.character_ids = (l.link_characters || []).map((x) => x.character_id);
  delete l.link_tags;
  delete l.link_characters;
  return l;
}

export const realApi = {
  // ---------- auth ----------
  async getUser() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  },
  onAuthChange(cb) {
    supabase.auth.onAuthStateChange((_evt, session) => cb(session?.user ?? null));
  },
  async sendMagicLink(email) {
    const redirect = location.origin + location.pathname;
    check(await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } }));
  },
  async verifyCode(email, token) {
    check(await supabase.auth.verifyOtp({ email, token, type: 'email' }));
  },
  async signOut() {
    await supabase.auth.signOut();
    urlCache.clear();
  },

  // ---------- characters ----------
  async listCharacters() {
    const rows = check(
      await supabase.from('characters')
        .select('*, images!images_character_id_fkey(*), character_tags(tag_id)')
        .order('created_at', { ascending: false }),
    );
    return rows.map((c) => {
      c.tag_ids = (c.character_tags || []).map((x) => x.tag_id);
      delete c.character_tags;
      return sortImages(c);
    });
  },
  async createCharacter(fields) {
    const row = check(await supabase.from('characters').insert(fields).select().single());
    row.images = [];
    row.tag_ids = [];
    return row;
  },
  async updateCharacter(id, patch) {
    return check(
      await supabase.from('characters').update(patch).eq('id', id).select().single(),
    );
  },
  async deleteCharacter(character) {
    const paths = character.images.flatMap((i) => [i.path, i.thumb_path]).filter(Boolean);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    check(await supabase.from('characters').delete().eq('id', character.id));
  },

  // ---------- images ----------
  async uploadImage(userId, characterId, img, position) {
    const id = crypto.randomUUID();
    const base = `${userId}/${characterId}/${id}`;
    const path = `${base}.${img.ext}`;
    const thumb_path = `${base}_thumb.${img.ext}`;
    const store = supabase.storage.from(BUCKET);
    const opts = { contentType: img.full.type, cacheControl: '31536000', upsert: false };
    check(await store.upload(path, img.full, opts));
    check(await store.upload(thumb_path, img.thumb, { ...opts, contentType: img.thumb.type }));
    try {
      return check(
        await supabase
          .from('images')
          .insert({ id, character_id: characterId, path, thumb_path, width: img.width, height: img.height, position, sha256: img.sha256 || null })
          .select()
          .single(),
      );
    } catch (e) {
      await store.remove([path, thumb_path]);
      throw e;
    }
  },
  async deleteImage(image) {
    check(await supabase.from('images').delete().eq('id', image.id));
    await supabase.storage.from(BUCKET).remove([image.path, image.thumb_path].filter(Boolean));
  },

  // ---------- tags & tag groups ----------
  async listTags() {
    return check(await supabase.from('tags').select('id, name, group_id').order('name'));
  },
  async listGroups() {
    return check(await supabase.from('tag_groups').select('id, name').order('name'));
  },
  /** Replace a character's tags by name (missing tags are created). Returns the character's tag rows. */
  async setCharacterTags(characterId, names) {
    return check(await supabase.rpc('set_character_tags', { p_character_id: characterId, p_names: names }));
  },
  async createTag(fields) {
    return check(await supabase.from('tags').insert(fields).select('id, name, group_id').single());
  },
  async updateTag(id, patch) {
    return check(await supabase.from('tags').update(patch).eq('id', id).select('id, name, group_id').single());
  },
  async deleteTag(id) {
    check(await supabase.from('tags').delete().eq('id', id));
  },
  async mergeTags(sourceIds, targetId) {
    check(await supabase.rpc('merge_tags', { p_source_ids: sourceIds, p_target_id: targetId }));
  },
  async createGroup(name) {
    return check(await supabase.from('tag_groups').insert({ name }).select('id, name').single());
  },
  async updateGroup(id, patch) {
    return check(await supabase.from('tag_groups').update(patch).eq('id', id).select('id, name').single());
  },
  async deleteGroup(id) {
    check(await supabase.from('tag_groups').delete().eq('id', id));
  },

  // ---------- links (Link Vault) ----------
  async listLinks() {
    const rows = check(
      await supabase.from('links')
        .select('*, link_tags(tag_id), link_characters(character_id)')
        .order('created_at', { ascending: false }),
    );
    return rows.map(linkRow);
  },
  async createLink(fields) {
    return linkRow(check(await supabase.from('links').insert(fields).select().single()));
  },
  async updateLink(id, patch) {
    return check(await supabase.from('links').update(patch).eq('id', id).select().single());
  },
  async deleteLink(link) {
    const paths = [link.image_path, link.image_thumb_path].filter(Boolean);
    check(await supabase.from('links').delete().eq('id', link.id));
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  },
  async setLinkTags(linkId, names) {
    return check(await supabase.rpc('set_link_tags', { p_link_id: linkId, p_names: names }));
  },
  async setLinkCharacters(linkId, characterIds) {
    const rows = check(await supabase.rpc('set_link_characters', { p_link_id: linkId, p_character_ids: characterIds }));
    return (rows || []).map((r) => (typeof r === 'string' ? r : r.set_link_characters ?? r.character_id));
  },
  /**
   * Ask the link-preview Edge Function for a link's Open Graph data. It stores the
   * result on the link and returns the updated row (or the stored one if it was fetched before).
   */
  async fetchPreview(linkId, { force = false } = {}) {
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { link_id: linkId, force } });
    if (error) {
      const status = error.context?.status;
      throw Object.assign(new Error(error.message || 'Preview failed'), { status, notDeployed: status === 404 || error.name === 'FunctionsFetchError' });
    }
    return data?.link || null;
  },
  /** Upload a custom link thumbnail (already compressed) — same private bucket, under <user>/links/<link>/. */
  async uploadLinkImage(userId, linkId, img) {
    const base = `${userId}/links/${linkId}/${crypto.randomUUID()}`;
    const image_path = `${base}.${img.ext}`;
    const image_thumb_path = `${base}_thumb.${img.ext}`;
    const store = supabase.storage.from(BUCKET);
    const opts = { contentType: img.full.type, cacheControl: '31536000', upsert: false };
    check(await store.upload(image_path, img.full, opts));
    check(await store.upload(image_thumb_path, img.thumb, { ...opts, contentType: img.thumb.type }));
    return { image_path, image_thumb_path, image_width: img.width, image_height: img.height };
  },
  async removeFiles(paths) {
    const list = paths.filter(Boolean);
    if (list.length) await supabase.storage.from(BUCKET).remove(list);
  },

  /** Returns { path: signedUrl } for the given storage paths (cached). */
  async getUrls(paths) {
    const now = Date.now();
    const out = {};
    const missing = [];
    for (const p of new Set(paths.filter(Boolean))) {
      const hit = urlCache.get(p);
      if (hit && hit.exp > now) out[p] = hit.url;
      else missing.push(p);
    }
    for (let i = 0; i < missing.length; i += 100) {
      const chunk = missing.slice(i, i + 100);
      const data = check(await supabase.storage.from(BUCKET).createSignedUrls(chunk, URL_TTL));
      for (const d of data) {
        if (!d.signedUrl) continue;
        out[d.path] = d.signedUrl;
        urlCache.set(d.path, { url: d.signedUrl, exp: now + (URL_TTL - 120) * 1000 });
      }
    }
    return out;
  },
  async downloadImage(path) {
    return check(await supabase.storage.from(BUCKET).download(path));
  },
};
