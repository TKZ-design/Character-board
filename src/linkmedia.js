// Thumbnails for saved links: your own cover > YouTube still > Open Graph image
// > a platform-styled placeholder card (platform name, domain, your title).
import { h, icon } from './ui.js';
import { api } from './state.js';
import { detectPlatform, domainOf, platformLabel, youtubeThumb } from './linkutil.js';

/** What to show as a link's cover: { path } (our storage), { src } (remote) or null. */
export function linkCover(l) {
  if (l.image_thumb_path || l.image_path) return { path: l.image_thumb_path || l.image_path, full: l.image_path };
  if (l.platform === 'youtube') {
    const id = detectPlatform(l.url).id;
    if (id) return { src: youtubeThumb(id) };
  }
  if (l.thumbnail_url) return { src: l.thumbnail_url };
  return null;
}

export function linkTitle(l) {
  return l.title?.trim() || domainOf(l.url) || l.url;
}

/** The clean "no preview" card. */
export function placeholder(l, { compact = false } = {}) {
  const p = l.platform || 'web';
  return h(`div.link-ph.ph-${p}${compact ? '.compact' : ''}`,
    h('span.ph-top', icon(p in PLATFORM_ICONS ? p : 'web'), h('span.ph-platform', platformLabel(p))),
    compact ? null : h('span.ph-title', l.title?.trim() || 'Untitled link'),
    compact ? null : h('span.ph-domain', domainOf(l.url)));
}
const PLATFORM_ICONS = { youtube: 1, x: 1, instagram: 1, reddit: 1, web: 1 };

/**
 * A link's media box (16:9). Remote images fall back to the placeholder if they
 * fail to load (expired / blocked Open Graph images are common).
 */
export function linkMedia(l, { compact = false, cls = '' } = {}) {
  const cover = linkCover(l);
  const box = h(`div.link-media${cls ? '.' + cls : ''}`);
  if (!cover) { box.append(placeholder(l, { compact })); box.classList.add('is-ph'); return box; }
  const img = h('img', {
    alt: '', loading: 'lazy', decoding: 'async',
    referrerpolicy: 'no-referrer',
    'data-path': cover.path || null,
  });
  img.onload = () => img.classList.add('loaded');
  img.onerror = () => { box.replaceChildren(placeholder(l, { compact })); box.classList.add('is-ph'); };
  if (cover.src) img.src = cover.src;
  box.append(img);
  if (l.platform === 'youtube' && !compact) box.append(h('span.play-badge', { 'aria-hidden': 'true' }, icon('play')));
  return box;
}

/** Fill <img data-path> (custom covers in our private bucket) with signed URLs. */
export async function loadLinkImages(container) {
  const imgs = [...container.querySelectorAll('.link-media img[data-path]')];
  if (!imgs.length) return;
  try {
    const urls = await api.getUrls(imgs.map((i) => i.dataset.path));
    for (const img of imgs) if (urls[img.dataset.path]) img.src = urls[img.dataset.path];
  } catch (e) { console.error(e); }
}
