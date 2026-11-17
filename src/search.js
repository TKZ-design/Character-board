// The search box lives behind a search icon in the title row. These helpers open/close it
// (the "/" shortcut uses openSearch too). `view` is the route name: 'links' for the Vault, anything else = Characters.
import { state } from './state.js';

const textOf = (view) => (view === 'links' ? state.linkFilter.search : state.search);

/** Open while you are using it, and while it holds text (so a filter can't hide behind a closed box). */
export function isSearchOpen(view) {
  return state.searchOpen || !!textOf(view).trim();
}

export function openSearch(view, rerender) {
  if (!isSearchOpen(view)) { state.searchOpen = true; rerender(); }
  document.getElementById('search')?.focus();
}

/** Closing the box also clears what you typed. */
export function toggleSearch(view, rerender) {
  if (isSearchOpen(view)) {
    state.searchOpen = false;
    if (view === 'links') state.linkFilter.search = ''; else state.search = '';
    rerender();
  } else openSearch(view, rerender);
}
