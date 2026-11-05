import './style.css';
import { h, icon, errorToast, toast } from './ui.js';
import { api, setApi, state, randomCharacter, findLink } from './state.js';
import { toggleTheme, currentTheme } from './theme.js';
import { setRerender, setPasteTarget, getPasteTarget, go } from './nav.js';
import { filesFromPaste } from './upload.js';
import { renderLogin } from './views/login.js';
import { renderGrid, filterBar } from './views/grid.js';
import { renderDetail, resetEditing } from './views/detail.js';
import { openNewCharacter } from './views/new-character.js';
import { renderCompare } from './views/compare.js';
import { renderTags } from './views/tags.js';
import { renderHome } from './views/home.js';
import { renderVault, vaultFilterBar } from './views/vault.js';
import { renderLinkDetail, resetLinkEditing, isEditingLink } from './views/link-detail.js';
import { openAddLink, pasteLinkButton } from './views/add-link.js';
import { openImageChooser } from './views/image-chooser.js';
import { pasteButton } from './paste.js';
import { takeSharedFiles } from './share.js';
import { exportZip } from './export.js';
import { extractUrl } from './linkutil.js';
import { SECTIONS, sectionOf } from './sections.js';
import { onPreviewChange } from './previews.js';

const app = document.getElementById('app');
let lastRoute = '';

