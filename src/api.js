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
  l.tag_ids = (l.vault_link_tags || []).map((x) => x.tag_id);
  l.character_ids = (l.vault_link_characters || []).map((x) => x.character_id);
  delete l.vault_link_tags;
  delete l.vault_link_characters;
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

  // ---------- Link Vault ----------
  async listLinks() {
    const rows = check(
      await supabase.from('vault_links')
        .select('*, vault_link_tags(tag_id), vault_link_characters(character_id)')
        .order('created_at', { ascending: false }),
    );
    return rows.map(linkRow);
  },
  async createLink(fields) {
    return linkRow(check(await supabase.from('vault_links').insert(fields).select().single()));
  },
  async updateLink(id, patch) {
    const row = check(await supabase.from('vault_links').update(patch).eq('id', id).select().single());
    delete row.vault_link_tags; delete row.vault_link_characters;
    return row;
  },
  async deleteLink(link) {
    check(await supabase.from('vault_links').delete().eq('id', link.id));
    const paths = [link.cover_path, link.cover_thumb_path].filter(Boolean);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  },
  /** Replace a link's tags by name (missing tags are created). Returns the link's tag rows. */
  async setLinkTags(linkId, names) {
    return check(await supabase.rpc('set_link_tags', { p_link_id: linkId, p_names: names }));
  },
  /** Replace the characters a link is connected to. */
  async setLinkCharacters(linkId, characterIds, previousIds = []) {
    const gone = previousIds.filter((id) => !characterIds.includes(id));
    const added = characterIds.filter((id) => !previousIds.includes(id));
    if (gone.length) check(await supabase.from('vault_link_characters').delete().eq('link_id', linkId).in('character_id', gone));
    if (added.length) {
      check(await supabase.from('vault_link_characters')
        .upsert(added.map((character_id) => ({ link_id: linkId, character_id })), { onConflict: 'link_id,character_id', ignoreDuplicates: true }));
    }
  },
  /** Upload a compressed custom thumbnail for a link. Returns the columns to save. */
  async uploadLinkCover(userId, linkId, img) {
    const base = `${userId}/links/${linkId}/${crypto.randomUUID()}`;
    const cover_path = `${base}.${img.ext}`;
    const cover_thumb_path = `${base}_thumb.${img.ext}`;
    const store = supabase.storage.from(BUCKET);
    const opts = { contentType: img.full.type, cacheControl: '31536000', upsert: false };
    check(await store.upload(cover_path, img.full, opts));
    try {
      check(await store.upload(cover_thumb_path, img.thumb, { ...opts, contentType: img.thumb.type }));
    } catch (e) { await store.remove([cover_path]); throw e; }
    return { cover_path, cover_thumb_path, cover_width: img.width, cover_height: img.height };
  },
  async removeFiles(paths) {
    const list = paths.filter(Boolean);
    if (list.length) await supabase.storage.from(BUCKET).remove(list);
  },
  /**
   * Open Graph preview via the link-preview Edge Function.
   * Resolves to { title, description, image, site_name } or throws an error with
   * `.status` (404 = the function isn't deployed yet).
   */
  async fetchPreview(url) {
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
    if (error) {
      const status = error.context?.status ?? 0;
      let message = error.message;
      try { message = (await error.context.json()).error || message; } catch {}
      throw Object.assign(new Error(message), { status });
    }
    return data;
  },

  // ---------- Notes ----------
  async listNotes() {
    return check(await supabase.from('notes').select('id, body, created_at, updated_at').order('created_at', { ascending: false }));
  },
  async createNote(body) {
    return check(await supabase.from('notes').insert({ body }).select('id, body, created_at, updated_at').single());
  },
  async updateNote(id, body) {
    return check(await supabase.from('notes').update({ body }).eq('id', id).select('id, body, created_at, updated_at').single());
  },
  async deleteNote(id) {
    check(await supabase.from('notes').delete().eq('id', id));
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
