// Pure link helpers (no DOM) — unit tested in tests/links.test.js.
// Finding a URL in shared text, cleaning tracking junk, detecting the
// platform (YouTube, X, Instagram, Reddit…) and the duplicate-check key.

/** Parameters that only track you and never change what the page shows. */
const TRACKING = new Set([
  'si', 'igsh', 'igshid', 'img_index', 'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'twclid', 'ttclid',
  'mc_cid', 'mc_eid', 'ref_src', 'ref_url', 'share_id', 'rdt', 'spm', '_ga', '_gl', 'mibextid', 'sfnsn', 'xmt', 'cxt',
  'share_app_id', 'utm', 'is_from_webapp', 'sender_device', 'web_id', 'correlation_id',
]);
/** Extra ones that are only junk on certain sites. */
const TRACKING_ON = {
  youtube: new Set(['feature', 'pp', 'ab_channel', 'embeds_referring_euri', 'embeds_referring_origin', 'source_ve_path']),
  x: new Set(['s', 't', 'src', 'cn', 'refsrc']),
  reddit: new Set(['share_id', 'context', 'ref', 'ref_source', 'rdt']),
  instagram: new Set(['hl', 'taken-by']),
  tiktok: new Set(['_r', '_t', 'is_from_webapp', 'sender_device', 'refer', 'u_code', 'preview_pb', 'language', 'timestamp', 'enable_checksum', 'checksum']),
};
const isTracking = (key, platform) => {
  const k = key.toLowerCase();
  return k.startsWith('utm_') || TRACKING.has(k) || !!TRACKING_ON[platform]?.has(k);
};

export const PLATFORMS = {
  youtube: { label: 'YouTube' },
  x: { label: 'X' },
  instagram: { label: 'Instagram' },
  reddit: { label: 'Reddit' },
  tiktok: { label: 'TikTok' },
  web: { label: 'Website' },
};

const hostOf = (u) => u.hostname.toLowerCase().replace(/\.$/, '');
const bareHost = (host) => host.replace(/^(www|m|mobile)\./, '');

/** Which platform a URL belongs to: youtube | x | instagram | reddit | tiktok | web. */
export function platformOf(url) {
  const u = toUrl(url);
  if (!u) return 'web';
  const host = bareHost(hostOf(u));
  const is = (...d) => d.some((x) => host === x || host.endsWith('.' + x));
  if (is('youtube.com', 'youtu.be', 'youtube-nocookie.com')) return 'youtube';
  if (is('x.com', 'twitter.com', 'fxtwitter.com', 'vxtwitter.com', 'fixupx.com', 'fixvx.com')) return 'x';
  if (is('instagram.com', 'instagr.am')) return 'instagram';
  if (is('reddit.com', 'redd.it')) return 'reddit';
  if (is('tiktok.com')) return 'tiktok';
  return 'web';
}

export function platformLabel(p) {
  return PLATFORMS[p]?.label || PLATFORMS.web.label;
}

function toUrl(s) {
  try {
    const u = new URL(String(s));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch { return null; }
}

/**
 * The first http(s) link in some text (a shared message, the clipboard, ?add=…).
 * Bare domains like "youtu.be/abc" get https:// added. Returns a string or null.
 */
export function parseUrl(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  const tidy = (x) => x.replace(/[)\]}>.,;:!?'"’”]+$/u, '');
  const m = s.match(/https?:\/\/[^\s<>"'`]+/i);
  if (m) return toUrl(tidy(m[0]))?.href ?? null;
  const bare = s.match(/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"'`]*)?$/i);
  if (bare) return toUrl('https://' + tidy(bare[0]))?.href ?? null;
  return null;
}

/** Hostname without "www." — e.g. "youtube.com". */
export function domainOf(url) {
  const u = toUrl(url);
  return u ? hostOf(u).replace(/^www\./, '') : '';
}

/** The URL with tracking parameters (utm_*, si, igsh, …) removed. Everything else is kept. */
export function cleanUrl(url) {
  const u = toUrl(url);
  if (!u) return String(url ?? '');
  const platform = platformOf(u.href);
  for (const key of [...u.searchParams.keys()]) if (isTracking(key, platform)) u.searchParams.delete(key);
  return u.href;
}

// ---------------- YouTube ----------------

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Seconds from "90", "90s", "1m30s", "1h2m3s". */
function parseStart(t) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = String(t).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0) : 0;
}

/** { id, start, shorts } for youtu.be, watch, shorts, embed and live links, else null. */
export function youtubeInfo(url) {
  const u = toUrl(url);
  if (!u || platformOf(u.href) !== 'youtube') return null;
  const host = bareHost(hostOf(u));
  const parts = u.pathname.split('/').filter(Boolean);
  let id = null, shorts = false;
  if (host === 'youtu.be') id = parts[0];
  else if (parts[0] === 'watch' || u.pathname === '/') id = u.searchParams.get('v');
  else if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) { id = parts[1]; shorts = parts[0] === 'shorts'; }
  if (!id || !YT_ID.test(id)) return null;
  const start = parseStart(u.searchParams.get('t') || u.searchParams.get('start') || (u.hash.match(/t=([\dhms]+)/) || [])[1]);
  return { id, start, shorts };
}

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// ---------------- embeds (X, Instagram, Reddit) ----------------

