// =====================================================================
//  link-preview — Supabase Edge Function for the Link Vault
//
//  Fetches a web page's preview (Open Graph title, description, image)
//  so link cards can show a thumbnail. Called by the app right after a
//  link is saved; the result is stored on the link, so every link is
//  fetched only once (unless you press "Try again" in the app).
//
//  Safety rules:
//   - only for logged-in users of YOUR project (checks the login token)
//   - only http:// and https:// on the normal ports (80 / 443)
//   - refuses private / local / internal addresses (incl. after redirects)
//   - gives up after a few seconds and reads at most 512 KB of the page
//
//  Deploy: see "Link previews (Edge Function)" in README.md. This file has
//  no dependencies, so you can paste it into the Supabase dashboard editor.
// =====================================================================

const TIMEOUT_MS = 6000;          // whole request, including redirects
const MAX_BYTES = 512 * 1024;     // never read more than this from a page
const MAX_REDIRECTS = 4;
const USER_AGENT = 'Mozilla/5.0 (compatible; LinkVaultPreview/1.0; +https://github.com/TKZ-design/Character-board)';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

// ---------------------------------------------------------------------
//  IP address checks
// ---------------------------------------------------------------------

export function parseIPv4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const b = m.slice(1).map(Number);
  return b.every((x) => x <= 255) ? b : null;
}

/** IPv6 text → 16 bytes (handles "::" and an embedded IPv4 tail). */
export function parseIPv6(input: string): number[] | null {
  let s = input.replace(/^\[|\]$/g, '').toLowerCase();
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  if (!s.includes(':')) return null;
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(':');
  const maybeV4 = s.slice(lastColon + 1);
  if (maybeV4.includes('.')) {
    const v4 = parseIPv4(maybeV4);
    if (!v4) return null;
    tail = v4;
    s = s.slice(0, lastColon + 1) + '0:0'; // placeholder groups, replaced below
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part ? part.split(':') : []);
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    bytes.push(n >> 8, n & 255);
  }
  if (tail.length) bytes.splice(12, 4, ...tail);
  return bytes.length === 16 ? bytes : null;
}

function isPublicV4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return false;           // "this" network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false;           // carrier-grade NAT
  if (a === 169 && b === 254) return false;                     // link-local (cloud metadata!)
  if (a === 172 && b >= 16 && b <= 31) return false;            // private
  if (a === 192 && b === 168) return false;                     // private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF, TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return false;          // 6to4 relay
  if (a === 198 && (b === 18 || b === 19)) return false;        // benchmarking
  if (a === 198 && b === 51 && c === 100) return false;         // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false;          // TEST-NET-3
  if (a >= 224) return false;                                   // multicast, reserved, broadcast
  return true;
}

/** true only for ordinary public internet addresses. */
export function isPublicIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4) return isPublicV4(v4);
  const v6 = parseIPv6(ip);
  if (!v6) return false;
  const zero = (from: number, to: number) => v6.slice(from, to).every((x) => x === 0);
  if (zero(0, 16)) return false;                                          // ::
  if (zero(0, 15) && v6[15] === 1) return false;                          // ::1
  if (zero(0, 10) && v6[10] === 0xff && v6[11] === 0xff) return isPublicV4(v6.slice(12)); // ::ffff:a.b.c.d
  if (zero(0, 12)) return false;                                          // ::a.b.c.d (deprecated)
  if (v6[0] === 0x00 && v6[1] === 0x64 && v6[2] === 0xff && v6[3] === 0x9b) return isPublicV4(v6.slice(12)); // NAT64
  if ((v6[0] & 0xfe) === 0xfc) return false;                              // fc00::/7 unique local
  if (v6[0] === 0xfe && (v6[1] & 0xc0) === 0x80) return false;            // fe80::/10 link-local
  if (v6[0] === 0xfe && (v6[1] & 0xc0) === 0xc0) return false;            // fec0::/10 site-local
  if (v6[0] === 0xff) return false;                                       // multicast
  if (v6[0] === 0x20 && v6[1] === 0x01 && v6[2] === 0x0d && v6[3] === 0xb8) return false; // documentation
  if (v6[0] === 0x20 && v6[1] === 0x01 && v6[2] === 0x00 && v6[3] === 0x00) return false; // Teredo
  if (v6[0] === 0x20 && v6[1] === 0x02) return isPublicV4(v6.slice(2, 6)); // 6to4
  return (v6[0] & 0xe0) === 0x20;                                         // only 2000::/3 is global unicast
}

/** Throws unless `raw` is an http(s) URL on a normal port with a sensible host name. */
export function checkUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new HttpError(400, 'That is not a valid link'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new HttpError(400, 'Only http and https links are allowed');
  if (u.username || u.password) throw new HttpError(400, 'Links with a user name or password are not allowed');
  if (u.port && u.port !== '80' && u.port !== '443') throw new HttpError(400, 'Only the standard web ports are allowed');
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) throw new HttpError(400, 'That link has no host');
  const literal = host.startsWith('[') || parseIPv4(host);
  if (!literal) {
    if (!host.includes('.') || /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa)$/.test(host)) {
      throw new HttpError(400, 'Local addresses are not allowed');
    }
  }
  return u;
}

