// =====================================================================
//  quick-save — Supabase Edge Function for the Link Vault
//
//  Lets the iPhone Shortcut "Save to Stash" save a link in one tap,
//  without opening Safari. It answers with one short line of plain text:
//  "Saved ✓", "Already saved", or "Not saved: …".
//
//  How it is protected (the Shortcut has no login, so the function checks
//  a personal secret key instead):
//   • POST only, and only with the right key in the "x-stash-key" header
//     (compared in constant time). Anything else gets the same generic refusal.
//   • the key and your user ID are Supabase secrets — QUICK_SAVE_KEY and
//     OWNER_USER_ID — they are never in this file or anywhere in the repo
//   • it can do exactly one thing: add a link to OWNER_USER_ID's "Unsorted"
//   • the request may be at most 4 KB and must hold one http(s) address
//   • looking up the title/thumbnail follows the same strict rules as
//     link-preview: no private / local addresses (also after redirects),
//     normal ports only, short timeouts, at most 512 KB, HTML only
//
//  Single file, no dependencies: paste it into Supabase → Edge Functions →
//  Deploy a new function → Via Editor (see README). Name it: quick-save
//  and switch "Verify JWT" OFF for this function (see README for why).
//
//  The two blocks marked COPY are copies — keep them in step with the
//  originals (tests/quick-save.test.js compares them):
//   • "COPY of link-preview" = supabase/functions/link-preview/index.ts
//   • "COPY of src/links.js" = the app's clean-up and duplicate rules
// =====================================================================

const MAX_BODY_BYTES = 4096;
const MIN_KEY_LENGTH = 20;
const DB_TIMEOUT_MS = 8000;

export type Deps = {
  fetch: typeof fetch;
  resolve: (host: string) => Promise<string[]>;
  /** A Supabase secret / environment value. */
  env: (name: string) => string | undefined;
  /** Every link address the owner has already saved. */
  listUrls: (ownerId: string) => Promise<string[]>;
  /** Adds one row to vault_links. */
  insertLink: (row: Record<string, unknown>) => Promise<void>;
};

// =====================================================================
//  COPY of link-preview (safety checks + preview lookup) — do not edit here
// =====================================================================

const REQUEST_TIMEOUT_MS = 5000;
const TOTAL_TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;
const USER_AGENT = 'Mozilla/5.0 (compatible; LinkVaultPreview/1.0; +https://github.com/TKZ-design/Character-board)';

// ---------------- IP address checks ----------------

function ipv4Parts(ip: string): number[] | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every((n) => n <= 255) ? p : null;
}

function privateV4([a, b, c]: number[]): boolean {
  return a === 0 || a === 10 || a === 127 || a >= 224 ||            // this-network, private, loopback, multicast/reserved
    (a === 100 && b >= 64 && b <= 127) ||                             // carrier-grade NAT
    (a === 169 && b === 254) ||                                       // link-local (cloud metadata!)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||                 // IETF / TEST-NET-1
    (a === 192 && b === 88 && c === 99) ||                            // 6to4 relay
    (a === 198 && (b === 18 || b === 19)) ||                          // benchmarking
    (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113); // TEST-NET-2/3
}

/** 8 numbers (0–65535) for an IPv6 address, or null. Handles "::" and an IPv4 tail. */
function ipv6Hextets(ip: string): number[] | null {
  let s = ip.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  const v4 = s.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const p = ipv4Parts(v4[1]);
    if (!p) return null;
    s = s.slice(0, -v4[1].length) + ((p[0] << 8) | p[1]).toString(16) + ':' + ((p[2] << 8) | p[3]).toString(16);
  }
  if (!/^[0-9a-f:]+$/.test(s) || (s.match(/::/g) || []).length > 1) return null;
  const [head, tail] = s.includes('::') ? s.split('::') : [s, null];
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const fill = tail === null ? 0 : 8 - h.length - t.length;
  if (fill < 0 || (tail === null && h.length !== 8)) return null;
  const all = [...h, ...Array(fill).fill('0'), ...t];
  if (all.length !== 8 || all.some((x) => !/^[0-9a-f]{1,4}$/.test(x))) return null;
  return all.map((x) => parseInt(x, 16));
}

