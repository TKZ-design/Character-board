// Pure link helpers (no DOM): find URLs in text, clean / normalise them for
// the duplicate check, and recognise the platforms the Link Vault knows.
// Unit tested in tests/links.test.js.

/** Query parameters that only track where a click came from. Removed before saving / comparing. */
const TRACKING = new Set([
  'si', 'igsh', 'igshid', 'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'twclid', 'ttclid',
  'mc_cid', 'mc_eid', '_ga', '_gl', 'ref_src', 'ref_url', 'share_id', 'utm', 'rdt', 'mibextid',
]);
/** Extra ones per platform (they mean something elsewhere, e.g. `t` is a YouTube timestamp). */
const TRACKING_BY_PLATFORM = {
  youtube: new Set(['feature', 'pp', 'ab_channel', 'embeds_referring_euri', 'source_ve_path']),
  x: new Set(['s', 't', 'src']),
  instagram: new Set(['img_index', 'hl']),
  reddit: new Set(['context', 'share_id', 'utm_name', 'sh', 'ref', 'rdt']),
};

/** The first http(s) link in some text ("Look at this https://…" from a Share sheet). */
export function extractUrl(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  const m = s.match(/https?:\/\/[^\s<>"'`]+/i);
  if (m) {
    let url = m[0].replace(/[.,;:!?]+$/, '');
    // drop a closing bracket that belongs to the sentence, not the link: "(see https://x.y/z)"
    while (/[)\]}]$/.test(url)) {
      const close = url.slice(-1), open = { ')': '(', ']': '[', '}': '{' }[close];
      if (url.split(open).length >= url.split(close).length) break;
      url = url.slice(0, -1).replace(/[.,;:!?]+$/, '');
    }
    return url;
  }
  // a bare domain like "youtube.com/watch?v=…"
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s) && !/\s/.test(s)) return 'https://' + s;
  return null;
}

/** Parse something the user typed into a URL object (adds https:// when missing). Only http/https. */
export function parseUrl(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(s) ? s : 'https://' + s);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return null;
    return u;
  } catch { return null; }
}

const bareHost = (h) => h.toLowerCase().replace(/^(www|m|mobile|old|new|np|amp)\./, '');

/**
 * Which platform is this, and what's its content id?
 * Returns { platform: 'youtube'|'x'|'instagram'|'reddit'|'web', id?, kind? }
 */
export function detectPlatform(input) {
  const u = input instanceof URL ? input : parseUrl(input);
  if (!u) return { platform: 'web' };
  const host = bareHost(u.hostname);
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const ok = (id) => /^[\w-]{11}$/.test(id || '');
    let id = null, kind = 'video';
    if (host === 'youtu.be') id = parts[0];
    else if (parts[0] === 'watch') id = u.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) { id = parts[1]; if (parts[0] === 'shorts') kind = 'short'; }
    else if (u.searchParams.get('v')) id = u.searchParams.get('v');
    return ok(id) ? { platform: 'youtube', id, kind } : { platform: 'youtube' };
  }
  if (host === 'x.com' || host === 'twitter.com' || host === 'fxtwitter.com' || host === 'vxtwitter.com' || host === 'fixupx.com') {
    const i = parts.indexOf('status');
    const id = i >= 0 && /^\d{5,25}$/.test(parts[i + 1] || '') ? parts[i + 1] : null;
    return id ? { platform: 'x', id, kind: 'post', user: i > 0 ? parts[0] : null } : { platform: 'x' };
  }
  if (host === 'instagram.com' || host === 'instagr.am') {
    // /reel/CODE, /p/CODE, /tv/CODE, and /<user>/reel/CODE
    const i = parts.findIndex((p) => ['p', 'reel', 'reels', 'tv'].includes(p));
    const code = i >= 0 ? parts[i + 1] : null;
    if (code && /^[\w-]{5,40}$/.test(code)) return { platform: 'instagram', id: code, kind: parts[i] === 'p' ? 'post' : 'reel' };
    return { platform: 'instagram' };
  }
  if (host === 'reddit.com' || host.endsWith('.reddit.com') || host === 'redd.it') {
    if (host === 'redd.it' && /^\w{4,12}$/.test(parts[0] || '')) return { platform: 'reddit', id: parts[0], kind: 'post' };
    const i = parts.indexOf('comments');
    if (i >= 0 && /^\w{4,12}$/.test(parts[i + 1] || '')) return { platform: 'reddit', id: parts[i + 1], kind: 'post', sub: parts[0] === 'r' ? parts[1] : null };
    return { platform: 'reddit' };
  }
  return { platform: 'web' };
}

