import './style.css';
import { h, icon, errorToast, toast } from './ui.js';
import { api, setApi, state, randomCharacter } from './state.js';
import { toggleTheme, currentTheme } from './theme.js';
import { setRerender, setPasteTarget, getPasteTarget, go } from './nav.js';
import { filesFromPaste } from './upload.js';
import { renderLogin } from './views/login.js';
import { renderGrid, filterBar } from './views/grid.js';
import { renderDetail, resetEditing } from './views/detail.js';
import { openNewCharacter } from './views/new-character.js';
import { renderCompare } from './views/compare.js';
import { exportZip } from './export.js';

const app = document.getElementById('app');
let lastRoute = '';

function route() {
  const [, view = '', arg = ''] = location.hash.match(/^#\/?([^/]*)\/?(.*)$/) || [];
  return { view, arg: decodeURIComponent(arg) };
}

// ---------------- header ----------------
function header(r) {
  const searchInput = h('input#search', {
    type: 'search', placeholder: 'By name', value: state.search,
    oninput: (e) => { state.search = e.target.value; renderView(); },
  });
  const onGrid = r.view === '';
  const actions = h('div.actions',
    h('button.btn.random-btn', { onclick: goRandom, title: 'Random inspiration (R) — respects your filters' }, 'Random'),
    onGrid && state.characters.length
      ? h(`button.btn.compare-btn${state.compareMode ? '.on' : ''}`, {
          'aria-pressed': String(state.compareMode),
          title: 'Pick 2–3 characters to view side by side',
          onclick: () => { state.compareMode = !state.compareMode; state.compareSel = []; render(); },
        }, 'Compare')
      : null,
    h('button.btn.primary.new-btn', { onclick: () => openNewCharacter(), title: 'New character (N)' }, 'Add character'),
    h('div.utility',
      h('button.icon-btn', { onclick: () => { toggleTheme(); render(); }, title: 'Toggle light/dark mode', 'aria-label': 'Toggle light/dark mode' },
        icon(currentTheme() === 'dark' ? 'sun' : 'moon')),
      menuButton()),
  );
  if (!onGrid) {
    return h('header.topbar',
      h('a.back', { href: '#/' }, icon('back'), h('span', 'Collection')),
      actions);
  }
  const n = state.characters.length;
  return h('header.masthead',
    h('div.masthead-row',
      h('div.titleblock',
        h('p.eyebrow', `Collection · ${n} ${n === 1 ? 'entry' : 'entries'}`),
        h('h1.title', 'Characters', h('span.title-dot', '.'))),
      actions),
    filterBar(searchInput, render),
  );
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
  viewEl.className = 'view-' + (r.view || 'grid');
  setPasteTarget(null);
  if (r.view === 'c') renderDetail(viewEl, r.arg);
  else if (r.view === 'compare') renderCompare(viewEl, r.arg);
  else renderGrid(viewEl, render); // full render so the header's filters/Compare stay in sync
}

function render() {
  if (!state.user) { renderLogin(app); return; }
  const r = route();
  const key = r.view + '/' + r.arg;
  if (key !== lastRoute) {
    resetEditing();
    if (r.view !== '') { state.compareMode = false; state.compareSel = []; }
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
function deliverFiles(files) {
  if (!state.user || !files.length) return;
  const target = getPasteTarget();
  if (target) target(files);
  else openNewCharacter(files); // on the board: start a new character with them
}
document.addEventListener('paste', (e) => {
  const files = filesFromPaste(e);
  if (!files.length) return; // let normal text paste work
  e.preventDefault();
  deliverFiles(files);
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
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/' ) { const s = document.getElementById('search'); if (s) { e.preventDefault(); s.focus(); } }
  else if (e.key === 'n') { e.preventDefault(); openNewCharacter(); }
  else if (e.key === 'r') { e.preventDefault(); goRandom(); }
  else if (e.key === 'Escape' && route().view) go('#/');
});

// ---------------- boot ----------------
async function loadData() {
  try {
    state.characters = await api.listCharacters();
    state.loaded = true;
  } catch (e) {
    errorToast(e);
    if (/relation .* does not exist|schema cache/i.test(e.message || '')) {
      toast('Database tables are missing — run supabase/setup.sql (see README).', { type: 'error', timeout: 0 });
    }
  }
}

async function onUser(user) {
  const changed = user?.id !== state.user?.id;
  state.user = user;
  if (!changed) return;
  if (user) {
    app.replaceChildren(h('div.loading', h('div.spinner'), 'Loading your board…'));
    await loadData();
    lastRoute = '';
    app.replaceChildren(); // force header/view re-mount
  } else {
    state.characters = [];
  }
  render();
}

async function boot() {
  if (import.meta.env.DEV) {
    // development only — stripped from the production build
    if (new URLSearchParams(location.search).has('mock')) setApi((await import('./mock.js')).mockApi);
  }
  // Clean "?code=…" left by the magic-link redirect once it has been used
  const params = new URLSearchParams(location.search);
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