/** true for anything that is not a normal public internet address. Unknown formats count as private. */
export function isPrivateIp(ip: string): boolean {
  const v4 = ipv4Parts(ip);
  if (v4) return privateV4(v4);
  const h = ipv6Hextets(ip);
  if (!h) return true;
  const embedded = () => [h[6] >> 8, h[6] & 255, h[7] >> 8, h[7] & 255];
  if (h.slice(0, 7).every((x) => x === 0)) return true;                                  // :: and ::1
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return privateV4(embedded()); // ::ffff:a.b.c.d
  if (h[0] === 0x64 && h[1] === 0xff9b) return privateV4(embedded());                      // NAT64
  if ((h[0] & 0xfe00) === 0xfc00) return true;                                           // unique local fc00::/7
  if ((h[0] & 0xffc0) === 0xfe80) return true;                                           // link-local fe80::/10
  if ((h[0] & 0xff00) === 0xff00) return true;                                           // multicast
  if (h[0] === 0x2001 && (h[1] === 0x0db8 || h[1] === 0)) return true;                    // documentation, Teredo
  if (h[0] === 0x2002) return true;                                                      // 6to4
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true;             // discard-only
  return false;
}

// ---------------- URL checks ----------------

export class PreviewError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/** Throws unless the URL is http(s) on a normal port with a public-looking host name. */
export function checkUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new PreviewError('Not a valid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new PreviewError('Only http and https links are allowed');
  if (u.username || u.password) throw new PreviewError('Links with a username/password are not allowed');
  if (u.port && u.port !== '80' && u.port !== '443') throw new PreviewError('Only the standard ports 80 and 443 are allowed');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) throw new PreviewError('Missing host');
  const literal = ipv4Parts(host) || host.startsWith('[');
  if (literal) { if (isPrivateIp(host)) throw new PreviewError('Private or local addresses are not allowed'); return u; }
  if (!host.includes('.') || /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa)$/.test(host)) {
    throw new PreviewError('Private or local addresses are not allowed');
  }
  return u;
}

/** Resolve a host and make sure EVERY address it points to is public. */
async function checkHost(u: URL, deps: Deps) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (ipv4Parts(host) || host.includes(':')) return; // literal IPs were checked in checkUrl
  let addrs: string[];
  try { addrs = await deps.resolve(host); } catch { throw new PreviewError('Could not look up that address'); }
  if (!addrs.length) throw new PreviewError('Could not look up that address');
  if (addrs.some(isPrivateIp)) throw new PreviewError('Private or local addresses are not allowed');
}

// ---------------- fetching ----------------

/** GET with manual redirects; every hop is re-checked. Returns the final response + URL. */
export async function safeFetch(start: string, deps: Deps, accept = 'text/html,application/xhtml+xml', deadline = Date.now() + TOTAL_TIMEOUT_MS) {
  let url = checkUrl(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await checkHost(url, deps);
    const left = deadline - Date.now();
    if (left <= 0) throw new PreviewError('Timed out', 504);
    let res: Response;
    try {
      res = await deps.fetch(url.href, {
        redirect: 'manual',
        signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, left)),
        headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en;q=0.9, *;q=0.5' },
      });
    } catch (e) {
      throw new PreviewError((e as Error)?.name === 'TimeoutError' ? 'Timed out' : 'Could not reach the site', 502);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel();
      url = checkUrl(new URL(res.headers.get('location')!, url).href);
      continue;
    }
    return { res, url };
  }
  throw new PreviewError('Too many redirects', 502);
}

/** Read at most MAX_BYTES of the body (stops early after </head>). */
export async function readCapped(res: Response, max = MAX_BYTES): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const charset = (res.headers.get('content-type') || '').match(/charset=([\w-]+)/i)?.[1] || 'utf-8';
  let decoder: TextDecoder;
  try { decoder = new TextDecoder(charset); } catch { decoder = new TextDecoder('utf-8'); }
  let text = '';
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const part = value.subarray(0, max - size);
    chunks.push(part);
    size += part.length;
    text += decoder.decode(part, { stream: true });
    if (/<\/head\s*>/i.test(text)) break;
  }
  await reader.cancel().catch(() => {});
  return text;
}

// ---------------- parsing ----------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
const tidy = (s: string | undefined, max: number) =>
  s ? decodeEntities(s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  }
  return out;
}