// Routes:  #/  home · #/characters  board · #/c/<id>  character · #/compare/<ids>
//          #/tags · #/links  Link Vault · #/l/<id>  link
function route() {
  const [, view = '', arg = ''] = location.hash.match(/^#\/?([^/]*)\/?(.*)$/) || [];
  return { view, arg: decodeURIComponent(arg) };
}

const isTyping = (el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable;

// ---------------- header ----------------

/** Top row on every page: section switcher on the left, theme + menu on the right. */
function hubBar(r) {
  const current = sectionOf(r.view);
  const item = (href, label, on, extra = {}) =>
    h(`a.switch-item${on ? '.on' : ''}`, { href, 'aria-current': on ? 'page' : null, ...extra }, label);
  return h('div.hub-bar',
    h('nav.switcher', { 'aria-label': 'Sections' },
      item('#/', [icon('home'), h('span.switch-home-label', 'Home')], r.view === '', { title: 'Home' }),
      SECTIONS.map((s) => item(s.href, s.title, current === s))),
    h('div.utility',
      h('button.icon-btn', { onclick: () => { toggleTheme(); render(); }, title: 'Toggle light/dark mode', 'aria-label': 'Toggle light/dark mode' },
        icon(currentTheme() === 'dark' ? 'sun' : 'moon')),
      menuButton()));
}

function searchBox(value, placeholder, onInput) {
  return h('input#search', { type: 'search', placeholder, value, oninput: (e) => { onInput(e.target.value); renderView(); } });
}

function header(r) {
  const section = sectionOf(r.view)?.id;
  const bar = hubBar(r);

  if (r.view === '') {
    return h('header.masthead.home-head', bar,
      h('div.masthead-row',
        h('div.titleblock',
          h('p.eyebrow', `Personal hub · ${state.user?.email?.split('@')[0] || 'you'}`),
          h('h1.title', 'Home', h('span.title-dot', '.')))));
  }

  if (r.view === 'links') {
    const n = state.links.length;
    return h('header.masthead', bar,
      h('div.masthead-row',
        h('div.titleblock',
          h('p.eyebrow', `Vault · ${n} ${n === 1 ? 'link' : 'links'}`),
          h('h1.title', 'Link Vault', h('span.title-dot', '.'))),
        h('div.actions',
          h('a.btn.tags-link', { href: '#/tags', title: 'Manage tags and tag groups (T)' }, 'Tags'),
          pasteLinkButton(),
          h('button.btn.primary.new-btn', { onclick: () => openAddLink(), title: 'Add link (N)' }, 'Add link'))),
      vaultFilterBar(searchBox(state.vault.search, 'Title, site or notes', (v) => { state.vault.search = v; }), render));
  }

  const onGrid = r.view === 'characters';
  const charActions = h('div.actions',
    h(`a.btn.tags-link${r.view === 'tags' ? '.on' : ''}`, { href: '#/tags', title: 'Manage tags and tag groups (T)', 'aria-current': r.view === 'tags' ? 'page' : null }, 'Tags'),
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

  if (onGrid) {
    const n = state.characters.length;
    return h('header.masthead', bar,
      h('div.masthead-row',
        h('div.titleblock',
          h('p.eyebrow', `Collection · ${n} ${n === 1 ? 'entry' : 'entries'}`),
          h('h1.title', 'Characters', h('span.title-dot', '.'))),
        charActions),
      filterBar(searchBox(state.search, 'Name or source', (v) => { state.search = v; }), render));
  }

  // detail pages: a back link + the section's actions
  const back = section === 'links'
    ? h('a.back', { href: '#/links' }, icon('back'), h('span', 'Link Vault'))
    : h('a.back', { href: '#/characters' }, icon('back'), h('span', 'Characters'));
  const actions = section === 'links'
    ? h('div.actions',
        pasteLinkButton(),
        h('button.btn.primary.new-btn', { onclick: () => openAddLink(), title: 'Add link (N)' }, 'Add link'))
    : charActions;
  return h('header.topbar-wrap', bar, h('div.topbar', back, actions));
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
  const current = route().view === 'c' ? route().arg : null;
  const c = randomCharacter(current);
  if (c) go(`#/c/${c.id}`);
  else toast(state.characters.length ? 'No characters match your filters' : 'Add some characters first!');
}

// ---------------- views ----------------
const viewEl = h('main#view');
let headerEl = h('header');

function renderView() {
  const r = route();
  viewEl.className = 'view-' + ({ '': 'home', characters: 'grid' }[r.view] ?? r.view);
  setPasteTarget(null);
  if (r.view === 'c') renderDetail(viewEl, r.arg);
  else if (r.view === 'compare') renderCompare(viewEl, r.arg);
  else if (r.view === 'tags') renderTags(viewEl);
  else if (r.view === 'characters') renderGrid(viewEl, render); // full render so the header's filters/Compare stay in sync
  else if (r.view === 'links') renderVault(viewEl, render);
  else if (r.view === 'l') renderLinkDetail(viewEl, r.arg);
  else renderHome(viewEl);
}

function render() {
  if (!state.user) { renderLogin(app, { pendingLink: !!readPendingAdd(false) }); return; }
  const r = route();
  const key = r.view + '/' + r.arg;
  if (key !== lastRoute) {
    resetEditing();
    resetLinkEditing();
    if (r.view !== 'characters') { state.compareMode = false; state.compareSel = []; }
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

// A preview arrived in the background: refresh pages that show it (never an open edit form)
let previewTimer;
onPreviewChange((l) => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const r = route();
    if (r.view === 'links' || r.view === '' || (r.view === 'l' && r.arg === l.id && !isEditingLink())
      || (r.view === 'c' && l.character_ids?.includes(r.arg))) render();
  }, 150);
});

// ---------------- paste & drop anywhere ----------------
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
  // A pasted link (Ctrl+V / Cmd+V) on the home page or in the vault opens "Add link"
  if (!state.user || isTyping(e.target) || document.querySelector('dialog[open]')) return; // let normal text paste work
  if (!['', 'links', 'l'].includes(route().view)) return;
  const url = extractUrl(e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text/uri-list'));
  if (url) { e.preventDefault(); openAddLink({ url }); }
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
  if (!hasFiles(e)) {
    // a link dragged in from another tab
    const url = state.user && extractUrl(e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain'));
    if (url && ['', 'links', 'l'].includes(route().view)) { e.preventDefault(); openAddLink({ url }); }
    return;
  }
  e.preventDefault();
  deliverFiles([...e.dataTransfer.files]);
});

// ---------------- keyboard shortcuts ----------------
document.addEventListener('keydown', (e) => {
  if (!state.user || document.querySelector('dialog[open]')) return;
  if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  const v = route().view;
  const inVault = v === 'links' || v === 'l';
  if (e.key === '/') { const s = document.getElementById('search'); if (s) { e.preventDefault(); s.focus(); } }
  else if (e.key === 'n') { e.preventDefault(); inVault ? openAddLink() : openNewCharacter(); }
  else if (e.key === 'r') { e.preventDefault(); goRandom(); }
  else if (e.key === 't') { e.preventDefault(); go('#/tags'); }
  else if (e.key === 'Escape' && v === 'l') go('#/links');
  else if (e.key === 'Escape' && ['c', 'compare', 'tags'].includes(v)) go('#/characters');
});

// ---------------- "?add=<link>" (iOS Shortcut / Share sheet) ----------------
// The link is kept in localStorage until you're logged in (the magic-link email
// may open a new tab), then the Add link dialog opens pre-filled.
const PENDING_KEY = 'cb-pending-add';
function savePendingAdd(text) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ text, at: Date.now() })); } catch { state.pendingAdd = text; }
}
function readPendingAdd(take = true) {
  let text = state.pendingAdd || null;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Date.now() - p.at < 60 * 60 * 1000) text = p.text; // forget after an hour
      if (take || Date.now() - p.at >= 60 * 60 * 1000) localStorage.removeItem(PENDING_KEY);
    }
  } catch { /* ignore */ }
  if (take) state.pendingAdd = null;
  return text;
}
function pickUpPendingAdd() {
  const text = readPendingAdd();
  if (text == null) return;
  if (location.hash !== '#/links') go('#/links');
  const url = extractUrl(text);
  setTimeout(() => openAddLink(url ? { url } : { notice: text ? 'That didn’t look like a link. Paste or type it below.' : null }), 0);
}

