import { h, icon } from '../ui.js';

/**
 * The row above a collection: result count on the left, Sort + Grid/List on the right.
 * `onSort(sort)` / `onView(view)` save the choice and re-render.
 */
export function viewBar({ text, sort, view, onSort, onView, nameLabel = 'Name' }) {
  const labels = { added: 'Date added', name: nameLabel, updated: 'Last updated' };
  const select = h('select.sort-select', { 'aria-label': 'Sort by', onchange: (e) => onSort(e.target.value) },
    Object.entries(labels).map(([value, label]) => h('option', { value, selected: value === sort }, label)));
  const viewBtn = (value, label) =>
    h(`button.view-btn${view === value ? '.on' : ''}`, {
      type: 'button', 'aria-pressed': String(view === value), title: `${label} view`,
      onclick: () => { if (view !== value) onView(value); },
    }, icon(value), h('span', label));
  return h('div.viewbar',
    h('p.result-count', text),
    h('div.viewbar-tools',
      h('label.sort', h('span.search-label', 'Sort'), select),
      h('div.view-toggle', { role: 'group', 'aria-label': 'View' }, viewBtn('grid', 'Grid'), viewBtn('list', 'List'))));
}

/**
 * One row of a compact list. The whole text block is one link (keyboard + screen
 * reader friendly); extra buttons (star, done) sit on the right.
 */
export function listRow({ href, thumb, title, sub, meta, buttons = [], cls = '', onclick, pressed }) {
  return h(`li.lrow${cls}`,
    h('a.lrow-link', { href, onclick, 'aria-pressed': pressed },
      h('span.lrow-thumb', thumb),
      h('span.lrow-text',
        h('span.lrow-title', title),
        sub ? h('span.lrow-sub', sub) : null,
        meta ? h('span.lrow-meta', meta) : null)),
    buttons.length ? h('span.lrow-btns', buttons) : null);
}
