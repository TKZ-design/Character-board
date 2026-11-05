import { h, icon, modal, toast, errorToast } from '../ui.js';
import { api, state, duplicatesOf, saveLinkTags, saveLinkCharacters } from '../state.js';
import { normalizeUrl, extractUrl, domainOf, platformLabel, detectPlatform } from '../linkutil.js';
import { tagInput } from './tag-input.js';
import { charPicker } from './char-picker.js';
import { linkMedia, linkTitle, loadLinkImages } from '../linkmedia.js';
import { queuePreview } from '../previews.js';
import { go, rerender } from '../nav.js';

let openDlg = null;

const KIND = { video: 'video', short: 'Short', post: 'post', reel: 'Reel' };

/** Read a link from the clipboard (iOS shows a small "Paste" bubble to confirm). Resolves to text or null. */
export async function readClipboardText() {
  if (!navigator.clipboard?.readText) return null;
  try { return await navigator.clipboard.readText(); } catch { return null; }
}

/** "Paste link" button: clipboard → Add link dialog (or the dialog with an empty field to paste into). */
export function pasteLinkButton({ label = 'Paste link', cls = '', characterIds } = {}) {
  return h(`button.btn.paste-btn${cls}`, {
    type: 'button', title: 'Save the link on your clipboard',
    onclick: async () => {
      const text = await readClipboardText();
      const url = extractUrl(text);
      if (url) openAddLink({ url, characterIds });
      else openAddLink({ characterIds, notice: text == null
        ? 'The browser didn’t let the app read the clipboard. Tap the field below and choose Paste.'
        : 'There’s no link on the clipboard. Copy a link first, or paste/type it below.' });
    },
  }, icon('paste'), label);
}

/**
 * The "Add link" dialog. `url` pre-fills the field (from the clipboard, Ctrl+V or ?add=…).
 * `characterIds` pre-selects characters (when opened from a character's page).
 */
export function openAddLink({ url = '', characterIds = [], notice = null, after } = {}) {
  if (openDlg) { // already open: just update the field
    const f = openDlg.querySelector('input[name="url"]');
    if (f && url) { f.value = url; f.dispatchEvent(new Event('input')); }
    return;
  }
  if (!state.linksReady) {
    toast('The Link Vault needs a database update — run supabase/migrations/20261105_01_link_vault.sql (see README).', { type: 'error', timeout: 9000 });
    return;
  }
  const urlInput = h('input', {
    name: 'url', type: 'url', inputmode: 'url', required: true, value: url, placeholder: 'https://…',
    autocapitalize: 'off', autocorrect: 'off', spellcheck: false, autocomplete: 'off', enterkeyhint: 'next', maxlength: 2048,
  });
  const detected = h('p.link-detected.muted.small', { 'aria-live': 'polite' });
  const dup = h('div.similar.strong', { hidden: true, role: 'status' });
  const err = h('p.field-error', { role: 'alert', hidden: true });
  const title = h('input', { maxlength: 500, placeholder: 'Leave empty to use the page’s own title', autocomplete: 'off' });
  let status = 'todo';
  const statusButtons = statusToggle(() => status, (s) => { status = s; });
  const tags = tagInput();
  const chars = charPicker(characterIds);
  const notes = h('textarea', { rows: 3, placeholder: 'Why you saved it, timestamps…' });
  const submit = h('button.btn.primary', { type: 'submit' }, 'Save');

  let norm = null;
  function check() {
    const raw = urlInput.value.trim();
    norm = normalizeUrl(extractUrl(raw) || raw);
    err.hidden = true;
    if (!norm) {
      detected.replaceChildren(raw ? 'Not a web link yet — it should start with https://' : '');
      dup.hidden = true; submit.textContent = 'Save';
      return;
    }
    const p = detectPlatform(norm.url);
    detected.replaceChildren(icon(norm.platform), h('span',
      norm.platform === 'web' ? domainOf(norm.url) : `${platformLabel(norm.platform)}${p.kind ? ' ' + KIND[p.kind] : ''} · ${domainOf(norm.url)}`));
    const same = duplicatesOf(norm.key);
    dup.hidden = !same.length;
    submit.textContent = same.length ? 'Save anyway' : 'Save';
    if (same.length) {
      dup.replaceChildren(
        h('p.similar-title', icon('alert'), same.length === 1 ? 'Already in your vault' : `Already saved ${same.length} times`),
        h('ul.similar-list', same.slice(0, 3).map((l) => h('li',
          h('span.dup-thumb', linkMedia(l, { compact: true })),
          h('span.char-pick-text',
            h('span.char-pick-name', linkTitle(l)),
            h('span.similar-why', `Saved ${new Date(l.created_at).toLocaleDateString()}`)),
          h('button.btn', { type: 'button', onclick: () => { dlg.close(); go(`#/l/${l.id}`); } }, 'Open it')))),
        h('p.similar-hint.muted.small', 'Tracking bits like ?utm_… or ?si=… are ignored when comparing.'));
      loadLinkImages(dup);
    }
  }
  urlInput.addEventListener('input', check);

  const form = h('form.dialog-body.add-link', {
    onsubmit: async (e) => {
      e.preventDefault();
      check();
      if (!norm) { err.textContent = 'Please enter a web link (https://…).'; err.hidden = false; urlInput.focus(); return; }
      submit.disabled = true;
      try {
        const l = await api.createLink({
          url: norm.url, url_key: norm.key, platform: norm.platform,
          title: title.value.trim(), notes: notes.value, status,
        });
        state.links.unshift(l);
        try {
          await saveLinkTags(l, tags.value());
          await saveLinkCharacters(l, chars.value());
        } catch (e2) { errorToast(e2); }
        dlg.close();
        toast('Saved to your vault', { type: 'ok', timeout: 2000 });
        // stay on a character's page when adding from there; otherwise show the vault
        if (after) after(l); else if (!/^#\/c\//.test(location.hash)) go('#/links');
        rerender();
        queuePreview(l); // look up the thumbnail & title in the background
      } catch (e2) { errorToast(e2); submit.disabled = false; }
    },
  },
    h('p.eyebrow', 'Link Vault'),
    h('h2', 'Add link'),
    notice ? h('p.notice', { role: 'status' }, notice) : null,
    h('label.field', h('span', 'Link'), urlInput),
    detected,
    dup,
    err,
    h('label.field', h('span', 'Title ', h('em.optional', 'optional')), title),
    h('div.field', h('span', 'Status'), statusButtons),
    h('label.field', h('span', 'Tags'), tags.el),
    h('label.field', h('span', 'Characters ', h('em.optional', 'optional')), chars.el),
    h('label.field', h('span', 'Notes ', h('em.optional', 'optional')), notes),
    h('div.row.end',
      h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'),
      submit),
  );

  const dlg = modal(form, { onClose: () => { openDlg = null; } });
  openDlg = dlg;
  check();
  // on phones don't pop the keyboard over a pre-filled link
  if (!url) urlInput.focus(); else submit.focus();
}

/** Two-button "To watch / Done" switch. */
export function statusToggle(get, set) {
  const wrap = h('div.segmented', { role: 'group', 'aria-label': 'Status' });
  const draw = () => wrap.replaceChildren(...[['todo', 'To watch'], ['done', 'Done']].map(([v, label]) =>
    h(`button.seg${get() === v ? '.on' : ''}`, { type: 'button', 'aria-pressed': String(get() === v), onclick: () => { set(v); draw(); } }, label)));
  draw();
  return wrap;
}