export function absoluteHttpUrl(raw: string | undefined, base: URL): string | null {
  if (!raw) return null;
  try {
    const u = new URL(decodeEntities(raw.trim()), base);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.href.length <= 2048 ? u.href : null;
  } catch { return null; }
}

/** Open Graph / Twitter card / <title> data from a page's HTML. */
export function parseMeta(html: string, base: URL) {
  const head = html.slice(0, MAX_BYTES);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content != null && !(key in meta)) meta[key] = a.content;
  }
  let imageSrc: string | undefined;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if ((a.rel || '').toLowerCase() === 'image_src' && a.href) { imageSrc = a.href; break; }
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title: tidy(meta['og:title'] || meta['twitter:title'] || titleTag, 300),
    description: tidy(meta['og:description'] || meta['twitter:description'] || meta['description'], 2000),
    image: absoluteHttpUrl(meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'] || meta['image'] || imageSrc, base),
    site_name: tidy(meta['og:site_name'] || meta['application-name'] || meta['twitter:site'], 200),
  };
}

// ---------------- platforms with a public oEmbed endpoint ----------------

function oembedEndpoint(u: URL): string | null {
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|old|new)\./, '');
  const q = encodeURIComponent(u.href);
  if (['youtube.com', 'youtu.be', 'music.youtube.com'].includes(host)) return `https://www.youtube.com/oembed?format=json&url=${q}`;
  if (['x.com', 'twitter.com'].includes(host)) return `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${q}`;
  if (['reddit.com', 'redd.it'].includes(host)) return `https://www.reddit.com/oembed?url=${q}`;
  return null;
}

async function tryOembed(u: URL, deps: Deps, deadline: number) {
  const endpoint = oembedEndpoint(u);
  if (!endpoint) return null;
  try {
    const { res } = await safeFetch(endpoint, deps, 'application/json', deadline);
    if (!res.ok) { await res.body?.cancel(); return null; }
    const data = JSON.parse(await readCapped(res, 256 * 1024));
    // X puts the post text inside its HTML snippet: keep just the words
    const text = typeof data.html === 'string'
      ? tidy(data.html.replace(/<br\s*\/?>/gi, ' ').replace(/<a\b[^>]*>(pic\.twitter\.com|https?:\/\/t\.co)[^<]*<\/a>/gi, '').replace(/<[^>]+>/g, ' ').replace(/—\s*[^—]*$/, ''), 2000)
      : '';
    return {
      title: tidy(data.title || (data.author_name ? `${data.author_name} on ${data.provider_name || 'X'}` : ''), 300),
      description: text && text !== data.title ? text : '',
      image: absoluteHttpUrl(data.thumbnail_url, u),
      site_name: tidy(data.provider_name, 200),
    };
  } catch { return null; }
}

/** Look up a preview for one URL. */
export async function preview(raw: string, deps: Deps) {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const start = checkUrl(raw);
  const empty = { title: '', description: '', image: null as string | null, site_name: '' };
  const fromOembed = await tryOembed(start, deps, deadline);
  let page = empty, finalUrl = start.href;
  if (!fromOembed?.title || !fromOembed?.image) {
    try {
      const { res, url } = await safeFetch(start.href, deps, undefined, deadline);
      finalUrl = url.href;
      const type = (res.headers.get('content-type') || '').toLowerCase();
      if (res.ok && (type.includes('text/html') || type.includes('application/xhtml'))) page = parseMeta(await readCapped(res), url);
      else await res.body?.cancel();
    } catch (e) {
      if (!fromOembed) throw e;
    }
  }
  const pick = (k: 'title' | 'description' | 'site_name') => fromOembed?.[k] || page[k];
  return {
    ok: true,
    url: finalUrl,
    title: pick('title'),
    description: pick('description'),
    image: fromOembed?.image || page.image,
    site_name: pick('site_name'),
  };
}

// =====================================================================
//  COPY of src/links.js (tracking clean-up + duplicate key) — do not edit here
// =====================================================================

