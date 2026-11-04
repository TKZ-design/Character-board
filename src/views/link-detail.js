import { h, icon, toast, errorToast, confirmDialog, safeHref } from '../ui.js';
import {
  api, state, findLink, findChar, coverOf, linkTitle, tagsOf, tagNamesOf, saveLinkTags, saveLinkCharacters, patchLink, clearLinkFilters,
} from '../state.js';
import { platformLabel, domainOf, parseUrl, cleanUrl, platformOf, findDuplicates } from '../links.js';
import { tagInput } from './tag-input.js';
import { charPicker } from './char-picker.js';
import { linkMedia } from './link-card.js';
import { embedFor, embedNote } from './embeds.js';
import { setLinkCover, removeLinkCover } from './link-cover.js';
import { lookUpPreview, previewPatch, previewsUnavailable } from '../previews.js';
import { pasteButton } from '../paste.js';
import { pickFiles } from '../upload.js';
import { go, rerender, setPasteTarget } from '../nav.js';
import { loadThumbs } from '../thumbs.js';

let editing = null; // id of the link being edited
export function resetLinkEditing() { editing = null; }

export function renderLinkDetail(root, id) {
  const l = findLink(id);
  if (!l) {
    root.replaceChildren(h('div.empty',
      h('h2', state.linksReady === null ? 'Loading…' : 'Link not found'),
      h('a.btn', { href: '#/links' }, 'Back to the Link Vault')));
    return;
  }
  const setCover = async (files) => { const f = files[0]; if (f && await setLinkCover(l, f)) rerender(); };
  setPasteTarget(setCover); // paste an image on this page → it becomes the thumbnail

  const title = linkTitle(l);
  const embed = embedFor(l, title);
  const href = safeHref(l.url);
  const hasCustom = !!(l.cover_path || l.cover_thumb_path);

  const media = h('div.link-hero',
    embed || h('a.link-hero-cover', { href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Open ${title}` }, linkMedia(l, { size: 'hero' })),
    embed ? h('p.embed-note.muted.small', embedNote(l.platform)) : null);

  const coverTools = h('div.cover-tools',
    h('h4.label', 'Thumbnail'),
    h('div.cover-tools-row',
      embed ? h('span.cover-tools-thumb', linkMedia(l, { size: 'row' })) : null,
      h('div.row.cover-tools-btns',
        h('button.btn.small-btn', { type: 'button', onclick: () => pickFiles(setCover) }, icon('image'), hasCustom ? 'Replace thumbnail' : 'Set thumbnail'),
        pasteButton(setCover, { label: 'Paste image', cls: '.small-btn' }),
        hasCustom ? h('button.btn.small-btn', { type: 'button', onclick: async () => { if (await removeLinkCover(l)) rerender(); } }, 'Use site preview') : null)),
    !hasCustom && !l.thumbnail_url && l.platform !== 'youtube'
      ? h('p.muted.small', 'No preview picture. Upload or paste one (a screenshot works well) to use as the cover.')
      : null);

  const info = editing === l.id ? editForm(l) : infoView(l);
  root.replaceChildren(h('article.detail.link-detail',
    h('section.detail-gallery', media, coverTools),
    h('section.detail-info', info)));
  loadThumbs(root);
}

function statusSwitch(l) {
  const opt = (value, label) => h(`button.seg-btn${l.status === value ? '.on' : ''}`, {
    type: 'button', 'aria-pressed': String(l.status === value),
    onclick: () => { if (l.status !== value) patchLink(l, { status: value }, rerender).catch(errorToast); },
  }, value === 'done' ? icon('check') : null, label);
  return h('div.segmented.seg-buttons', { role: 'group', 'aria-label': 'Status' }, opt('todo', 'To watch'), opt('done', 'Done'));
}

function infoView(l) {
  const href = safeHref(l.url);
  const chars = (l.character_ids || []).map(findChar).filter(Boolean);
  const site = l.site_name && l.site_name.toLowerCase() !== domainOf(l.url) ? ` · ${l.site_name}` : '';
  return h('div.info',
    h('div.info-head',
      h('div.info-title',
        h('h1', linkTitle(l)),
        h('p.source', `${platformLabel(l.platform)} · ${domainOf(l.url)}${site}`)),
      h('div.row',
        h(`button.icon-btn.star-btn${l.is_favorite ? '.on' : ''}`, {
          title: l.is_favorite ? 'Remove from favorites' : 'Add to favorites',
          'aria-label': l.is_favorite ? 'Remove from favorites' : 'Add to favorites',
          'aria-pressed': String(!!l.is_favorite),
          onclick: () => patchLink(l, { is_favorite: !l.is_favorite }, rerender).catch(errorToast),
        }, icon('star')),
        h('button.btn', { onclick: () => { editing = l.id; rerender(); } }, 'Edit'))),
    h('div.row.link-actions',
      href ? h('a.btn.primary', { href, target: '_blank', rel: 'noopener noreferrer' }, `Open on ${l.platform === 'web' ? domainOf(l.url) : platformLabel(l.platform)}`, icon('external')) : null,
      statusSwitch(l)),
    tagsOf(l).length
      ? h('div.chips.inline', tagsOf(l).map((t) => h('a.chip', {
          href: '#/links', onclick: () => { clearLinkFilters(); state.linkFilter.tags.add(t.id); },
        }, t.name)))
      : null,
    l.description?.trim() ? [h('h4.label', 'From the site'), h('div.notes.muted', l.description)] : null,
    h('h4.label', 'Notes'),
    l.notes?.trim() ? h('div.notes', l.notes) : h('p.muted', 'No notes yet.'),
    h('h4.label', 'Characters'),
    chars.length
      ? h('ul.similar-list.linked-chars', chars.map((c) => {
          const cover = coverOf(c);
          return h('li', h('a.linked-char', { href: `#/c/${c.id}` },
            h('span.char-pick-thumb', cover ? h('img', { alt: '', 'data-path': cover.thumb_path || cover.path }) : null),
            h('span.char-pick-text', h('span.char-pick-name', c.name), h('span.char-pick-source', c.source || '—'))));
        }))
      : h('p.muted', 'Not connected to any character. Use Edit to add some.'),
    h('h4.label', 'Address'),
    h('p.link-url', h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, l.url)),
    h('div.row.link-small-actions',
      h('button.btn.small-btn', { type: 'button', onclick: () => copy(l.url) }, icon('copy'), 'Copy link'),
      h('button.btn.small-btn', { type: 'button', onclick: () => refreshPreview(l) }, icon('refresh'), 'Fetch preview again')),
    h('p.muted.small', `Saved ${new Date(l.created_at).toLocaleDateString()}`),
    h('div.danger-zone',
      h('button.btn.danger.ghost', { onclick: () => removeLink(l) }, 'Delete link')),
  );
}

