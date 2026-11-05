import { h, icon, modal, toast, errorToast } from '../ui.js';
import { api, state, linkTitle, saveLinkTags, saveLinkCharacters } from '../state.js';
import { parseUrl, cleanUrl, platformOf, platformLabel, domainOf, findDuplicates, youtubeInfo, youtubeThumb } from '../links.js';
import { tagInput } from './tag-input.js';
import { charPicker } from './char-picker.js';
import { lookUpPreview } from '../previews.js';
import { setLinkCover } from './link-cover.js';
import { pasteButton } from '../paste.js';
import { pickFiles } from '../upload.js';
import { isImageFile } from '../compress.js';
import { go, rerender, setPasteTarget, getPasteTarget } from '../nav.js';
import { placeholder } from './link-card.js';

let isOpen = false;

/** Read a link from the clipboard (async Clipboard API). Resolves to a URL, '' (no link) or null (not allowed). */
export async function readClipboardLink() {
  if (!navigator.clipboard?.readText) return null;
  try {
    return parseUrl(await navigator.clipboard.readText()) || '';
  } catch { return null; }
}

/** "Paste link" button: reads the clipboard, opens the Add dialog pre-filled. */
export function pasteLinkButton({ label = 'Paste link' } = {}) {
  return h('button.btn.paste-btn', {
    type: 'button', title: 'Save the link on your clipboard',
    onclick: async () => {
      const url = await readClipboardLink();
      if (url) openAddLink({ url });
      else if (url === '') toast('No link on the clipboard — copy a link first (Share → Copy link), then try again.', { timeout: 6000 });
      else openAddLink({ hint: 'The browser didn’t allow reading the clipboard. Long-press the field below and tap Paste.' });
    },
  }, icon('paste'), label);
}

/**
 * The "Add link" dialog.
 * opts: { url, characterIds, hint }
 */