/** Parameters that only track you and never change what the page shows. */
const TRACKING = new Set([
  'si', 'igsh', 'igshid', 'img_index', 'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'twclid', 'ttclid',
  'mc_cid', 'mc_eid', 'ref_src', 'ref_url', 'share_id', 'rdt', 'spm', '_ga', '_gl', 'mibextid', 'sfnsn', 'xmt', 'cxt',
  'share_app_id', 'utm', 'is_from_webapp', 'sender_device', 'web_id', 'correlation_id',
]);
/** Extra ones that are only junk on certain sites. */
const TRACKING_ON: Record<string, Set<string>> = {
  youtube: new Set(['feature', 'pp', 'ab_channel', 'embeds_referring_euri', 'embeds_referring_origin', 'source_ve_path']),
  x: new Set(['s', 't', 'src', 'cn', 'refsrc']),
  reddit: new Set(['share_id', 'context', 'ref', 'ref_source', 'rdt']),
  instagram: new Set(['hl', 'taken-by']),
  tiktok: new Set(['_r', '_t', 'is_from_webapp', 'sender_device', 'refer', 'u_code', 'preview_pb', 'language', 'timestamp', 'enable_checksum', 'checksum']),
};
const isTracking = (key: string, platform: string) => {
  const k = key.toLowerCase();
  return k.startsWith('utm_') || TRACKING.has(k) || !!TRACKING_ON[platform]?.has(k);
};

const hostOf = (u: URL) => u.hostname.toLowerCase().replace(/\.$/, '');
const bareHost = (host: string) => host.replace(/^(www|m|mobile)\./, '');

function toUrl(s: unknown): URL | null {
  try {
    const u = new URL(String(s));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch { return null; }
}

/** Which platform a URL belongs to: youtube | x | instagram | reddit | tiktok | web. */
export function platformOf(url: string): string {
  const u = toUrl(url);
  if (!u) return 'web';
  const host = bareHost(hostOf(u));
  const is = (...d: string[]) => d.some((x) => host === x || host.endsWith('.' + x));
  if (is('youtube.com', 'youtu.be', 'youtube-nocookie.com')) return 'youtube';
  if (is('x.com', 'twitter.com', 'fxtwitter.com', 'vxtwitter.com', 'fixupx.com', 'fixvx.com')) return 'x';
  if (is('instagram.com', 'instagr.am')) return 'instagram';
  if (is('reddit.com', 'redd.it')) return 'reddit';
  if (is('tiktok.com')) return 'tiktok';
  return 'web';
}

/** The URL with tracking parameters (utm_*, si, igsh, …) removed. Everything else is kept. */
export function cleanUrl(url: string): string {
  const u = toUrl(url);
  if (!u) return String(url ?? '');
  const platform = platformOf(u.href);
  for (const key of [...u.searchParams.keys()]) if (isTracking(key, platform)) u.searchParams.delete(key);
  return u.href;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** The video ID of youtu.be, watch, shorts, embed and live links, else null. */
function youtubeId(u: URL): string | null {
  const host = bareHost(hostOf(u));
  const parts = u.pathname.split('/').filter(Boolean);
  let id: string | null | undefined = null;
  if (host === 'youtu.be') id = parts[0];
  else if (parts[0] === 'watch' || u.pathname === '/') id = u.searchParams.get('v');
  else if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) id = parts[1];
  return id && YT_ID.test(id) ? id : null;
}

/** The post a link points at ("youtube:ID", "x:ID", "instagram:CODE", "reddit:ID"), else null. */
function postKey(u: URL, platform: string): string | null {
  const parts = u.pathname.split('/').filter(Boolean);
  if (platform === 'youtube') {
    const id = youtubeId(u);
    return id ? `youtube:${id}` : null;
  }
  if (platform === 'x') {
    const i = parts.findIndex((p) => p === 'status' || p === 'statuses');
    const id = i >= 0 ? parts[i + 1] : null;
    return id && /^\d{5,25}$/.test(id) ? `x:${id}` : null;
  }
  if (platform === 'instagram') {
    const i = parts.findIndex((p) => ['p', 'reel', 'reels', 'tv'].includes(p));
    const code = i >= 0 ? parts[i + 1] : null;
    return code && /^[A-Za-z0-9_-]{5,40}$/.test(code) ? `instagram:${code}` : null;
  }
  if (platform === 'reddit') {
    // /r/<sub>/comments/<id>/<slug>/
    if (parts[0] === 'r' && parts[2] === 'comments' && /^[a-z0-9]{3,12}$/i.test(parts[3] || '')) return `reddit:${parts[3].toLowerCase()}`;
  }
  return null;
}

/**
 * A key that is the same for two links that point at the same thing:
 * http/https, www./m., trailing slashes, tracking parameters and parameter order
 * are ignored, and YouTube / X / Instagram / Reddit links are reduced to their post ID
 * (youtu.be/ID = youtube.com/watch?v=ID = /shorts/ID).
 */
export function urlKey(url: string): string {
  const u = toUrl(url);
  if (!u) return String(url ?? '').trim().toLowerCase();
  const platform = platformOf(u.href);
  const post = postKey(u, platform);
  if (post) return post;
  let host = bareHost(hostOf(u));
  if (platform === 'reddit') {
    host = host.replace(/^(old|new|np|i)\./, '');
    if (host === 'redd.it') { const id = u.pathname.split('/').filter(Boolean)[0]; if (id) return `reddit:${id.toLowerCase()}`; }
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'comments' && parts[1]) return `reddit:${parts[1].toLowerCase()}`;
  }
  if (platform === 'x') host = 'x.com';
  const params = [...u.searchParams].filter(([k]) => !isTracking(k, platform)).sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y));
  const query = params.length ? '?' + new URLSearchParams(params).toString() : '';
  const port = u.port && !['80', '443'].includes(u.port) ? ':' + u.port : '';
  const path = u.pathname.replace(/\/+$/, '').replace(/\/{2,}/g, '/');
  return `${host}${port}${path}${query}`;
}

