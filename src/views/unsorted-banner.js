// The banner above the tab bar: "3 new in Unsorted · Move to folder".
import { h, icon, toast, errorToast } from '../ui.js';
import { state, newUnsortedLinks, markUnsortedSeen, moveLinksTo } from '../state.js';
import { pathText } from '../folders.js';
import { go, rerender } from '../nav.js';
import { pickFolder } from './folder-ui.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
let el = null;

async function moveNew() {
  const links = newUnsortedLinks();
  if (!links.length) return update();
  const target = await pickFolder({ title: `Move ${plural(links.length, 'new link')} to…`, okText: 'Move here', current: undefined });
  if (target === undefined) return; // cancelled: the banner stays
  try {
    markUnsortedSeen(links);
    const n = await moveLinksTo(links, target);
    toast(n ? `Moved ${plural(n, 'link')} to ${pathText(state.folders, target)}` : 'Already there', { type: 'ok', timeout: 2500 });
  } catch (e) { errorToast(e); }
  rerender();
}

/**
 * Show, update or hide the banner. Call it after anything that can change the answer
 * (a render, a refresh). It stays out of the way while you look at Unsorted, pick links or compare.
 */
export function updateBanner() {
  const links = state.user ? newUnsortedLinks() : [];
  const busy = (state.vaultScope === 'unsorted' && location.hash.startsWith('#/links')) || !!document.querySelector('.compare-bar');
  if (!links.length || busy) {
    el?.remove();
    el = null;
    document.body.classList.remove('has-banner');
    return;
  }
  const n = links.length;
  const next = h('div.banner', { role: 'status' },
    h('a.banner-text', { href: '#/links/unsorted', onclick: (e) => { e.preventDefault(); markUnsortedSeen(); go('#/links/unsorted'); } },
      icon('tray'), h('span', `${n} new in Unsorted`)),
    h('button.btn.primary.small-btn', { type: 'button', onclick: moveNew }, 'Move to folder'),
    h('button.icon-btn.bare', { type: 'button', 'aria-label': 'Dismiss', title: 'Dismiss', onclick: () => { markUnsortedSeen(); updateBanner(); } }, icon('close')));
  if (el) el.replaceWith(next); else document.body.append(next);
  el = next;
  document.body.classList.add('has-banner');
}