async function dohLookup(host: string, type: 'A' | 'AAAA'): Promise<string[]> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
    headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) return [];
  const json = await res.json();
  const want = type === 'A' ? 1 : 28;
  return (json.Answer || []).filter((a: { type: number }) => a.type === want).map((a: { data: string }) => a.data);
}

async function resolveHost(host: string): Promise<string[]> {
  const out: string[] = [];
  let dnsWorks = true;
  for (const type of ['A', 'AAAA'] as const) {
    try {
      // deno-lint-ignore no-explicit-any
      out.push(...(await (Deno as any).resolveDns(host, type)));
    } catch (e) {
      if ((e as Error)?.name !== 'NotFound') dnsWorks = false;
    }
  }
  if (!dnsWorks && !out.length) {
    // the runtime can't do DNS lookups itself — ask a DNS-over-HTTPS resolver instead
    for (const type of ['A', 'AAAA'] as const) {
      try { out.push(...(await dohLookup(host, type))); } catch { /* ignore */ }
    }
  }
  return out;
}

/** Throws unless every address the host name points to is a public one. */
async function assertPublicHost(u: URL): Promise<void> {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (parseIPv4(host) || host.includes(':')) {
    if (!isPublicIp(host)) throw new HttpError(400, 'Private and local addresses are not allowed');
    return;
  }
  const addrs = await resolveHost(host);
  if (!addrs.length) throw new HttpError(400, 'Could not find that website');
  if (addrs.some((a) => !isPublicIp(a))) throw new HttpError(400, 'Private and local addresses are not allowed');
}

// ---------------------------------------------------------------------
//  Fetching
// ---------------------------------------------------------------------

/** fetch() that re-checks every redirect hop. */
async function safeFetch(start: string, signal: AbortSignal, accept: string): Promise<{ res: Response; url: URL }> {
  let url = checkUrl(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url.href, {
      redirect: 'manual', signal,
      headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en;q=0.9, *;q=0.5' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel();
      url = checkUrl(new URL(res.headers.get('location')!, url).href);
      continue;
    }
    return { res, url };
  }
  throw new HttpError(400, 'Too many redirects');
}