// =====================================================================
//  Quick Save itself
// =====================================================================

export const SAVED = 'Saved ✓';
export const ALREADY = 'Already saved';
/** The one answer for a wrong method, a wrong or missing key, or a function that is not set up. */
export const REFUSED = 'Not saved: request refused';

/** Compares two keys without giving away (through timing) how much of the key was right. */
export async function sameKey(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Is this request allowed to save? Needs a configured key of a sensible length and the same key in the header. */
export async function keyOk(req: Request, deps: Pick<Deps, 'env'>): Promise<boolean> {
  const expected = (deps.env('QUICK_SAVE_KEY') || '').trim();
  const given = (req.headers.get('x-stash-key') || '').trim();
  // always do the comparison, so a missing key takes as long as a wrong one
  const same = await sameKey(given, expected || 'not configured');
  return same && expected.length >= MIN_KEY_LENGTH && given.length > 0;
}

/** The request body as text, or null when it is larger than `max` bytes. */
async function readBody(req: Request, max: number): Promise<string | null> {
  if (Number(req.headers.get('content-length') || 0) > max) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const bytes = new Uint8Array(max);
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    if (size + value.length > max) { await reader.cancel().catch(() => {}); return null; }
    bytes.set(value, size);
    size += value.length;
  }
  return new TextDecoder().decode(bytes.subarray(0, size));
}

/**
 * The link in a request body: either the address itself as plain text, or JSON like {"url": "https://…"}.
 * Returns the cleaned address (tracking parameters removed), or null unless it is exactly one http(s) address.
 */
export function linkFromBody(body: string): string | null {
  let s = body.trim();
  if (s.startsWith('{') || s.startsWith('"')) {
    try {
      const j = JSON.parse(s);
      s = typeof j === 'string' ? j : typeof j?.url === 'string' ? j.url : '';
    } catch { return null; }
  }
  s = s.trim();
  if (!/^https?:\/\/\S+$/i.test(s)) return null;
  const u = toUrl(s);
  if (!u || !u.hostname) return null;
  const clean = cleanUrl(u.href);
  return clean.length >= 8 && clean.length <= 2048 ? clean : null;
}

/** Is a link to the same thing already in the list? (Same rules as the app's "Already in your vault".) */
export function isDuplicate(url: string, savedUrls: string[]): boolean {
  const key = urlKey(url);
  return savedUrls.some((saved) => urlKey(saved) === key);
}

