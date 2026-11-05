import { h, icon, prettyUrl, safeHref, errorToast } from '../ui.js';
import { api, findChar, coverOf, toggleFavorite, tagNamesOf } from '../state.js';
import { openLightbox } from './lightbox.js';
import { rerender } from '../nav.js';

export function renderCompare(root, arg) {
  const chars = arg.split(',').map(findChar).filter(Boolean).slice(0, 3);
  if (chars.length < 2) {
    root.replaceChildren(h('div.empty', h('h2', 'Pick at least two characters to compare'), h('a.btn', { href: '#/characters' }, 'Back to board')));
    return;
  }
  const cols = chars.map((c) => {
    const cover = coverOf(c);
    const links = (c.links || []).map(safeHref).filter(Boolean);
    return h('section.cmp-col',
      cover
        ? h('button.cmp-cover', { 'aria-label': `Open ${c.name} images`, onclick: () => openLightbox(c.images, c.images.indexOf(cover)) },
            h('img', { alt: '', 'data-path': cover.path, 'data-thumb': cover.thumb_path, style: `aspect-ratio:${cover.width}/${cover.height}` }))
        : h('div.cmp-cover.placeholder', 'No image'),
      c.images.length > 1
        ? h('div.cmp-strip', c.images.map((im, i) => h('button', { 'aria-label': `Image ${i + 1}`, onclick: () => openLightbox(c.images, i) },
            h('img', { alt: '', 'data-thumb': im.thumb_path || im.path }))))
        : null,
      h('div.cmp-head',
        h('h2', h('a', { href: `#/c/${c.id}` }, c.name)),
        h(`button.icon-btn.star-btn${c.is_favorite ? '.on' : ''}`, {
          'aria-pressed': String(!!c.is_favorite),
          'aria-label': c.is_favorite ? 'Remove from favorites' : 'Add to favorites',
          onclick: () => toggleFavorite(c, rerender).catch(errorToast),
        }, icon('star'))),
      c.source ? h('p.source', c.source) : null,
      tagNamesOf(c).length ? h('div.chips.inline', tagNamesOf(c).map((t) => h('span.chip', t))) : null,
      h('h4.label', 'Notes'),
      c.notes?.trim() ? h('div.notes', c.notes) : h('p.muted', '—'),
      links.length ? [h('h4.label', 'Sources'), h('ul.links', links.map((href) => h('li', h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, icon('link'), prettyUrl(href)))))] : null,
    );
  });
  const grid = h(`div.compare.n${chars.length}`, cols);
  root.replaceChildren(grid);
  loadUrls(grid);
}

async function loadUrls(container) {
  const imgs = [...container.querySelectorAll('img')];
  try {
    const urls = await api.getUrls(imgs.flatMap((i) => [i.dataset.thumb, i.dataset.path]));
    for (const img of imgs) {
      // big covers: show the thumbnail first, then upgrade to full size
      const first = urls[img.dataset.thumb] || urls[img.dataset.path];
      if (first) { img.onload = () => img.classList.add('loaded'); img.src = first; }
      if (img.dataset.path && urls[img.dataset.path] && img.dataset.thumb) {
        const full = new Image();
        full.src = urls[img.dataset.path];
        full.decode().then(() => { img.src = full.src; }).catch(() => {});
      }
    }
  } catch (e) { console.error(e); }
}
