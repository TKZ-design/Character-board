import './style.css';
import { h, icon, errorToast, toast } from './ui.js';
import { api, setApi, state, randomCharacter, randomLink, getPref, setPref } from './state.js';
import { setRerender, setPasteTarget, getPasteTarget, go } from './nav.js';
import { filesFromPaste } from './upload.js';
import { parseUrl } from './links.js';
import { tabOf, contextOf, REMEMBERED } from './sections.js';
import { renderLogin } from './views/login.js';
import { renderMore } from './views/more.js';
import { renderRecent } from './views/recent.js';
import { renderTabbar } from './views/tabbar.js';
import { pageHead } from './views/page-head.js';
import { moreMenu, iconButton, searchBar } from './views/menu.js';
import { isSearchOpen, toggleSearch, openSearch } from './search.js';
import { renderGrid, filterChips } from './views/grid.js';
import { renderDetail, resetEditing } from './views/detail.js';
import { openNewCharacter } from './views/new-character.js';
import { renderCompare } from './views/compare.js';
import { renderTags } from './views/tags.js';
import { openImageChooser } from './views/image-chooser.js';
import { renderVault, vaultHeader, scopeFromArg, parentHref } from './views/vault.js';
import { renderVaultTags } from './views/vault-tags.js';
import { renderLinkDetail, resetLinkEditing } from './views/link-detail.js';
import { openAddLink } from './views/add-link.js';
import { fillPendingPreviews } from './previews.js';
import { takeSharedFiles } from './share.js';

const app = document.getElementById('app');
let lastRoute = '';

