// =====================================================================
//  Shared by the Edge Functions (link-preview, quick-save):
//  safe fetching of other people's web pages + Open Graph previews.
//
//  Safety rules (it fetches URLs on your behalf, so it is strict):
//   • only http:// and https:// on the normal ports (80 / 443)
//   • refuses private / local / internal addresses (127.0.0.1, 10.x,
//     192.168.x, 169.254.x, ::1, fc00::/7, …) — checked for every redirect
//   • short timeout (5 s per request, 8 s in total), at most 4 redirects
//   • reads at most 512 KB of the page, only HTML, and never the images
// =====================================================================

const REQUEST_TIMEOUT_MS = 5000;
const TOTAL_TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;
const USER_AGENT = 'Mozilla/5.0 (compatible; LinkVaultPreview/1.0; +https://github.com/TKZ-design/Character-board)';

export type FetchDeps = {
  fetch: typeof fetch;
  resolve: (host: string) => Promise<string[]>;
};
type Deps = FetchDeps;

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

/** The link points at a private / local / internal address (never fetched, never saved). */
export class PrivateAddressError extends PreviewError {
  constructor() { super('Private or local addresses are not allowed', 400); }
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
  if (literal) { if (isPrivateIp(host)) throw new PrivateAddressError(); return u; }
  if (!host.includes('.') || /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa)$/.test(host)) {
    throw new PrivateAddressError();
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
  if (addrs.some(isPrivateIp)) throw new PrivateAddressError();
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

// ---------------- real dependencies (Supabase Edge Runtime / Deno) ----------------

export async function resolveDns(host: string): Promise<string[]> {
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
