// Tiny DOM helpers — no framework needed.

/** h('div.card#x', {onclick, ...attrs}, ...children) */
export function h(tag, props = {}, ...children) {
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) {
    children.unshift(props);
    props = {};
  }
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(name || 'div');
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'html') el.innerHTML = v; // only ever used with static strings (icons)
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// ---------- icons (inline SVG, static strings) ----------
const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="16" r="1.3" fill="currentColor"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  cover: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/><path d="m8 11 2-2 2 2 3-3 3 3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  merge: '<path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.2 2.9L4 22"/><path d="m20 22-5-5"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.5"/>',
  alert: '<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v4M12 17.5v.5"/>',
  home: '<path d="M3 11 12 3l9 8"/><path d="M5 9.5V21h14V9.5"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5"/><rect x="13.5" y="3" width="7.5" height="7.5"/><rect x="3" y="13.5" width="7.5" height="7.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke-width="3"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  done: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
  // simple, generic platform glyphs (not the companies' logos)
  youtube: '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9v6l5-3z" fill="currentColor"/>',
  x: '<path d="M4 4l16 16M20 4 4 20"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.3 6.7h.01" stroke-width="2.5"/>',
  reddit: '<path d="M4 18.5V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8z"/><path d="M9 10h.01M15 10h.01" stroke-width="2.5"/><path d="M9.5 12.8c1.4 1 3.6 1 5 0"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.6 5.7 3.6 9s-1.1 6.3-3.6 9c-2.5-2.7-3.6-5.7-3.6-9S9.5 5.7 12 3z"/>',
};
export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = 'icon ' + cls;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name]}</svg>`;
  return span;
}

// ---------- toast ----------
let toastHost;
export function toast(msg, { type = 'info', timeout = 3500 } = {}) {
  toastHost ||= document.body.appendChild(h('div.toasts', { 'aria-live': 'polite' }));
  const t = h(`div.toast.${type}`, msg);
  toastHost.append(t);
  const remove = () => t.remove();
  if (timeout) setTimeout(remove, timeout);
  return { el: t, update: (m) => (t.textContent = m), close: remove };
}

export function errorToast(e) {
  console.error(e);
  toast(e?.message || String(e), { type: 'error', timeout: 6000 });
}

// ---------- modal dialogs ----------
export function modal(content, { onClose, cls = '' } = {}) {
  const dlg = h(`dialog.modal${cls ? '.' + cls : ''}`, content);
  document.body.append(dlg);
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // backdrop click
  dlg.showModal();
  return dlg;
}

export function confirmDialog(title, message, { okText = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const dlg = modal(
      h('form.dialog-body', { method: 'dialog' },
        h('h2', title),
        h('p.muted', message),
        h('div.row.end',
          h('button.btn', { value: 'cancel', type: 'submit' }, 'Cancel'),
          h(`button.btn${danger ? '.danger' : '.primary'}`, { value: 'ok', type: 'submit', onclick: () => (result = true) }, okText),
        ),
      ),
      { onClose: () => resolve(result) },
    );
    dlg.querySelector('.btn.danger, .btn.primary').focus();
  });
}

/** Ask for one line of text. Resolves to the trimmed text, or null if cancelled. */
export function promptDialog(title, { label = 'Name', value = '', okText = 'Save', placeholder = '', maxlength = 60, extra = null, validate } = {}) {
  return new Promise((resolve) => {
    let result = null;
    const input = h('input', { value, placeholder, maxlength, required: true, autocomplete: 'off', enterkeyhint: 'done' });
    const err = h('p.field-error', { role: 'alert', hidden: true });
    const dlg = modal(
      h('form.dialog-body', {
        method: 'dialog',
        onsubmit: (e) => {
          const v = input.value.trim();
          const problem = !v ? 'Please enter a name.' : validate?.(v);
          if (problem) { e.preventDefault(); err.textContent = problem; err.hidden = false; input.focus(); return; }
          result = v;
        },
      },
        h('h2', title),
        h('label.field', h('span', label), input),
        err,
        extra,
        h('div.row.end',
          h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'),
          h('button.btn.primary', { type: 'submit' }, okText)),
      ),
      { onClose: () => resolve(result) },
    );
    input.focus();
    input.select();
  });
}

export function prettyUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname.replace(/^www\./, '') + (url.pathname.length > 1 ? url.pathname : '');
  } catch { return u; }
}

export function safeHref(u) {
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(u) ? u : 'https://' + u);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