export function openAddLink({ url = '', characterIds = [], hint = '' } = {}) {
  if (isOpen) return;
  if (state.linksReady === false) {
    toast('The Link Vault needs a database update first — run supabase/migrations/20261104_02_link_vault.sql (see README).', { type: 'error', timeout: 8000 });
    return;
  }
  isOpen = true;
  const prevPaste = getPasteTarget();

  let preview = null;          // last lookup result for `current`
  let current = '';            // the URL the preview/duplicate info is for
  let titleTouched = false;
  let coverFile = null, coverUrl = null;
  let lookup = 0;

  const urlInput = h('input', {
    type: 'url', inputmode: 'url', required: true, placeholder: 'https://…', autocomplete: 'off',
    autocapitalize: 'off', spellcheck: false, enterkeyhint: 'next', value: url, 'aria-label': 'Link',
  });
  const pasteUrl = h('button.btn.paste-btn', {
    type: 'button', title: 'Paste the link on your clipboard',
    onclick: async () => {
      const u = await readClipboardLink();
      if (u) { urlInput.value = u; onUrl(true); }
      else if (u === '') toast('No link on the clipboard.');
      else { urlInput.focus(); toast('Long-press the field and tap Paste.'); }
    },
  }, icon('paste'), 'Paste');
  const urlError = h('p.field-error', { role: 'alert', hidden: true });
  const dup = h('div.similar.strong', { hidden: true, role: 'status' });
  const title = h('input', { maxlength: 300, placeholder: 'Found automatically — or type your own', autocomplete: 'off' });
  title.addEventListener('input', () => { titleTouched = !!title.value.trim(); drawCard(); });
  const notes = h('textarea', { rows: 3, placeholder: 'Why you saved it, what to look for…' });
  const tags = tagInput();
  const chars = charPicker(characterIds);
  const statusTodo = h('input', { type: 'radio', name: 'link-status', value: 'todo', checked: true });
  const statusDone = h('input', { type: 'radio', name: 'link-status', value: 'done' });
  const fav = h('input', { type: 'checkbox' });

  // ----- preview card -----
  const card = h('div.add-preview', { hidden: true, 'aria-live': 'polite' });
  const cardStatus = h('p.add-preview-status.muted.small');
  const coverButtons = h('div.row.add-cover-btns',
    h('button.btn.small-btn', { type: 'button', onclick: () => pickFiles(setCoverFile) }, icon('image'), 'Choose image'),
    pasteButton(setCoverFile, { label: 'Paste image', cls: '.small-btn' }));
  function setCoverFile(files) {
    const f = [...files].find(isImageFile);
    if (!f) { toast('That isn’t an image.'); return; }
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    coverFile = f; coverUrl = URL.createObjectURL(f);
    drawCard();
  }

  function draft() {
    const u = current || parseUrl(urlInput.value) || '';
    return {
      url: u, platform: platformOf(u), title: title.value.trim() || preview?.title || '',
      thumbnail_url: preview?.image || null,
    };
  }

  function drawCard() {
    const d = draft();
    if (!d.url) { card.hidden = true; return; }
    card.hidden = false;
    let media;
    const yt = d.platform === 'youtube' && youtubeInfo(d.url);
    const src = coverUrl || (yt ? youtubeThumb(yt.id) : d.thumbnail_url);
    if (src) {
      const img = h('img', { alt: '', referrerpolicy: 'no-referrer' });
      img.onerror = () => img.replaceWith(placeholder(d, { size: 'mini' }));
      img.src = src;
      media = img;
    } else media = placeholder(d, { size: 'mini' });
    const noPicture = !src;
    card.replaceChildren(
      h('div.add-preview-media', media),
      h('div.add-preview-text',
        h('span.lrow-meta', `${platformLabel(d.platform)} · ${domainOf(d.url)}`),
        h('span.add-preview-title', linkTitle(d)),
        cardStatus,
        noPicture || coverFile ? coverButtons : null,
        coverFile ? h('button.btn.small-btn', { type: 'button', onclick: () => { URL.revokeObjectURL(coverUrl); coverFile = coverUrl = null; drawCard(); } }, 'Remove thumbnail') : null));
  }

  function drawDuplicates() {
    const u = current;
    const dups = u ? findDuplicates(u, state.links) : [];
    dup.hidden = !dups.length;
    submit.textContent = dups.length ? 'Save anyway' : 'Save';
    if (!dups.length) { dup.replaceChildren(); return; }
    dup.replaceChildren(
      h('p.similar-title', icon('alert'), dups.length === 1 ? 'Already in your vault' : `Already saved ${dups.length} times`),
      h('ul.similar-list', dups.map((l) => h('li',
        h('span.char-pick-text',
          h('span.char-pick-name', linkTitle(l)),
          h('span.char-pick-source', `${platformLabel(l.platform)} · saved ${new Date(l.created_at).toLocaleDateString()}`),
          h('span.similar-why', l.status === 'done' ? 'Done' : 'To watch')),
        h('button.btn', { type: 'button', onclick: () => { dlg.close(); go(`#/l/${l.id}`); } }, 'Open it')))),
      h('p.similar-hint.muted.small', 'Same address once tracking bits (utm_, si, igsh…) are ignored. Press “Save anyway” to keep a second copy.'));
  }

  async function onUrl(immediate = false) {
    urlError.hidden = true;
    const u = parseUrl(urlInput.value);
    if (!u) { current = ''; preview = null; drawCard(); drawDuplicates(); return; }
    if (u === current) return;
    current = u;
    preview = null;
    drawDuplicates();
    drawCard();
    const mine = ++lookup;
    cardStatus.textContent = 'Looking up a preview…';
    if (!immediate) await new Promise((r) => setTimeout(r, 350));
    if (mine !== lookup) return;
    const r = await lookUpPreview(u);
    if (mine !== lookup) return;
    preview = r;
    if (r?.title && !titleTouched) title.value = r.title;
    const yt = platformOf(u) === 'youtube';
    cardStatus.textContent = !r ? 'No preview right now — you can still save it.'
      : r.image || yt ? '' : 'No preview picture for this link. You can set your own thumbnail:';
    drawCard();
  }
  let urlTimer;
  urlInput.addEventListener('input', () => { clearTimeout(urlTimer); urlTimer = setTimeout(() => onUrl(), 250); });
  urlInput.addEventListener('paste', () => setTimeout(() => onUrl(true), 0));

  const submit = h('button.btn.primary', { type: 'submit' }, 'Save');
  const form = h('form.dialog-body.add-link', {
    onsubmit: async (e) => {
      e.preventDefault();
      const u = parseUrl(urlInput.value);
      if (!u) { urlError.textContent = 'Please enter a link starting with http:// or https://'; urlError.hidden = false; urlInput.focus(); return; }
      if (u !== current) await onUrl(true);
      submit.disabled = true;
      try {
        const platform = platformOf(u);
        const p = preview;
        const l = await api.createLink({
          url: cleanUrl(u),
          title: title.value.trim().slice(0, 300) || p?.title || '',
          description: p?.description || '',
          site_name: p?.site_name || '',
          platform,
          thumbnail_url: platform === 'youtube' ? null : p?.image || null,
          notes: notes.value,
          status: statusDone.checked ? 'done' : 'todo',
          is_favorite: fav.checked,
          preview_status: p ? p.status : 'pending',
          preview_fetched_at: p ? new Date().toISOString() : null,
        });
        state.links.unshift(l);
        const after = [];
        after.push(saveLinkTags(l, tags.value()).catch(errorToast));
        after.push(saveLinkCharacters(l, chars.value()).catch(errorToast));
        const file = coverFile;
        dlg.close();
        await Promise.all(after);
        if (file) await setLinkCover(l, file);
        toast('Saved to the Link Vault', { type: 'ok', timeout: 2000 });
        if (location.hash.startsWith('#/links')) rerender();
        else go(`#/l/${l.id}`);
      } catch (err) { errorToast(err); submit.disabled = false; }
    },
  },
    h('p.eyebrow', 'Link Vault'),
    h('h2', 'Add link'),
    hint ? h('p.notice', { role: 'status' }, hint) : null,
    h('div.field',
      h('span', 'Link'),
      h('div.url-row', urlInput, pasteUrl),
      urlError),
    dup,
    card,
    h('label.field', h('span', 'Title'), title),
    h('label.field', h('span', 'Notes ', h('em.optional', 'optional')), notes),
    h('label.field', h('span', 'Tags'), tags.el),
    h('label.field', h('span', 'Characters ', h('em.optional', 'optional')), chars.el),
    h('div.row.add-link-flags',
      h('fieldset.segmented', h('legend.sr-only', 'Status'),
        h('label', statusTodo, h('span', 'To watch')),
        h('label', statusDone, h('span', 'Done'))),
      h('label.check', fav, h('span', icon('star'), 'Favorite'))),
    h('div.row.end',
      h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'),
      submit),
  );

  const dlg = modal(form, {
    cls: 'add-link-modal',
    onClose: () => {
      isOpen = false;
      lookup++;
      setPasteTarget(prevPaste);
      if (coverUrl) setTimeout(() => URL.revokeObjectURL(coverUrl), 1000);
    },
  });
  setPasteTarget(setCoverFile); // a pasted image becomes the thumbnail
  if (url) { onUrl(true); submit.focus(); } else urlInput.focus();
}
