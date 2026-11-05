// How a saved link looks: its picture (your thumbnail → YouTube's → the site's
// preview → a platform-styled placeholder), grid cards and list rows.
import { h, icon, errorToast } from '../ui.js';
import { linkTitle, tagNamesOf, patchLink } from '../state.js';
import { platformLabel, domainOf, youtubeInfo, youtubeThumb } from '../links.js';
import { listRow } from './viewbar.js';

/** { path } for your own thumbnail (private storage), { url } for a public one, or null. */
export function linkCover(l) {
  if (l.cover_thumb_path || l.cover_path) return { path: l.cover_thumb_path || l.cover_path, full: l.cover_path || l.cover_thumb_path };
  if (l.platform === 'youtube') {
    const yt = youtubeInfo(l.url);
    if (yt) return { url: youtubeThumb(yt.id) };
  }
  if (l.thumbnail_url) return { url: l.thumbnail_url };
  return null;
}

/** Clean placeholder for links without a picture: platform, your title, domain. */
export function placeholder(l, { size = 'card' } = {}) {
  return h(`div.link-ph.ph-${l.platform || 'web'}.ph-${size}`,
    h('span.link-ph-platform', h('span.link-ph-dot', { 'aria-hidden': 'true' }), platformLabel(l.platform)),
    h('span.link-ph-title', linkTitle(l)),
    h('span.link-ph-domain', domainOf(l.url)));
}

/** The picture for a link, falling back to the placeholder if it can't load. */
export function linkMedia(l, { size = 'card' } = {}) {
  const cover = linkCover(l);
  const box = h(`div.link-media.lm-${size}`);
  if (!cover) { box.append(placeholder(l, { size })); return box; }
  const img = h('img', { alt: '', decoding: 'async', loading: 'lazy', referrerpolicy: 'no-referrer' });
  img.addEventListener('error', () => { box.replaceChildren(placeholder(l, { size })); });
  img.addEventListener('load', () => {
    // YouTube answers a missing video with a tiny grey 120×90 image
    if (cover.url?.includes('i.ytimg.com') && img.naturalWidth <= 120) { box.replaceChildren(placeholder(l, { size })); return; }
    img.classList.add('loaded');
  });
  if (cover.path) img.dataset.path = cover.path; // filled in by loadThumbs()
  else img.src = cover.url;
  box.append(img);
  if (l.platform === 'youtube' && size !== 'row') box.append(h('span.play-badge', { 'aria-hidden': 'true' }, icon('play')));
  return box;
}

export function starButton(l, after) {
  const label = () => (l.is_favorite ? `Unfavorite ${linkTitle(l)}` : `Favorite ${linkTitle(l)}`);
  const btn = h(`button.star${l.is_favorite ? '.on' : ''}`, {
    type: 'button', title: l.is_favorite ? 'Remove from favorites' : 'Add to favorites',
    'aria-label': label(), 'aria-pressed': String(!!l.is_favorite),
    onclick: (e) => {
      e.preventDefault();
      patchLink(l, { is_favorite: !l.is_favorite }, () => {
        btn.classList.toggle('on', l.is_favorite);
        btn.setAttribute('aria-pressed', String(l.is_favorite));
        btn.setAttribute('aria-label', label());
        after?.();
      }).catch(errorToast);
    },
  }, icon('star'));
  return btn;
}

export function doneButton(l, after) {
  const done = () => l.status === 'done';
  const btn = h(`button.done-btn${done() ? '.on' : ''}`, {
    type: 'button', title: done() ? 'Done — tap to mark as “To watch”' : 'To watch — tap to mark as done',
    'aria-label': `Done: ${linkTitle(l)}`, 'aria-pressed': String(done()),
    onclick: (e) => {
      e.preventDefault();
      patchLink(l, { status: done() ? 'todo' : 'done' }, () => {
        btn.classList.toggle('on', done());
        btn.setAttribute('aria-pressed', String(done()));
        after?.();
      }).catch(errorToast);
    },
  }, icon('check'));
  return btn;
}

const statusText = (l) => (l.status === 'done' ? 'Done' : 'To watch');

function metaLine(l) {
  const tags = tagNamesOf(l);
  return [platformLabel(l.platform), statusText(l), ...tags.slice(0, 3), tags.length > 3 ? `+${tags.length - 3}` : null].filter(Boolean).join(' · ');
}

/** Card for the grid. `after` runs when star/done change (to refresh filtered views). */
export function linkCard(l, after) {
  const href = `#/l/${l.id}`;
  return h(`article.lcard${l.status === 'done' ? '.is-done' : ''}`, { 'data-id': l.id },
    h('a.lcard-media-link', { href, tabindex: '-1', 'aria-hidden': 'true' }, linkMedia(l)),
    h('div.caption',
      h('a.card-link', { href },
        h('h3.lcard-title', linkTitle(l)),
        h('p.card-source', domainOf(l.url)),
        h('p.card-meta', metaLine(l))),
      h('div.card-btns', doneButton(l, after), starButton(l, after))));
}

/** Row for the compact list. */
export function linkRow(l, after) {
  return listRow({
    href: `#/l/${l.id}`,
    cls: l.status === 'done' ? '.is-done' : '',
    thumb: linkMedia(l, { size: 'row' }),
    title: linkTitle(l),
    sub: domainOf(l.url),
    meta: metaLine(l),
    buttons: [doneButton(l, after), starButton(l, after)],
  });
}

/** Small rows of links (used on a character's page). */
export function miniLinkList(links) {
  return h('ul.mini-links', links.map((l) =>
    h('li', h('a.mini-link', { href: `#/l/${l.id}` },
      h('span.mini-link-thumb', linkMedia(l, { size: 'row' })),
      h('span.mini-link-text',
        h('span.mini-link-title', linkTitle(l)),
        h('span.mini-link-meta', `${platformLabel(l.platform)} · ${statusText(l)}`))))));
}