function route() {
  const [, view = '', arg = ''] = location.hash.match(/^#\/?([^/]*)\/?(.*)$/) || [];
  return { view, arg: decodeURIComponent(arg) };
}

// ---------------- header ----------------

const TAG_VIEWS = ['tags', 'vault-tags'];

/** Where "back" goes from a detail page, and what to call it. */
function backTarget(r) {
  if (r.view === 'l') return { href: state.lastVaultHash || '#/links', label: 'Vault' };
  if (r.view === 'c' || r.view === 'compare') return { href: '#/characters', label: 'Characters' };
  // Tags pages: back to wherever you opened them from (More, or a section through the T shortcut)
  const from = state.tagsBack || '#/more';
  const label = from.startsWith('#/links') ? 'Vault' : from.startsWith('#/characters') ? 'Characters'
    : from.startsWith('#/recent') ? 'Recent' : from.startsWith('#/more') ? 'More' : 'Back';
  return { href: from, label };
}

/** The tab the app opens on: the one you used last (Characters the first time). */
function homeHash() {
  const id = getPref('last-section', 'characters', REMEMBERED);
  return id === 'links' ? state.lastVaultHash || '#/links' : `#/${id}`;
}

function randomButton() {
  return h('button.icon-btn', { type: 'button', onclick: goRandom, title: 'Random inspiration (R)', 'aria-label': 'Random' }, icon('dice'));
}

function charactersHeader(r) {
  const open = isSearchOpen('characters');
  return pageHead({
    title: 'Characters',
    actions: [
      iconButton('search', 'Search (/)', () => toggleSearch('characters', render), { on: open }),
      randomButton(),
      moreMenu([
        { ic: 'columns', label: state.compareMode ? 'Stop comparing' : 'Compare characters', pressed: state.compareMode, disabled: !state.characters.length,
          run: () => { state.compareMode = !state.compareMode; state.compareSel = []; render(); } },
        { ic: 'tag', label: 'Manage tags', run: () => go('#/tags') },
      ]),
    ],
    below: [
      open ? searchBar({
        value: state.search, placeholder: 'Name or source', label: 'Search characters',
        oninput: (e) => { state.search = e.target.value; renderView(); },
        onclose: () => toggleSearch('characters', render),
      }) : null,
      state.characters.length ? filterChips(render) : null,
    ],
  });
}

/** Each screen's own header (above the content). */
function headerFor(r) {
  if (r.view === 'characters') return charactersHeader(r);
  if (r.view === 'links') return vaultHeader({ rerender: render, renderView, onRandom: goRandom });
  if (r.view === 'recent') return pageHead({ title: 'Recent' });
  if (r.view === 'more') return pageHead({ title: 'More' });
  // detail pages, compare, tags: a back link
  const back = backTarget(r);
  return h('header.topbar',
    h('a.back', { href: back.href }, icon('back'), h('span', back.label)),
    ['c', 'l'].includes(r.view) ? randomButton() : null);
}

function goRandom() {
  const r = route();
  if (contextOf(r.view) === 'links') {
    const l = randomLink(r.view === 'l' ? r.arg : null);
    if (l) go(`#/l/${l.id}`);
    else toast(state.links.length ? 'No links match your filters' : 'Add some links first!');
    return;
  }
  const c = randomCharacter(r.view === 'c' ? r.arg : null);
  if (c) go(`#/c/${c.id}`);
  else toast(state.characters.length ? 'No characters match your filters' : 'Add some characters first!');
}

// ---------------- views ----------------
const viewEl = h('main#view');
let navEl = h('div');
let headerEl = h('div');

const ROUTES = {
  characters: (root) => renderGrid(root, render), // full render so the header's filters/Compare stay in sync
  c: (root, arg) => renderDetail(root, arg),
  compare: (root, arg) => renderCompare(root, arg),
  tags: (root) => renderTags(root),
  links: (root, arg) => renderVault(root, render, arg),
  'vault-tags': (root) => renderVaultTags(root),
  l: (root, arg) => renderLinkDetail(root, arg),
  recent: (root) => renderRecent(root, render),
  more: (root) => renderMore(root, render),
};

function renderView() {
  const r = route();
  viewEl.className = 'view-' + (r.view === 'characters' ? 'grid' : r.view);
  setPasteTarget(null);
  (ROUTES[r.view] || ROUTES.characters)(viewEl, r.arg);
}

let lastHash = '';

function render() {
  document.body.classList.toggle('has-nav', !!state.user);
  if (!state.user) { renderLogin(app, { pendingUrl: peekPendingAdd() }); return; }
  const r = route();
  // No Home screen any more: an empty or old address opens the section you used last
  if (!(r.view in ROUTES)) { location.replace(homeHash()); return; }
  state.vaultScope = r.view === 'links' ? scopeFromArg(r.arg) : null; // the header's search box needs it
  const key = r.view + '/' + r.arg;
  const keyChanged = key !== lastRoute;
  if (keyChanged) {
    const prevView = lastRoute.split('/')[0];
    if (prevView !== r.view) state.searchOpen = false; // a search box open in one screen does not follow you to the next
    resetEditing();
    resetLinkEditing();
    if (r.view !== 'characters') { state.compareMode = false; state.compareSel = []; }
    state.vaultSelect = null; // leaving a folder ends "Select"
    if (r.view === 'links') state.lastVaultHash = location.hash || '#/links';
    if (TAG_VIEWS.includes(r.view) && !TAG_VIEWS.includes(prevView)) state.tagsBack = lastHash || '#/more';
    const tab = tabOf(r.view);
    if (tab && REMEMBERED.includes(tab.id)) setPref('last-section', tab.id);
    lastRoute = key;
    window.scrollTo(0, 0);
  }
  lastHash = location.hash;
  const newHeader = headerFor(r);
  const newNav = renderTabbar(r.view);
  // keep the search box focused while typing
  const hadFocus = document.activeElement?.id === 'search';
  const chipScroll = headerEl.querySelector?.('.chiprow-scroll')?.scrollLeft || 0;
  if (!app.contains(viewEl)) app.replaceChildren(navEl, headerEl, viewEl);
  navEl.replaceWith(newNav);
  navEl = newNav;
  headerEl.replaceWith(newHeader);
  headerEl = newHeader;
  renderView();
  if (hadFocus) newHeader.querySelector('#search')?.focus();
  // chips: stay where they were while you tap them; on a new screen, bring the lit one into view
  const chips = newHeader.querySelector('.chiprow-scroll');
  if (chips) {
    if (!keyChanged) chips.scrollLeft = chipScroll;
    else chips.querySelector('.filter.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
}

setRerender(render);
window.addEventListener('hashchange', render);

// ---------------- paste & drop anywhere ----------------
const isTyping = (el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable;

function deliverFiles(files) {
  if (!state.user || !files.length) return;
  const target = getPasteTarget();
  if (target) target(files);
  else openImageChooser(files); // ask: new character, or add to an existing one?
}
document.addEventListener('paste', (e) => {
  const files = filesFromPaste(e);
  if (files.length) {
    e.preventDefault();
    deliverFiles(files);
    return;
  }
  // A pasted link (Ctrl+V / Cmd+V, not into a text field) → save it to the Link Vault
  if (!state.user || isTyping(e.target) || document.querySelector('dialog[open]')) return;
  const url = parseUrl(e.clipboardData?.getData('text/uri-list') || e.clipboardData?.getData('text/plain'));
  if (!url) return;
  e.preventDefault();
  const r = route();
  openAddLink({ url, characterIds: r.view === 'c' ? [r.arg] : [], folderId: null }); // pasted links go to Unsorted
});
const dropOverlay = h('div.drop-overlay', h('div', h('p', 'Drop images to add them')));
document.body.append(dropOverlay);
let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (hasFiles(e) && state.user) { dragDepth++; dropOverlay.classList.add('show'); } });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dropOverlay.classList.remove('show'); } });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  dragDepth = 0; dropOverlay.classList.remove('show');
  if (!hasFiles(e)) return;
  e.preventDefault();
  deliverFiles([...e.dataTransfer.files]);
});

