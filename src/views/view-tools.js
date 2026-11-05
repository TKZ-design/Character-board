import { h, icon } from '../ui.js';
import { SORTS } from '../state.js';
import { setPref } from '../prefs.js';

/**
 * The row above a collection: "12 characters" on the left; Sort and Grid / List on the right.
 * `key` is 'char' or 'link' (each remembers its own choice on this device).
 */
export function viewTools({ count, key, view, sort, onChange }) {
  const select = h('select.group-select.sort-select', {
    'aria-label': 'Sort by',
    onchange: (e) => { setPref(`${key}-sort`, e.target.value); onChange({ sort: e.target.value }); },
  }, Object.entries(SORTS).map(([v, label]) => h('option', { value: v, selected: v === sort }, label)));
  const btn = (v, label) => h(`button.icon-btn.view-btn${view === v ? '.on' : ''}`, {
    type: 'button', 'aria-pressed': String(view === v), 'aria-label': `${label} view`, title: `${label} view`,
    onclick: () => { setPref(`${key}-view`, v); onChange({ view: v }); },
  }, icon(v));
  return h('div.view-tools',
    h('p.result-count', count),
    h('div.view-tools-right',
      h('label.sort', h('span.search-label', 'Sort'), select),
      h('div.view-switch', { role: 'group', 'aria-label': 'Layout' }, btn('grid', 'Grid'), btn('list', 'List'))));
}
