// The app's tabs (bottom bar on a phone, side rail on a laptop) and which screens belong to which.
// To add a new tab later:
//   1. add an entry to TABS (id, label, the route names it owns)
//   2. add its route(s) to ROUTES in main.js, a header in main.js → headerFor(), and an item in views/tabbar.js
export const TABS = [
  { id: 'characters', label: 'Characters', views: ['characters', 'c', 'compare'] },
  { id: 'links', label: 'Vault', views: ['links', 'l'] },
  { id: 'recent', label: 'Recent', views: ['recent'] },
  { id: 'more', label: 'More', views: ['more', 'tags', 'vault-tags'] },
];

/** The tab a route lights up. */
export function tabOf(view) {
  return TABS.find((t) => t.views.includes(view)) || null;
}

/**
 * Which kind of thing a route is about, for shortcuts like N (new) and T (tags):
 * 'links' for the Link Vault and its tags, 'characters' for everything else.
 */
export function contextOf(view) {
  return ['links', 'l', 'vault-tags'].includes(view) ? 'links' : 'characters';
}

/** The tabs you can come back to on start-up ("the section I used last"). */
export const REMEMBERED = ['characters', 'links', 'recent'];
