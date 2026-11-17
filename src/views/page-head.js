// The big title at the top of a main screen, with icon buttons on the right and (optionally) a row below.
import { h } from '../ui.js';

export function pageHead({ title, actions = null, below = null }) {
  return h('header.page-top',
    h('div.page-inner',
      h('div.title-row',
        h('h1.title', title),
        actions ? h('div.title-actions', actions) : null),
      below));
}
