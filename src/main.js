import './style.css';
import { h, icon, errorToast, toast } from './ui.js';
import { api, setApi, state, randomCharacter, randomLink } from './state.js';
import { toggleTheme, currentTheme } from './theme.js';
import { setRerender, setPasteTarget, getPasteTarget, go } from './nav.js';
import { filesFromPaste } from './upload.js';
import { parseUrl } from './links.js';
import { SECTIONS, sectionOf } from './sections.js';
import { renderLogin } from './views/login.js';
import { renderHome } from './views/home.js';
import { renderGrid, filterBar } from './views/grid.js';
import { renderDetail, resetEditing } from './views/detail.js';
import { openNewCharacter } from './views/new-character.js';
import { renderCompare } from './views/compare.js';
import { renderTags } from './views/tags.js';
import { openImageChooser } from './views/image-chooser.js';
import { renderVault, vaultMasthead } from './views/vault.js';
import { renderLinkDetail, resetLinkEditing } from './views/link-detail.js';
import { openAddLink, pasteLinkButton } from './views/add-link.js';
import { renderNotes, notesMasthead, openNoteEditor } from './views/notes.js';
import { fillPendingPreviews } from './previews.js';
import { pasteButton } from './paste.js';
import { takeSharedFiles } from './share.js';
import { exportZip } from './export.js';

const app = document.getElementById('app');
let lastRoute = '';

