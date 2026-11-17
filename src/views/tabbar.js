// The five-item navigation: a bar along the bottom on a phone, a rail down the left on a laptop.
// Characters · Vault · (+) · Recent · More
import { h, icon } from '../ui.js';
import { state } from '../state.js';
import { go } from '../nav.js';
import { tabOf } from '../sections.js';
import { openAddSheet } from './add-sheet.js';

export function renderTabbar(view) {
  const current = tabOf(view)?.id;
  const tab = (id, label, ic, href) =>
    h('a.tab', {
      href, 'aria-current': current === id ? 'page' : null,
      onclick: (e) => { e.preventDefault(); go(href); },
    }, icon(ic), h('span.tab-label', label));
  // Vault: back to where you were, unless you are already on the list (then up to "All links")
  const vaultHref = view === 'links' ? '#/links' : state.lastVaultHash || '#/links';
  return h('nav.tabbar', { 'aria-label': 'Main' },
    tab('characters', 'Characters', 'users', '#/characters'),
    tab('links', 'Vault', 'link', vaultHref),
    h('button.tab.tab-add', { type: 'button', 'aria-label': 'Add', title: 'Add (N)', onclick: openAddSheet }, icon('plus')),
    tab('recent', 'Recent', 'clock', '#/recent'),
    tab('more', 'More', 'menu', '#/more'));
}
