// =====================================================================
//  quick-save — Supabase Edge Function for the iPhone Shortcuts
//
//  Saves a link (into the Link Vault) or a note (into Notes) without a
//  browser or a login. Used by the "Save to Stash" and "Stash Note"
//  Shortcuts (see README).
//
//  POST, JSON body, one of:
//    { "type": "link", "url": "https://…" or shared text containing a link, "note": "optional" }
//    { "type": "note", "body": "…" }
//  Header:  x-stash-key: <your secret key>
//
//  Replies with short plain text, made to be shown as an iPhone notification:
//    "Saved ✓" · "Already saved" · "Note saved ✓" · or a short error.
//
//  Security:
//   • the x-stash-key header must match the Supabase secret STASH_QUICK_KEY
//     (compared in constant time). Wrong or missing → 401, nothing else said.
//   • rows are saved for the Supabase secret STASH_OWNER_USER_ID using the
//     service-role key, which only exists on Supabase's servers (never in
//     the browser or this repository).
//   • links go through the same checks as link-preview: http/https only, no
//     private / local / internal addresses (also after DNS and redirects).
//   • no CORS headers: web pages can't call this from a browser.
// =====================================================================
import { parseUrl, cleanUrl, platformOf, urlKey } from '../_shared/links.js';
import { checkUrl, preview, PreviewError, PrivateAddressError, resolveDns, type FetchDeps } from '../_shared/preview.ts';

export const MAX_URL = 2000;
export const MAX_TEXT = 5000;
const MAX_BODY_BYTES = 16 * 1024;
const MIN_KEY_LENGTH = 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LinkRow = {
  user_id: string;
  url: string;
  platform: string;
  title: string;
  description: string;
  site_name: string;
  thumbnail_url: string | null;
  notes: string;
  preview_status: 'pending' | 'ok' | 'none';
  preview_fetched_at: string | null;
};
export type NoteRow = { user_id: string; body: string };

export type Db = {
  /** Every saved link URL of this user (for the duplicate check). */
  linkUrls(userId: string): Promise<string[]>;
  insertLink(row: LinkRow): Promise<void>;
  insertNote(row: NoteRow): Promise<void>;
};

export type Deps = FetchDeps & {
  key: string | undefined;      // STASH_QUICK_KEY
  ownerId: string | undefined;  // STASH_OWNER_USER_ID
  db: Db;
};

// ---------------- key check ----------------

const enc = new TextEncoder();

/**
 * Constant-time comparison: both values are hashed first (so their lengths
 * don't matter), then every byte is compared without stopping early.
 */
export async function keysMatch(given: string | null | undefined, expected: string | null | undefined): Promise<boolean> {
  if (!given || !expected || expected.length < MIN_KEY_LENGTH) return false;
  const [a, b] = await Promise.all([given, expected].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---------------- input checks ----------------

export class InputError extends Error {}

/** The link to save from the "url" field (which may be shared text with a link in it). */
export function linkFromInput(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) throw new InputError('No link found');
  if (text.length > MAX_TEXT) throw new InputError('Too long');
  const found = parseUrl(text);
  if (!found) throw new InputError('No link found');
  const url = cleanUrl(found);
  if (url.length > MAX_URL) throw new InputError('Link too long');
  try { checkUrl(url); } catch (e) {
    throw new InputError(e instanceof PrivateAddressError ? 'Link not allowed' : 'Not a valid link');
  }
  return url;
}

/** Optional text (a link's note): trimmed, at most MAX_TEXT characters. */
export function optionalText(raw: unknown, what = 'Note'): string {
  if (raw == null) return '';
  if (typeof raw !== 'string') throw new InputError(`${what} must be text`);
  const t = raw.trim();
  if (t.length > MAX_TEXT) throw new InputError(`${what} too long (max ${MAX_TEXT})`);
  return t;
}

// ---------------- the HTTP handler ----------------

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return text(405, 'Use POST');

  // 1. the key — checked before anything else is read
  if (!(await keysMatch(req.headers.get('x-stash-key'), deps.key))) return text(401, 'Unauthorized');
  if (!deps.ownerId || !UUID.test(deps.ownerId)) return text(500, 'Quick save is not set up (owner)');

  // 2. the body
  let input: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return text(413, 'Too long');
    input = JSON.parse(raw);
    if (!input || typeof input !== 'object') throw new Error();
  } catch { return text(400, 'Send JSON'); }

  try {
    if (input.type === 'note') return await saveNote(input, deps);
    if (input.type === 'link') return await saveLink(input, deps);
    return text(400, 'Unknown type');
  } catch (e) {
    if (e instanceof InputError) return text(400, e.message);
    console.error('quick-save failed:', e);
    return text(500, 'Could not save, try again');
  }
}

