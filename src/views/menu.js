// Small shared pieces for the screen headers: the "⋯" menu and the sideways-scrolling chip row.
import { h, icon } from '../ui.js';

/**
 * A "⋯" button with a dropdown.
 * items: [{ ic, label, run, disabled, pressed }] — falsy entries are skipped.
 */
export function moreMenu(items, { label = 'More actions' } = {}) {
  const menu = h('div.menu', { hidden: true, role: 'menu' },
    items.filter(Boolean).map((it) => h('button.menu-item', {
      type: 'button', role: 'menuitem', disabled: !!it.disabled,
      'aria-pressed': it.pressed == null ? null : String(!!it.pressed),
      onclick: () => { menu.hidden = true; it.run(); },
    }, icon(it.ic), it.label)));
  const btn = h('button.icon-btn', {
    type: 'button', 'aria-label': label, title: label, 'aria-haspopup': 'true',
    onclick: (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      if (!menu.hidden) setTimeout(() => document.addEventListener('click', () => (menu.hidden = true), { once: true }));
    },
  }, icon('menu'));
  return h('div.menu-wrap', btn, menu);
}

/** A row of chips that scrolls sideways (the page itself never does). */
export function chipRow(label, children) {
  return h('nav.chiprow', { 'aria-label': label }, h('div.chiprow-scroll', children));
}

/** A round icon button for the title row. `on` = pressed (e.g. search is open). */
export function iconButton(ic, label, onclick, { on = false, dot = false, title = label } = {}) {
  return h(`button.icon-btn${on ? '.on' : ''}`, {
    type: 'button', 'aria-label': label, title, 'aria-pressed': on ? 'true' : null, onclick,
  }, icon(ic), dot ? h('span.dot', { 'aria-hidden': 'true' }) : null);
}

/** The search box that opens under the title. */
export function searchBar({ value, placeholder, label, oninput, onclose }) {
  return h('div.searchbar',
    h('span.searchbar-icon', icon('search')),
    h('input#search', { type: 'search', value, placeholder, 'aria-label': label, oninput, autocomplete: 'off', enterkeyhint: 'search' }),
    h('button.icon-btn.bare', { type: 'button', 'aria-label': 'Close search', title: 'Close search', onclick: onclose }, icon('close')));
}