// ---------------- boot ----------------
async function loadData() {
  try {
    const [characters, tags, groups] = await Promise.all([api.listCharacters(), api.listTags(), api.listGroups()]);
    state.characters = characters;
    state.tagList = tags.map((t) => ({ id: t.id, name: t.name, group_id: t.group_id ?? null }));
    state.groups = groups;
    state.loaded = true;
  } catch (e) {
    errorToast(e);
    if (/relation .* does not exist|schema cache|column .* does not exist/i.test(e.message || '')) {
      toast('The database needs an update — run the SQL files in supabase/migrations (see README).', { type: 'error', timeout: 0 });
    }
  }
  // The Link Vault loads separately, so the character board keeps working before its migration is run
  try {
    state.links = await api.listLinks();
    state.linksReady = true;
  } catch (e) {
    console.warn('Link Vault not available:', e);
    state.links = [];
    state.linksReady = false;
  }
}

/** Images shared from another app (Android Share → Characters), waiting in the service worker's cache. */
async function pickUpShared() {
  const files = await takeSharedFiles();
  if (files.length) openImageChooser(files);
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
    state.links = []; state.linksReady = false; state.vault.tags.clear();
  }
  render();
  if (user && state.loaded) { pickUpShared(); pickUpPendingAdd(); }
}

async function boot() {
  if (import.meta.env.DEV || import.meta.env.VITE_ALLOW_MOCK === '1') {
    // development only — stripped from the production build (VITE_ALLOW_MOCK is only for local testing of a build)
    let mock = new URLSearchParams(location.search).has('mock');
    try { if (mock) sessionStorage.setItem('cb-mock', '1'); else mock = sessionStorage.getItem('cb-mock') === '1'; } catch {}
    if (mock) setApi((await import('./mock.js')).mockApi);
  }
  // Clean "?code=…" left by the magic-link redirect once it has been used
  const params = new URLSearchParams(location.search);
  // "?shared=…" is where the service worker sends you after an Android share
  if (params.has('shared')) {
    const how = params.get('shared');
    params.delete('shared');
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
    if (how === '0') toast('Nothing to add — the share didn’t contain an image or a link.');
    if (how === 'error') toast('Couldn’t receive the shared image. Try again, or paste it instead.', { type: 'error' });
  }
  // "?add=<link>" — from the iOS "Save to Vault" shortcut (or Android's share sheet)
  if (params.has('add')) {
    savePendingAdd(params.get('add') || '');
    params.delete('add');
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + (location.hash || '#/links'));
  }
  api.onAuthChange((u) => {
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

// (for debugging in the console)
if (import.meta.env.DEV) Object.assign(window, { __state: state, __findLink: findLink });