function route() {
  const [, view = '', arg = ''] = location.hash.match(/^#\/?([^/]*)\/?(.*)$/) || [];
  return { view, arg: decodeURIComponent(arg) };
}

// ---------------- header ----------------

/** Thin top bar on every page: home, the section switcher, theme + menu. */
function hubBar(r, sec) {
  return h('header.hubbar',
    h('div.hubbar-inner',
      h(`a.hub-home${r.view === '' ? '.on' : ''}`, { href: '#/', 'aria-label': 'Home', title: 'Home (H)', 'aria-current': r.view === '' ? 'page' : null },
        icon('home'), h('span.hub-home-label', 'Stash')),
      h('nav.switcher', { 'aria-label': 'Sections' },
        SECTIONS.map((s) => h(`a.switch${sec?.id === s.id ? '.on' : ''}`, {
          href: s.href, 'aria-current': sec?.id === s.id ? 'page' : null,
        }, h('span.switch-long', s.title), h('span.switch-short', { 'aria-hidden': 'true' }, s.short)))),
      h('div.utility',
        h('button.icon-btn', { onclick: () => { toggleTheme(); render(); }, title: 'Toggle light/dark mode', 'aria-label': 'Toggle light/dark mode' },
          icon(currentTheme() === 'dark' ? 'sun' : 'moon')),
        menuButton())));
}

function tagsLink(r) {
  return h(`a.btn.tags-link${r.view === 'tags' ? '.on' : ''}`, { href: '#/tags', title: 'Manage tags and tag groups (T)', 'aria-current': r.view === 'tags' ? 'page' : null }, 'Tags');
}

function characterActions(r) {
  const onGrid = r.view === 'characters';
  return h('div.actions',
    tagsLink(r),
    h('button.btn.random-btn', { onclick: goRandom, title: 'Random inspiration (R) — respects your filters' }, 'Random'),
    onGrid && state.characters.length
      ? h(`button.btn.compare-btn${state.compareMode ? '.on' : ''}`, {
          'aria-pressed': String(state.compareMode),
          title: 'Pick 2–3 characters to view side by side',
          onclick: () => { state.compareMode = !state.compareMode; state.compareSel = []; render(); },
        }, 'Compare')
      : null,
    onGrid ? pasteButton((files) => openImageChooser(files), { label: 'Paste' }) : null,
    h('button.btn.primary.new-btn', { onclick: () => openNewCharacter(), title: 'New character (N)' }, 'Add character'));
}

function linkActions(r) {
  return h('div.actions',
    tagsLink(r),
    pasteLinkButton(),
    h('button.btn.primary.new-btn', { onclick: () => openAddLink(), title: 'Add a link (N)' }, 'Add link'));
}

/** The section's own header under the hub bar. */
function sectionHeader(r, sec) {
  if (r.view === '') return null; // the home page draws its own title
  if (r.view === 'characters') {
    const searchInput = h('input#search', {
      type: 'search', placeholder: 'Name or source', value: state.search,
      oninput: (e) => { state.search = e.target.value; renderView(); },
    });
    const n = state.characters.length;
    return h('header.masthead',
      h('div.masthead-row',
        h('div.titleblock',
          h('p.eyebrow', `Collection · ${n} ${n === 1 ? 'entry' : 'entries'}`),
          h('h1.title', 'Characters', h('span.title-dot', '.'))),
        characterActions(r)),
      filterBar(searchInput, render));
  }
  if (r.view === 'links') return vaultMasthead(linkActions(r), render, renderView);
  if (r.view === 'notes') return notesMasthead(render, renderView);
  // detail pages, compare, tags: a back link + the section's actions
  const back = sec || SECTIONS[0];
  return h('header.topbar',
    h('a.back', { href: back.href }, icon('back'), h('span', back.title)),
    back.id === 'links' ? linkActions(r) : characterActions(r));
}

function header(r) {
  const sec = sectionOf(r.view);
  return h('div.chrome', hubBar(r, sec), sectionHeader(r, sec));
}

function menuButton() {
  const menu = h('div.menu', { hidden: true },
    h('div.menu-email.muted.small', state.user?.email || ''),
    h('button.menu-item', { onclick: () => exportZip() }, icon('download'), 'Download backup (ZIP)'),
    h('button.menu-item', { onclick: async () => { await api.signOut(); } }, icon('logout'), 'Sign out'),
  );
  const btn = h('button.icon-btn', { 'aria-label': 'More', 'aria-haspopup': 'true', onclick: (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    if (!menu.hidden) setTimeout(() => document.addEventListener('click', () => (menu.hidden = true), { once: true }));
  } }, icon('menu'));
  return h('div.menu-wrap', btn, menu);
}

function goRandom() {
  const r = route();
  if (sectionOf(r.view)?.id === 'links' && r.view !== 'tags') {
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
let headerEl = h('div');

const ROUTES = {
  '': (root) => renderHome(root),
  characters: (root) => renderGrid(root, render), // full render so the header's filters/Compare stay in sync
  c: (root, arg) => renderDetail(root, arg),
  compare: (root, arg) => renderCompare(root, arg),
  tags: (root) => renderTags(root),
  links: (root) => renderVault(root, render),
  l: (root, arg) => renderLinkDetail(root, arg),
  notes: (root) => renderNotes(root, render),
};

function renderView() {
  const r = route();
  const known = r.view in ROUTES;
  viewEl.className = 'view-' + (known ? (r.view === 'characters' ? 'grid' : r.view || 'home') : 'home');
  setPasteTarget(null);
  (ROUTES[r.view] || ROUTES[''])(viewEl, r.arg);
}

function render() {
  if (!state.user) { renderLogin(app, { pendingUrl: peekPendingAdd() }); return; }
  const r = route();
  const key = r.view + '/' + r.arg;
  if (key !== lastRoute) {
    resetEditing();
    resetLinkEditing();
    if (r.view !== 'characters') { state.compareMode = false; state.compareSel = []; }
    const sec = sectionOf(r.view);
    if (sec && r.view !== 'tags' && sec.id !== 'notes') state.lastSection = sec.id; // notes have no tags
    lastRoute = key;
    window.scrollTo(0, 0);
  }
  const newHeader = header(r);
  // keep the search box focused while typing
  const hadFocus = document.activeElement?.id === 'search';
  if (!app.contains(viewEl)) app.replaceChildren(headerEl, viewEl);
  headerEl.replaceWith(newHeader);
  headerEl = newHeader;
  renderView();
  if (hadFocus) newHeader.querySelector('#search')?.focus();
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
  openAddLink({ url, characterIds: r.view === 'c' ? [r.arg] : [] });
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
  const inLinks = sectionOf(r.view)?.id === 'links' && r.view !== 'tags';
  if (e.key === '/') { const s = document.getElementById('search'); if (s) { e.preventDefault(); s.focus(); } }
  else if (e.key === 'n') {
    e.preventDefault();
    if (r.view === 'notes') { if (state.notesReady) openNoteEditor(null, render); }
    else if (inLinks) openAddLink(); else openNewCharacter();
  }
  else if (e.key === 'r') { e.preventDefault(); goRandom(); }
  else if (e.key === 't') { e.preventDefault(); go('#/tags'); }
  else if (e.key === 'h') { e.preventDefault(); go('#/'); }
  else if (e.key === 'Escape') {
    if (['c', 'compare'].includes(r.view)) go('#/characters');
    else if (r.view === 'l') go('#/links');
    else if (r.view === 'tags') go(sectionOf('tags').href);
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
  // independent: a missing Link Vault / Notes table must never break the character board
  const links = loadLinks();
  const notes = loadNotes();
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
  await Promise.all([links, notes]);
}

const needsMigration = (e) => /relation .* does not exist|schema cache|column .* does not exist|could not find the table/i.test(e?.message || '');

async function loadLinks() {
  try {
    state.links = await api.listLinks();
    state.linksReady = true;
  } catch (e) {
    console.error(e);
    state.links = [];
    state.linksReady = false;
    if (!needsMigration(e)) errorToast(e);
  }
}

async function loadNotes() {
  try {
    state.notes = await api.listNotes();
    state.notesReady = true;
  } catch (e) {
    console.error(e);
    state.notes = [];
    state.notesReady = false;
    if (!needsMigration(e)) errorToast(e);
  }
}

/**
 * Links and notes saved from the iPhone Shortcuts while the app was in the
 * background: when you come back to the app, fetch just the new ones and add
 * them (existing items are never replaced, so nothing you're editing is lost).
 */
let lastRefresh = Date.now();
async function refreshFromShortcuts() {
  if (!state.user || !state.loaded || Date.now() - lastRefresh < 20_000) return;
  lastRefresh = Date.now();
  let added = 0;
  const merge = (list, fresh) => {
    const have = new Set(list.map((x) => x.id));
    const extra = fresh.filter((x) => !have.has(x.id));
    added += extra.length;
    return extra;
  };
  try {
    if (state.linksReady) { const extra = merge(state.links, await api.listLinks()); if (extra.length) state.links = [...extra, ...state.links]; }
    if (state.notesReady) { const extra = merge(state.notes, await api.listNotes()); if (extra.length) state.notes = [...extra, ...state.notes]; }
  } catch (e) { console.warn('Refresh failed:', e); return; }
  if (!added) return;
  // never re-render over a form you're typing in
  if (!document.querySelector('.detail-info form, dialog[open], .note-compose textarea:focus') && !(document.activeElement?.value)) render();
  fillPendingPreviews(render);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshFromShortcuts(); });

/** Images shared from another app (Android Share → Characters), waiting in the service worker's cache. */
async function pickUpShared() {
  const files = await takeSharedFiles();
  if (files.length) openImageChooser(files);
}

function pickUpPendingLink() {
  const url = takePendingAdd();
  if (!url) return;
  if (route().view !== 'links') location.hash = '#/links';
  setTimeout(() => openAddLink({ url }), 0);
}

async function onUser(user) {
  const changed = user?.id !== state.user?.id;
  state.user = user;
  if (!changed) return;
  if (user) {
    app.replaceChildren(h('div.loading', h('div.spinner'), 'Loading your hub…'));
    await loadData();
    lastRoute = '';
    app.replaceChildren(); // force header/view re-mount
  } else {
    state.characters = []; state.tagList = []; state.groups = []; state.tags.clear();
    state.links = []; state.linksReady = null; state.linkFilter.tags.clear();
    state.notes = []; state.notesReady = null; state.noteSearch = '';
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