function editForm(l) {
  const url = h('input', { type: 'url', inputmode: 'url', value: l.url, required: true, autocapitalize: 'off', spellcheck: false, maxlength: 2048 });
  const title = h('input', { value: l.title || '', maxlength: 300, placeholder: 'Title' });
  const description = h('textarea', { rows: 3, maxlength: 2000 });
  description.value = l.description || '';
  const notes = h('textarea', { rows: 6, placeholder: 'Why you saved it, what to look for…' });
  notes.value = l.notes || '';
  const tags = tagInput(tagNamesOf(l));
  const chars = charPicker(l.character_ids || []);
  const err = h('p.field-error', { role: 'alert', hidden: true });
  const save = h('button.btn.primary', { type: 'submit' }, 'Save');

  return h('form.info.stack', {
    onsubmit: async (e) => {
      e.preventDefault();
      const u = parseUrl(url.value);
      if (!u) { err.textContent = 'Please enter a link starting with http:// or https://'; err.hidden = false; url.focus(); return; }
      const dups = findDuplicates(u, state.links, l.id);
      if (dups.length && cleanUrl(u) !== l.url) {
        const ok = await confirmDialog('Already in your vault', `“${linkTitle(dups[0])}” has the same address. Save this one anyway?`, { okText: 'Save anyway', danger: false });
        if (!ok) return;
      }
      save.disabled = true;
      try {
        const patch = { url: cleanUrl(u), title: title.value.trim(), description: description.value.trim(), notes: notes.value, platform: platformOf(u) };
        if (patch.url !== l.url) Object.assign(patch, { preview_status: 'pending', thumbnail_url: null, site_name: '' });
        Object.assign(l, await api.updateLink(l.id, patch), { tag_ids: l.tag_ids, character_ids: l.character_ids });
        await saveLinkTags(l, tags.value());
        await saveLinkCharacters(l, chars.value());
        editing = null;
        toast('Saved', { type: 'ok', timeout: 1500 });
        rerender();
        if (l.preview_status === 'pending') refreshPreview(l, { quiet: true });
      } catch (er) { errorToast(er); save.disabled = false; }
    },
    onkeydown: (e) => { if (e.key === 'Escape') { e.preventDefault(); editing = null; rerender(); } },
  },
    h('label.field', h('span', 'Link'), url), err,
    h('label.field', h('span', 'Title'), title),
    h('label.field', h('span', 'Description ', h('em.optional', 'from the site')), description),
    h('label.field', h('span', 'Notes'), notes),
    h('label.field', h('span', 'Tags'), tags.el),
    h('label.field', h('span', 'Characters'), chars.el),
    h('div.row.end',
      h('button.btn', { type: 'button', onclick: () => { editing = null; rerender(); } }, 'Cancel'),
      save));
}

async function refreshPreview(l, { quiet = false } = {}) {
  if (previewsUnavailable()) { if (!quiet) toast('Link previews are off — deploy the “link-preview” Edge Function (see README).'); return; }
  const t = quiet ? null : toast('Looking up preview…', { timeout: 0 });
  const r = await lookUpPreview(l.url);
  t?.close();
  if (!r) { if (!quiet) toast('Couldn’t get a preview right now. Try again later.', { type: 'error' }); return; }
  const patch = previewPatch({ ...l, title: '', description: '', site_name: '' }, r); // a manual refresh may replace the site's data…
  if (l.title?.trim()) delete patch.title;                                              // …but never your own title
  if (r.status === 'none') patch.thumbnail_url = null;
  try {
    Object.assign(l, patch, { updated_at: (await api.updateLink(l.id, patch)).updated_at });
    if (!quiet) toast(r.status === 'ok' ? 'Preview updated' : 'No preview available for this link', { timeout: 2200 });
    rerender();
  } catch (e) { errorToast(e); }
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Link copied', { type: 'ok', timeout: 1500 }); }
  catch { toast('Couldn’t copy — long-press the address instead.'); }
}

async function removeLink(l) {
  const ok = await confirmDialog(`Delete “${linkTitle(l)}”?`, 'This removes the link from your vault (connected characters stay). This can’t be undone.');
  if (!ok) return;
  try {
    await api.deleteLink(l);
    state.links = state.links.filter((x) => x.id !== l.id);
    toast('Link deleted', { type: 'ok' });
    go('#/links');
  } catch (e) { errorToast(e); }
}