// ---------------- keyboard shortcuts ----------------
document.addEventListener('keydown', (e) => {
  if (!state.user || document.querySelector('dialog[open]')) return;
  if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  const r = route();
  const inLinks = contextOf(r.view) === 'links';
  if (e.key === '/') { if (['characters', 'links'].includes(r.view)) { e.preventDefault(); openSearch(r.view, render); } }
  else if (e.key === 'n') { e.preventDefault(); if (inLinks) openAddLink(); else openNewCharacter(); }
  else if (e.key === 'r') { e.preventDefault(); goRandom(); }
  else if (e.key === 't') { e.preventDefault(); go(inLinks ? '#/vault-tags' : '#/tags'); }
  else if (e.key === 'h') { e.preventDefault(); go(homeHash()); } // "home" = the section you used last
  else if (e.key === 'Escape') {
    if (['c', 'compare'].includes(r.view)) go('#/characters');
    else if (r.view === 'l') go(state.lastVaultHash || '#/links');
    else if (r.view === 'links' && state.vaultSelect) { state.vaultSelect = null; render(); }
    else if (r.view === 'links' && parentHref(scopeFromArg(r.arg))) go(parentHref(scopeFromArg(r.arg)));
    else if (TAG_VIEWS.includes(r.view)) go(backTarget(r).href);
  }
});

// ---------------- "?add=<link>" (iOS Shortcut / Android share) ----------------
// Kept in localStorage so it survives the login (the magic link may open a new tab).
const PENDING_ADD = 'cb-pending-add';
const PENDING_MAX_AGE = 30 * 60 * 1000;

function stashPendingAdd(text) {
  const url = parseUrl(text);
  if (!url) { toast('That doesn’t look like a link.', { type: 'error' }); return; }
  try { localStorage.setItem(PENDING_ADD, JSON.stringify({ url, at: Date.now() })); } catch { pendingFallback = url; }
}
let pendingFallback = null;
function peekPendingAdd() {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_ADD) || 'null');
    if (p && Date.now() - p.at < PENDING_MAX_AGE) return p.url;
  } catch {}
  return pendingFallback;
}
function takePendingAdd() {
  const url = peekPendingAdd();
  try { localStorage.removeItem(PENDING_ADD); } catch {}
  pendingFallback = null;
  return url;
}

