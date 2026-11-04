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
      await supabase.from('characters').select('*, images!images_character_id_fkey(*)').order('created_at', { ascending: false }),
    );
    return rows.map(sortImages);
  },
  async createCharacter(fields) {
    const row = check(await supabase.from('characters').insert(fields).select().single());
    row.images = [];
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
          .insert({ id, character_id: characterId, path, thumb_path, width: img.width, height: img.height, position })
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