async function saveNote(input: Record<string, unknown>, deps: Deps) {
  const body = optionalText(input.body, 'Note');
  if (!body) throw new InputError('Empty note');
  await deps.db.insertNote({ user_id: deps.ownerId!, body });
  return text(200, 'Note saved ✓');
}

async function saveLink(input: Record<string, unknown>, deps: Deps) {
  const url = linkFromInput(input.url);
  const notes = optionalText(input.note, 'Note');
  const owner = deps.ownerId!;

  // Same duplicate check as the app (youtu.be = youtube.com/watch, tracking ignored, …)
  const key = urlKey(url);
  if ((await deps.db.linkUrls(owner)).some((u) => urlKey(u) === key)) return text(200, 'Already saved');

  const platform = platformOf(url);
  const row: LinkRow = {
    user_id: owner, url, platform, title: '', description: '', site_name: '', thumbnail_url: null,
    notes, preview_status: 'pending', preview_fetched_at: null,
  };

  // Title + picture, with the same safety rules as link-preview.
  // Slow/unreachable sites are saved anyway ("pending": the app tries again later).
  try {
    const p = await preview(url, deps);
    const found = !!(p.title || p.image || p.description);
    row.title = (p.title || '').slice(0, 300);
    row.description = (p.description || '').slice(0, 2000);
    row.site_name = (p.site_name || '').slice(0, 200);
    // YouTube thumbnails come straight from the video ID in the app
    if (platform !== 'youtube' && p.image && /^https?:\/\//i.test(p.image) && p.image.length <= 2048) row.thumbnail_url = p.image;
    row.preview_status = found ? 'ok' : 'none';
    row.preview_fetched_at = new Date().toISOString();
  } catch (e) {
    if (e instanceof PrivateAddressError) throw new InputError('Link not allowed');
    // anything else (timeout, DNS hiccup, site down): keep "pending" so the app retries
    if (!(e instanceof PreviewError)) console.warn('preview failed:', e);
  }

  await deps.db.insertLink(row);
  return text(200, 'Saved ✓');
}

// ---------------- real dependencies (Supabase Edge Runtime / Deno) ----------------

/** Talks to the database through Supabase's REST API with the service-role key (server-side only). */
export function restDb(base: string, serviceKey: string, fetchFn: typeof fetch = fetch): Db {
  const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
  const insert = async (table: string, row: unknown) => {
    const r = await fetchFn(`${base}/rest/v1/${table}`, {
      method: 'POST', headers: { ...headers, prefer: 'return=minimal' }, body: JSON.stringify(row), signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`insert into ${table}: ${r.status} ${await r.text()}`);
  };
  return {
    async linkUrls(userId) {
      const out: string[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const r = await fetchFn(`${base}/rest/v1/vault_links?select=url&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&offset=${from}&limit=${page}`,
          { headers, signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error(`read vault_links: ${r.status} ${await r.text()}`);
        const rows = await r.json() as { url: string }[];
        out.push(...rows.map((x) => x.url));
        if (rows.length < page) return out;
      }
    },
    insertLink: (row) => insert('vault_links', row),
    insertNote: (row) => insert('notes', row),
  };
}

// deno-lint-ignore no-explicit-any
const DenoNs = (globalThis as any).Deno;
if (DenoNs?.serve) {
  const env = DenoNs.env;
  const db = restDb(env.get('SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY'));
  DenoNs.serve((req: Request) => handle(req, {
    fetch, resolve: resolveDns, db,
    key: env.get('STASH_QUICK_KEY'),
    ownerId: env.get('STASH_OWNER_USER_ID'),
  }));
}