/**
 * Clean a link for saving and for the duplicate check.
 * Returns { url, key, platform, id } or null when it isn't a usable http(s) link.
 * - url: the link without tracking parameters (what we store and open)
 * - key: a normalised identity: same key = same link (ignores www/m., tracking, order of
 *        parameters, a trailing slash, #fragments; YouTube/X/Instagram/Reddit by content id)
 */
export function normalizeUrl(input) {
  const u = parseUrl(input);
  if (!u) return null;
  const p = detectPlatform(u);
  const extra = TRACKING_BY_PLATFORM[p.platform] || new Set();
  for (const k of [...u.searchParams.keys()]) {
    const lk = k.toLowerCase();
    if (lk.startsWith('utm_') || TRACKING.has(lk) || extra.has(lk)) u.searchParams.delete(k);
  }
  u.username = ''; u.password = '';
  const url = u.href;

  let key;
  if (p.platform === 'youtube' && p.id) key = `youtube:${p.id}`;
  else if (p.platform === 'x' && p.id) key = `x:${p.id}`;
  else if (p.platform === 'instagram' && p.id) key = `instagram:${p.id}`;
  else if (p.platform === 'reddit' && p.id) key = `reddit:${p.id}`;
  else {
    const host = bareHost(u.hostname);
    const path = u.pathname.replace(/\/+$/, '') || '';
    const q = [...u.searchParams].sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y));
    const qs = q.length ? '?' + new URLSearchParams(q).toString() : '';
    const port = u.port && !['80', '443'].includes(u.port) ? ':' + u.port : '';
    key = `${host}${port}${path}${qs}`.toLowerCase();
  }
  return { url, key, platform: p.platform, id: p.id || null, kind: p.kind || null };
}

/** "youtube.com" from a URL (no www.). */
export function domainOf(input) {
  const u = input instanceof URL ? input : parseUrl(input);
  return u ? u.hostname.toLowerCase().replace(/^www\./, '') : '';
}

export const PLATFORMS = {
  youtube: { label: 'YouTube', verb: 'Watch on YouTube' },
  x: { label: 'X', verb: 'Open on X' },
  instagram: { label: 'Instagram', verb: 'Open on Instagram' },
  reddit: { label: 'Reddit', verb: 'Open on Reddit' },
  web: { label: 'Web', verb: 'Open link' },
};
export const platformLabel = (p) => (PLATFORMS[p] || PLATFORMS.web).label;

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export function youtubeEmbed(id, start) {
  const q = new URLSearchParams({ rel: '0', playsinline: '1', modestbranding: '1' });
  if (start) q.set('start', String(start));
  return `https://www.youtube-nocookie.com/embed/${id}?${q}`;
}
/** "1m30s" / "90" / "90s" → seconds (YouTube's t= parameter). */
export function youtubeStart(input) {
  const u = parseUrl(input);
  const t = u?.searchParams.get('t') || u?.searchParams.get('start');
  if (!t) return 0;
  if (/^\d+$/.test(t)) return +t;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}

/** Does `query` match a link's title, url, site, notes or description? (vault search) */
export function matchesLinkSearch(l, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  return [l.title, l.url, l.site_name, l.notes, l.description]
    .some((s) => String(s ?? '').toLowerCase().includes(q));
}