/**
 * What can be embedded for this link:
 *   { kind: 'youtube', id, start, shorts }
 *   { kind: 'x', id }
 *   { kind: 'instagram', code, type: 'p' | 'reel' }
 *   { kind: 'reddit', path }
 * or null (e.g. a profile page or a short share link).
 */
export function embedInfo(url) {
  const u = toUrl(url);
  if (!u) return null;
  const platform = platformOf(u.href);
  const parts = u.pathname.split('/').filter(Boolean);
  if (platform === 'youtube') {
    const yt = youtubeInfo(u.href);
    return yt ? { kind: 'youtube', ...yt } : null;
  }
  if (platform === 'x') {
    const i = parts.findIndex((p) => p === 'status' || p === 'statuses');
    const id = i >= 0 ? parts[i + 1] : null;
    return id && /^\d{5,25}$/.test(id) ? { kind: 'x', id } : null;
  }
  if (platform === 'instagram') {
    const i = parts.findIndex((p) => ['p', 'reel', 'reels', 'tv'].includes(p));
    const code = i >= 0 ? parts[i + 1] : null;
    if (!code || !/^[A-Za-z0-9_-]{5,40}$/.test(code)) return null;
    return { kind: 'instagram', code, type: parts[i] === 'p' || parts[i] === 'tv' ? 'p' : 'reel' };
  }
  if (platform === 'reddit') {
    // /r/<sub>/comments/<id>/<slug>/  (share links like /r/<sub>/s/<code> can't be embedded)
    if (parts[0] === 'r' && parts[2] === 'comments' && /^[a-z0-9]{3,12}$/i.test(parts[3] || '')) {
      return { kind: 'reddit', path: `/r/${parts[1]}/comments/${parts[3]}/${parts[4] ? parts[4] + '/' : ''}` };
    }
    return null;
  }
  return null;
}

// ---------------- duplicate check ----------------

/**
 * A key that is the same for two links that point at the same thing:
 * http/https, www./m., trailing slashes, tracking parameters and parameter order
 * are ignored, and YouTube / X / Instagram / Reddit links are reduced to their post ID
 * (youtu.be/ID = youtube.com/watch?v=ID = /shorts/ID).
 */
export function urlKey(url) {
  const u = toUrl(url);
  if (!u) return String(url ?? '').trim().toLowerCase();
  const platform = platformOf(u.href);
  const e = embedInfo(u.href);
  if (e?.kind === 'youtube') return `youtube:${e.id}`;
  if (e?.kind === 'x') return `x:${e.id}`;
  if (e?.kind === 'instagram') return `instagram:${e.code}`;
  if (e?.kind === 'reddit') return `reddit:${e.path.split('/')[4].toLowerCase()}`;
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

/** Links whose key matches `url` (excluding `exceptId`). */
export function findDuplicates(url, links, exceptId = null) {
  const key = urlKey(url);
  return links.filter((l) => l.id !== exceptId && urlKey(l.url) === key);
}

/** Does `query` match a link's title, URL, description, notes or site? (search box) */
export function linkMatches(link, query, norm = (s) => String(s ?? '').toLowerCase()) {
  const q = norm(query).trim();
  if (!q) return true;
  return [link.title, link.url, link.description, link.notes, link.site_name, platformLabel(link.platform)]
    .some((s) => norm(s).includes(q));
}
