import { h, icon } from '../ui.js';
import { api } from '../state.js';
import { SECTIONS } from '../sections.js';

/** The landing page: one big tile per section, with counts and a few recent images. */
export function renderHome(root) {
  const tiles = SECTIONS.map((s, i) => {
    const thumbs = s.previews(4);
    return h('a.hub-tile', { href: s.href, 'data-section': s.id },
      h('span.hub-num', String(i + 1).padStart(2, '0')),
      h('span.hub-name', s.title),
      h('span.hub-count', s.summary()),
      h('span.hub-blurb.muted', s.blurb),
      h('span.hub-strip', { 'aria-hidden': 'true' },
        [0, 1, 2, 3].map((k) => {
          const t = thumbs[k];
          if (!t) return h('span.hub-cell.is-blank');
          const img = h('img', { alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', 'data-path': t.path || null });
          img.onload = () => img.classList.add('loaded');
          img.onerror = () => img.remove();
          if (t.src) img.src = t.src;
          return h('span.hub-cell', img);
        })),
      h('span.hub-open', 'Open', icon('next')));
  });
  root.replaceChildren(h('div.hub-tiles', tiles));
  fillSigned(root);
}

async function fillSigned(root) {
  const imgs = [...root.querySelectorAll('img[data-path]')];
  if (!imgs.length) return;
  try {
    const urls = await api.getUrls(imgs.map((i) => i.dataset.path));
    for (const img of imgs) if (urls[img.dataset.path]) img.src = urls[img.dataset.path];
  } catch (e) { console.error(e); }
}