/** Read at most MAX_BYTES of a response (stops early after </head>). */
async function readLimited(res: Response): Promise<string> {
  if (!res.body) return '';
  const charset = /charset=["']?([\w-]+)/i.exec(res.headers.get('content-type') || '')?.[1] || 'utf-8';
  let decoder: TextDecoder;
  try { decoder = new TextDecoder(charset); } catch { decoder = new TextDecoder('utf-8'); }
  const reader = res.body.getReader();
  let total = 0, text = '';
  try {
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, MAX_BYTES - total);
      total += chunk.length;
      text += decoder.decode(chunk, { stream: true });
      if (/<\/head\s*>/i.test(text)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return text;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<Record<string, unknown> | null> {
  try {
    const { res } = await safeFetch(url, signal, 'application/json');
    if (!res.ok) { await res.body?.cancel(); return null; }
    return JSON.parse(await readLimited(res));
  } catch { return null; }
}

// ---------------------------------------------------------------------
//  Parsing
// ---------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return all; }
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}
const tidy = (s: unknown, max: number) =>
  decodeEntities(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, max);

function httpUrl(raw: unknown, base: URL): string | null {
  if (!raw) return null;
  try {
    const u = new URL(decodeEntities(String(raw).trim()), base);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.href.length <= 2048 ? u.href : null;
  } catch { return null; }
}

export interface Preview { title: string; description: string; image: string | null; site_name: string }

/** Pull Open Graph / Twitter card / plain HTML metadata out of a page's <head>. */
export function parseMeta(html: string, base: URL): Preview {
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([^\s=/<>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    }
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (key && attrs.content != null && !(key in meta)) meta[key] = attrs.content;
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return {
    title: tidy(meta['og:title'] || meta['twitter:title'] || titleTag, 300),
    description: tidy(meta['og:description'] || meta['twitter:description'] || meta['description'], 1000),
    image: httpUrl(meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'], base),
    site_name: tidy(meta['og:site_name'] || meta['application-name'], 120),
  };
}

// ---------------------------------------------------------------------
//  Per-platform helpers (official oEmbed endpoints)
// ---------------------------------------------------------------------

function platformOf(u: URL): string {
  const h = u.hostname.toLowerCase().replace(/^(www|m|mobile|old)\./, '');
  if (h === 'youtu.be' || h === 'youtube.com' || h === 'music.youtube.com') return 'youtube';
  if (h === 'x.com' || h === 'twitter.com') return 'x';
  if (h === 'instagram.com') return 'instagram';
  if (h === 'reddit.com' || h.endsWith('.reddit.com') || h === 'redd.it') return 'reddit';
  return 'web';
}

async function viaOembed(u: URL, platform: string, signal: AbortSignal): Promise<Preview | null> {
  const q = encodeURIComponent(u.href);
  if (platform === 'youtube') {
    const j = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${q}`, signal);
    if (!j?.title) return null;
    return { title: tidy(j.title, 300), description: j.author_name ? `by ${tidy(j.author_name, 100)}` : '', image: httpUrl(j.thumbnail_url, u), site_name: 'YouTube' };
  }
  if (platform === 'x') {
    const j = await fetchJson(`https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${q}`, signal);
    if (!j?.html) return null;
    const text = tidy(/<p[^>]*>([\s\S]*?)<\/p>/i.exec(String(j.html))?.[1] || '', 280);
    const who = tidy(j.author_name, 100);
    return { title: who && text ? `${who}: ${text}` : who || text, description: '', image: null, site_name: 'X' };
  }
  if (platform === 'reddit') {
    const j = await fetchJson(`https://www.reddit.com/oembed?url=${q}`, signal);
    if (!j?.title) return null;
    return { title: tidy(j.title, 300), description: j.author_name ? `by u/${tidy(j.author_name, 60)}` : '', image: null, site_name: 'Reddit' };
  }
  return null;
}

async function viaOpenGraph(u: URL, signal: AbortSignal): Promise<Preview | null> {
  const { res, url } = await safeFetch(u.href, signal, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5');
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.ok) { await res.body?.cancel(); return null; }
  if (type.startsWith('image/')) { await res.body?.cancel(); return { title: '', description: '', image: url.href, site_name: '' }; }
  if (type && !type.includes('html') && !type.includes('xml')) { await res.body?.cancel(); return null; }
  return parseMeta(await readLimited(res), url);
}

export async function getPreview(raw: string): Promise<Preview & { status: 'ok' | 'none' }> {
  const u = checkUrl(raw);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const platform = platformOf(u);
  let p = await viaOembed(u, platform, signal);
  let og: Preview | null = null;
  if (!p?.image) {
    try { og = await viaOpenGraph(u, signal); } catch (e) { if (!p) throw e; }
  }
  p = {
    title: p?.title || og?.title || '',
    description: p?.description || og?.description || '',
    image: p?.image || og?.image || null,
    site_name: p?.site_name || og?.site_name || '',
  };
  return { ...p, status: p.title || p.image ? 'ok' : 'none' };
}

// ---------------------------------------------------------------------
//  HTTP handler
// ---------------------------------------------------------------------

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const apikey = Deno.env.get('SUPABASE_ANON_KEY') || req.headers.get('apikey') || '';
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(auth)) return json(401, { error: 'Please log in' });

  // 1. who is asking? (rejects anyone who isn't logged in to this project)
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey } });
  if (!who.ok) return json(401, { error: 'Please log in' });
  await who.body?.cancel();

  let body: { url?: string; link_id?: string; force?: boolean };
  try { body = await req.json(); } catch { return json(400, { error: 'Send JSON: { "url": "…" }' }); }

  // the database is read/written AS THE USER, so Row Level Security applies
  const rest = (path: string, init: RequestInit = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init, headers: { authorization: auth, apikey, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const COLS = 'id,url,title,description,site_name,thumbnail_url,preview_status,preview_fetched_at';

  let link: Record<string, unknown> | null = null;
  if (body.link_id) {
    if (!/^[0-9a-f-]{36}$/i.test(body.link_id)) return json(400, { error: 'Bad link id' });
    const r = await rest(`links?id=eq.${body.link_id}&select=${COLS}`);
    link = r.ok ? (await r.json())[0] ?? null : null;
    if (!link) return json(404, { error: 'Link not found' });
    // 2. already fetched once? hand back what we stored
    if (link.preview_status && !body.force) return json(200, { cached: true, link });
  }
  const target = String(link?.url ?? body.url ?? '');
  if (!target || target.length > 2048) return json(400, { error: 'Missing url' });

  // 3. fetch the preview
  let preview: (Preview & { status: string }) | null = null;
  let error: string | null = null;
  try {
    preview = await getPreview(target);
  } catch (e) {
    error = e instanceof HttpError ? e.message : (e as Error)?.name === 'TimeoutError' ? 'The site took too long to answer' : 'Could not load that page';
    if (e instanceof HttpError && e.status === 400 && !link) return json(400, { error });
  }

  // 4. remember the result on the link (never overwrite what you typed yourself)
  if (link) {
    const patch: Record<string, unknown> = {
      preview_status: preview?.status ?? 'error',
      preview_fetched_at: new Date().toISOString(),
    };
    if (preview?.image) patch.thumbnail_url = preview.image;
    if (preview?.title && !link.title) patch.title = preview.title.slice(0, 500);
    if (preview?.description && !link.description) patch.description = preview.description.slice(0, 2000);
    if (preview?.site_name && !link.site_name) patch.site_name = preview.site_name.slice(0, 200);
    const r = await rest(`links?id=eq.${link.id}&select=${COLS}`, {
      method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify(patch),
    });
    if (r.ok) link = (await r.json())[0] ?? link;
  }
  return json(200, { preview, error, link });
}

// Supabase runs this; Node (the unit tests) just imports the helpers above.
// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D?.serve) D.serve(handler);
