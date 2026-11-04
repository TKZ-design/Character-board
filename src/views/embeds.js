// In-app players for saved links, created only when you open a link:
//  • YouTube: the privacy-enhanced youtube-nocookie.com player
//  • X, Instagram, Reddit: each platform's official embed page — the same
//    iframe their embed code creates — loaded as a cross-origin frame, so no
//    third-party script ever runs inside this app (where your login lives).
import { h, icon } from '../ui.js';
import { embedInfo, youtubeThumb, platformLabel } from '../links.js';
import { currentTheme } from '../theme.js';

const ALLOW = 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write';
const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation';

function frame(src, { title, height, maxWidth, cls = '' }) {
  return h(`div.embed-wrap${cls}`, { style: `max-width:${maxWidth}px` },
    h('iframe.embed-frame', {
      src, title, loading: 'lazy', allow: ALLOW, sandbox: SANDBOX, allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin', style: `height:${height}px`,
    }));
}

function youtube(info, title) {
  const params = new URLSearchParams({ rel: '0', playsinline: '1', modestbranding: '1', autoplay: '1' });
  if (info.start) params.set('start', String(info.start));
  const src = `https://www.youtube-nocookie.com/embed/${info.id}?${params}`;
  const box = h(`div.yt${info.shorts ? '.yt-shorts' : ''}`);
  const poster = h('button.yt-poster', {
    type: 'button', 'aria-label': `Play “${title}”`,
    onclick: () => {
      box.replaceChildren(h('iframe.yt-frame', {
        src, title, allow: ALLOW, allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin',
      }));
    },
  },
    h('img', { src: youtubeThumb(info.id), alt: '', referrerpolicy: 'no-referrer' }),
    h('span.yt-play', { 'aria-hidden': 'true' }, icon('play')));
  box.append(poster);
  return box;
}

/** The embed element for a link, or null if the platform/link can't be embedded. */
export function embedFor(l, title) {
  const e = embedInfo(l.url);
  if (!e) return null;
  const theme = currentTheme() === 'dark' ? 'dark' : 'light';
  if (e.kind === 'youtube') return youtube(e, title);
  if (e.kind === 'x') {
    return frame(`https://platform.twitter.com/embed/Tweet.html?id=${e.id}&theme=${theme}&dnt=true&lang=en`,
      { title: `Post on X: ${title}`, height: 620, maxWidth: 550 });
  }
  if (e.kind === 'instagram') {
    return frame(`https://www.instagram.com/${e.type}/${e.code}/embed/captioned/`,
      { title: `Instagram ${e.type === 'reel' ? 'reel' : 'post'}: ${title}`, height: 760, maxWidth: 540 });
  }
  if (e.kind === 'reddit') {
    return frame(`https://embed.reddit.com${e.path}?embed=true&theme=${theme}&showmedia=true&showmore=false&depth=1`,
      { title: `Reddit post: ${title}`, height: 560, maxWidth: 640 });
  }
  return null;
}

export const embedNote = (platform) => (platform === 'youtube'
  ? 'Plays here with YouTube’s privacy-enhanced player (youtube-nocookie.com).'
  : `Embedded from ${platformLabel(platform)}. It only loads when you open this page.`);

// The embeds tell us their real height with postMessage — resize to fit.
window.addEventListener('message', (e) => {
  const frameEl = [...document.querySelectorAll('iframe.embed-frame')].find((f) => f.contentWindow === e.source);
  if (!frameEl) return;
  try { if (new URL(frameEl.src).origin !== e.origin) return; } catch { return; }
  let d = e.data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
  if (!d || typeof d !== 'object') return;
  const height = Number(
    d['twttr.embed']?.method === 'twttr.private.resize' ? d['twttr.embed'].params?.[0]?.height
      : d.type === 'MEASURE' ? d.details?.height
        : d.type === 'resize.embed' ? d.data
          : d.height,
  );
  if (height > 80 && height < 6000) frameEl.style.height = `${Math.ceil(height)}px`;
});
