// Official embeds for X, Instagram and Reddit posts — the scripts are only
// loaded when you open a link's detail page (never on the vault grid).
import { h, icon } from './ui.js';
import { detectPlatform, PLATFORMS } from './linkutil.js';
import { currentTheme } from './theme.js';

const loaded = new Map();
function loadScript(src) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.charset = 'utf-8';
      s.onload = resolve;
      s.onerror = () => { loaded.delete(src); reject(new Error('Could not load ' + src)); };
      document.head.append(s);
    }));
  }
  return loaded.get(src);
}

/** true for links we can show with an official embed. */
export function hasEmbed(l) {
  const p = detectPlatform(l.url);
  return ['x', 'instagram', 'reddit'].includes(p.platform) && !!p.id;
}

/**
 * The embed for an X / Instagram / Reddit post. Shows a status line while the
 * platform's script loads, and a plain "open it there" note if it doesn't work
 * (blocked by a content blocker, deleted post, private account…).
 */
export function embedFor(l, fallback = null) {
  const p = detectPlatform(l.url);
  const theme = currentTheme();
  const slot = h('div.embed-slot');
  const status = h('p.embed-status.muted.small', `Loading the post from ${PLATFORMS[p.platform].label}…`);
  // the cover / placeholder card stays visible until the embed shows up (and if it never does)
  const cover = fallback ? h('div.embed-fallback', fallback) : null;
  const box = h(`div.embed.embed-${p.platform}`, cover, status, slot);
  const fail = () => {
    status.replaceChildren(icon('alert'), h('span', `Couldn’t show this post here. `),
      h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, PLATFORMS[p.platform].verb));
    status.classList.add('failed');
  };
  // consider it shown once the platform has put an iframe in
  const watch = () => {
    const done = () => !!slot.querySelector('iframe');
    const obs = new MutationObserver(() => { if (done()) { status.hidden = true; if (cover) cover.hidden = true; obs.disconnect(); } });
    obs.observe(slot, { childList: true, subtree: true });
    setTimeout(() => { if (!done()) { obs.disconnect(); fail(); } }, 12000);
  };

  if (p.platform === 'x') {
    watch();
    loadScript('https://platform.twitter.com/widgets.js')
      .then(() => window.twttr?.ready?.((tw) => tw.widgets.createTweet(p.id, slot, { theme, dnt: true, align: 'center' })))
      .catch(fail);
  } else if (p.platform === 'instagram') {
    const permalink = `https://www.instagram.com/${p.kind === 'post' ? 'p' : 'reel'}/${p.id}/`;
    slot.append(h('blockquote.instagram-media', { 'data-instgrm-permalink': permalink, 'data-instgrm-version': '14', 'data-instgrm-captioned': '' },
      h('a', { href: permalink, target: '_blank', rel: 'noopener noreferrer' }, 'View this post on Instagram')));
    watch();
    loadScript('https://www.instagram.com/embed.js')
      .then(() => window.instgrm?.Embeds?.process())
      .catch(fail);
  } else if (p.platform === 'reddit') {
    slot.append(h('blockquote.reddit-embed-bq', { 'data-embed-theme': theme, 'data-embed-height': '520', 'data-embed-showmedia': 'true' },
      h('a', { href: l.url }, l.title || 'Reddit post')));
    watch();
    // Reddit's script converts the blockquotes present when it runs, so add a fresh copy each time
    const s = document.createElement('script');
    s.src = 'https://embed.reddit.com/widgets.js'; s.async = true; s.charset = 'UTF-8';
    s.onerror = fail;
    slot.append(s);
  }
  return box;
}