/** Title, description and thumbnail for a new link — saved the same way the app saves them. */
async function previewFields(url: string, platform: string, deps: Deps) {
  const fetched = { preview_fetched_at: new Date().toISOString() };
  try {
    const d = await preview(url, deps);
    const found = !!(d.title || d.image || d.description);
    return {
      title: d.title, description: d.description, site_name: d.site_name,
      thumbnail_url: platform === 'youtube' ? null : d.image, // YouTube thumbnails come from the video ID
      preview_status: found ? 'ok' : 'none', ...fetched,
    };
  } catch (e) {
    // refused address / not a page: nothing to find. Anything else: the app tries again later.
    if (e instanceof PreviewError && e.status === 400) return { preview_status: 'none', ...fetched };
    return { preview_status: 'pending' };
  }
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const reply = (status: number, text: string) =>
    new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

  if (req.method !== 'POST') return reply(405, REFUSED);
  if (!(await keyOk(req, deps))) return reply(401, REFUSED);

  // From here on the caller has the key, so the answers can be helpful.
  const owner = (deps.env('OWNER_USER_ID') || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(owner)) {
    return reply(500, 'Not saved: the OWNER_USER_ID secret is missing or not a user ID (see README)');
  }

  let body: string | null;
  try { body = await readBody(req, MAX_BODY_BYTES); } catch { return reply(400, 'Not saved: the request could not be read'); }
  if (body === null) return reply(413, 'Not saved: the request is too large');
  const url = linkFromBody(body);
  if (!url) return reply(400, 'Not saved: that is not a web link (it must start with http:// or https://)');

  try {
    if (isDuplicate(url, await deps.listUrls(owner))) return reply(200, ALREADY);
    const platform = platformOf(url);
    await deps.insertLink({
      user_id: owner,
      url,
      platform,
      folder_id: null, // Unsorted
      ...(await previewFields(url, platform, deps)),
    });
    return reply(200, SAVED);
  } catch (e) {
    console.error('quick-save failed:', (e as Error)?.message || e);
    return reply(500, 'Not saved: Stash could not be reached. Please try again');
  }
}

// ---------------- real dependencies (Supabase Edge Runtime / Deno) ----------------

async function resolveDns(host: string): Promise<string[]> {
  // deno-lint-ignore no-explicit-any
  const D = (globalThis as any).Deno;
  const out: string[] = [];
  try {
    for (const type of ['A', 'AAAA']) {
      try { out.push(...await D.resolveDns(host, type)); }
      catch (e) { if ((e as Error)?.name !== 'NotFound') throw e; }
    }
    return out;
  } catch {
    // Fallback: DNS over HTTPS (if the runtime has no resolveDns)
    for (const type of ['A', 'AAAA']) {
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
        { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(3000) });
      const data = await r.json();
      for (const a of data.Answer || []) if (a.type === 1 || a.type === 28) out.push(String(a.data));
    }
    return out;
  }
}

// deno-lint-ignore no-explicit-any
const DenoNs = (globalThis as any).Deno;
const env = (name: string): string | undefined => DenoNs?.env.get(name);

/**
 * The project's own server-side key. Supabase gives it to every Edge Function
 * automatically — you never set it and it is never sent to the phone.
 * It is only used below, and only for OWNER_USER_ID's links.
 */
function serverKey(): string {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    const key = keys.default ?? Object.values(keys)[0];
    if (typeof key === 'string' && key) return key;
  } catch { /* fall through to the older name */ }
  return env('SUPABASE_SERVICE_ROLE_KEY') || '';
}

async function db(path: string, init: RequestInit = {}): Promise<Response> {
  const key = serverKey();
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    signal: AbortSignal.timeout(DB_TIMEOUT_MS),
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`database answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function listUrls(ownerId: string): Promise<string[]> {
  const out: string[] = [];
  const PAGE = 1000;
  for (let page = 0; page < 100; page++) {
    const rows = await (await db(`vault_links?select=url&user_id=eq.${ownerId}&order=id&limit=${PAGE}&offset=${page * PAGE}`)).json();
    for (const r of rows) out.push(String(r.url));
    if (rows.length < PAGE) break;
  }
  return out;
}

async function insertLink(row: Record<string, unknown>): Promise<void> {
  const res = await db('vault_links', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(row) });
  await res.body?.cancel();
}

// deno-lint-ignore no-explicit-any
if (DenoNs?.serve && !(globalThis as any).__QUICK_SAVE_TEST__) {
  DenoNs.serve((req: Request) => handle(req, { fetch, resolve: resolveDns, env, listUrls, insertLink }));
}