// ---------------- boot ----------------
async function loadData() {
  const links = loadLinks(); // independent: a missing Link Vault table must never break the character board
  try {
    const [characters, tags, groups] = await Promise.all([api.listCharacters(), api.listTags(), api.listGroups()]);
    state.characters = characters;
    state.tagList = tags.map((t) => ({ id: t.id, name: t.name, group_id: t.group_id ?? null }));
    state.groups = groups;
    state.loaded = true;
  } catch (e) {
    errorToast(e);
    if (needsMigration(e)) {
      toast('The database needs an update — run the SQL files in supabase/migrations (see README).', { type: 'error', timeout: 0 });
    }
  }
  await links;
}

const needsMigration = (e) => /relation .* does not exist|schema cache|column .* does not exist|could not find the table/i.test(e?.message || '');

async function loadLinks() {
  try {
    const [links, folders, vaultTags] = await Promise.all([api.listLinks(), api.listFolders(), api.listVaultTags()]);
    state.links = links;
    state.folders = folders;
    state.vaultTags = vaultTags.map((t) => ({ id: t.id, name: t.name }));
    state.linksReady = true;
  } catch (e) {
    console.error(e);
    state.links = []; state.folders = []; state.vaultTags = [];
    state.linksReady = false;
    if (!needsMigration(e)) errorToast(e);
  }
}

/** Images shared from another app (Android Share → Characters), waiting in the service worker's cache. */
async function pickUpShared() {
  const files = await takeSharedFiles();
  if (files.length) openImageChooser(files);
}

function pickUpPendingLink() {
  const url = takePendingAdd();
  if (!url) return;
  if (route().view !== 'links') location.hash = '#/links';
  setTimeout(() => openAddLink({ url, folderId: null }), 0); // iOS Shortcut / share → Unsorted unless you pick a folder
}

async function onUser(user) {
  const changed = user?.id !== state.user?.id;
  state.user = user;
  if (!changed) return;
  if (user) {
    app.replaceChildren(h('div.loading', h('div.spinner'), 'Loading your stash…'));
    await loadData();
    lastRoute = '';
    app.replaceChildren(); // force header/view re-mount
  } else {
    state.characters = []; state.tagList = []; state.groups = []; state.tags.clear();
    state.links = []; state.linksReady = null; state.linkFilter.tags.clear();
    state.folders = []; state.vaultTags = []; state.vaultSelect = null;
  }
  render();
  if (user && state.loaded) {
    pickUpShared();
    pickUpPendingLink();
    fillPendingPreviews(render);
  }
}

async function boot() {
  if (import.meta.env.DEV || import.meta.env.VITE_ALLOW_MOCK === '1') {
    // development only — stripped from the production build (VITE_ALLOW_MOCK is only for local testing of a build)
    let mock = new URLSearchParams(location.search).has('mock');
    try { if (mock) sessionStorage.setItem('cb-mock', '1'); else mock = sessionStorage.getItem('cb-mock') === '1'; } catch {}
    if (mock) setApi((await import('./mock.js')).mockApi);
  }
  const params = new URLSearchParams(location.search);
  const cleanParams = (...names) => {
    names.forEach((n) => params.delete(n));
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
  };
  // "?add=<link>" comes from the iOS Shortcut "Save to Vault" (or an Android share of a link)
  if (params.has('add')) {
    stashPendingAdd(params.get('add'));
    cleanParams('add');
  }
  // "?shared=…" is where the service worker sends you after an Android share
  if (params.has('shared')) {
    const how = params.get('shared');
    cleanParams('shared');
    if (how === '0') toast('Nothing to add — the share didn’t contain an image or a link.');
    if (how === 'error') toast('Couldn’t receive the shared image. Try again, or paste it instead.', { type: 'error' });
  }
  api.onAuthChange((u) => {
    // Clean "?code=…" left by the magic-link redirect once it has been used
    if (params.has('code')) history.replaceState(null, '', location.pathname + location.hash);
    // don't await Supabase calls inside its own auth callback (can deadlock)
    setTimeout(() => onUser(u), 0);
  });
  await onUser(await api.getUser());
  if (!state.user) render();
}

boot();

// ---------------- PWA ----------------
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
}
