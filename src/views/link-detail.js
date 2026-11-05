import { h, icon, errorToast, toast, confirmDialog, modal } from '../ui.js';
import {
  api, state, findLink, findChar, coverOf, tagsOf, tagNamesOf, patchLink, saveLinkTags, saveLinkCharacters, duplicatesOf,
} from '../state.js';
import { detectPlatform, normalizeUrl, youtubeEmbed, youtubeStart, PLATFORMS, domainOf } from '../linkutil.js';
import { linkMedia, linkTitle, linkCover, loadLinkImages, placeholder } from '../linkmedia.js';
import { embedFor, hasEmbed } from '../embeds.js';
import { queuePreview } from '../previews.js';
import { compressImage, isImageFile } from '../compress.js';
import { pickFiles } from '../upload.js';
import { pasteButton } from '../paste.js';
import { loadThumbs } from '../thumbs.js';
import { tagInput } from './tag-input.js';
import { charPicker } from './char-picker.js';
import { statusToggle } from './add-link.js';
import { metaLine } from './vault.js';
import { go, rerender, setPasteTarget } from '../nav.js';

let editing = null; // id of the link being edited
export function resetLinkEditing() { editing = null; }
export function isEditingLink() { return editing != null; }

export function renderLinkDetail(root, id) {
  const l = findLink(id);
  if (!l) {
    root.replaceChildren(h('div.empty', h('h2', state.linksReady ? 'Link not found' : 'Link Vault not set up'), h('a.btn', { href: '#/links' }, 'Back to the vault')));
    return;
  }
  setPasteTarget((files) => setThumbnail(l, files)); // pasting an image here sets the cover

  const stage = h('section.link-stage', stageFor(l));
  const info = h('section.detail-info', editing === l.id ? editForm(l) : infoView(l));
  root.replaceChildren(h('article.detail.link-detail', stage, info));
  loadLinkImages(root);
  loadThumbs(info);
}

/** The big area: YouTube player, the official X/Instagram/Reddit embed, or the cover. */
function stageFor(l) {
  const p = detectPlatform(l.url);
  if (p.platform === 'youtube' && p.id) {
    return h(`div.player${p.kind === 'short' ? '.vertical' : ''}`,
      h('iframe', {
        src: youtubeEmbed(p.id, youtubeStart(l.url)),
        title: linkTitle(l),
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin',
        loading: 'lazy',
      }));
  }
  const cover = h('a.stage-cover', { href: l.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Open ${linkTitle(l)}` },
    linkCover(l) ? linkMedia(l, { cls: 'large' }) : h('div.link-media.large.is-ph', placeholder(l)));
  return hasEmbed(l) ? embedFor(l, cover) : cover;
}

function infoView(l) {
  const p = PLATFORMS[l.platform] || PLATFORMS.web;
  const chars = (l.character_ids || []).map(findChar).filter(Boolean);
  const custom = !!(l.image_path || l.image_thumb_path);
  const noPreview = !linkCover(l);
  return h('div.info',
    h('div.info-head',
      h('div.info-title',
        h('p.link-eyebrow', metaLine(l)),
        h('h1', linkTitle(l))),
      h('div.row',
        h(`button.icon-btn.star-btn${l.is_favorite ? '.on' : ''}`, {
          title: l.is_favorite ? 'Remove from favorites' : 'Add to favorites',
          'aria-label': l.is_favorite ? 'Remove from favorites' : 'Add to favorites',
          'aria-pressed': String(!!l.is_favorite),
          onclick: () => patchLink(l, { is_favorite: !l.is_favorite }, rerender).catch(errorToast),
        }, icon('star')),
        h('button.btn', { onclick: () => { editing = l.id; rerender(); } }, 'Edit'))),
    h('div.link-actions',
      statusToggle(() => l.status, (s) => patchLink(l, { status: s }, rerender).catch(errorToast)),
      h('a.btn.primary.open-btn', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, p.verb, icon('external'))),
    tagsOf(l).length
      ? h('div.chips.inline', tagsOf(l).map((t) => h('a.chip', {
          href: '#/links', onclick: () => { state.vault.tags.clear(); state.vault.tags.add(t.id); state.vault.search = ''; },
        }, t.name)))
      : null,
    l.description?.trim() ? h('p.link-desc', l.description) : null,
    h('h4.label', 'Notes'),
    l.notes?.trim() ? h('div.notes', l.notes) : h('p.muted', 'No notes yet.'),
    h('h4.label', 'Characters'),
    chars.length
      ? h('ul.rows.compact-rows', chars.map((c) => {
          const cover = coverOf(c);
          return h('li.row-item', h('a.row-thumb', { href: `#/c/${c.id}`, tabindex: '-1', 'aria-hidden': 'true' },
              cover ? h('img', { alt: '', 'data-path': cover.thumb_path || cover.path }) : null),
            h('a.row-text', { href: `#/c/${c.id}` }, h('span.row-name', c.name), c.source ? h('span.row-sub', c.source) : null));
        }))
      : h('p.muted', 'Not linked to a character. Use Edit to add some.'),
    h('h4.label', 'Thumbnail'),
    h('div.thumb-tools',
      noPreview ? h('p.muted.small', l.preview_status ? 'No preview available for this link.' : 'Looking for a preview…') : null,
      h('div.row',
        h('button.btn', { onclick: () => openThumbnailDialog(l) }, icon('image'), custom ? 'Change thumbnail' : 'Set thumbnail'),
        custom ? h('button.btn', { onclick: () => removeThumbnail(l) }, 'Use automatic') : null,
        !custom && l.platform !== 'youtube' && l.preview_status !== 'ok'
          ? h('button.btn', { onclick: () => retryPreview(l) }, 'Try preview again')
          : null)),
    h('p.muted.small.added', `Saved ${new Date(l.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · `,
      h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, domainOf(l.url))),
    h('div.danger-zone',
      h('button.btn.danger.ghost', { onclick: () => removeLink(l) }, 'Delete link')),
  );
}

function editForm(l) {
  const url = h('input', { type: 'url', inputmode: 'url', value: l.url, required: true, maxlength: 2048, autocapitalize: 'off', spellcheck: false });
  const urlNote = h('p.field-error', { role: 'alert', hidden: true });
  const title = h('input', { value: l.title || '', maxlength: 500, placeholder: domainOf(l.url) });
  const desc = h('textarea', { rows: 3, maxlength: 2000 });
  desc.value = l.description || '';
  let status = l.status;
  const tags = tagInput(tagNamesOf(l));
  const chars = charPicker(l.character_ids || []);
  const notes = h('textarea', { rows: 6, placeholder: 'Why you saved it, timestamps…' });
  notes.value = l.notes || '';
  const save = h('button.btn.primary', { type: 'submit' }, 'Save');
  url.addEventListener('input', () => {
    const n = normalizeUrl(url.value);
    const d = n ? duplicatesOf(n.key, l.id) : [];
    urlNote.hidden = !(!n || d.length);
    urlNote.textContent = !n ? 'Please enter a web link (https://…).' : `This link is already saved${d[0] ? ` as “${linkTitle(d[0])}”` : ''}.`;
  });

  return h('form.info.stack', {
    onsubmit: async (e) => {
      e.preventDefault();
      const n = normalizeUrl(url.value);
      if (!n) { url.focus(); return; }
      save.disabled = true;
      try {
        const patch = { title: title.value.trim(), description: desc.value.trim(), notes: notes.value, status };
        const moved = n.url !== l.url;
        if (moved) Object.assign(patch, { url: n.url, url_key: n.key, platform: n.platform, thumbnail_url: null, preview_status: null, preview_fetched_at: null, site_name: '' });
        Object.assign(l, await api.updateLink(l.id, patch), { tag_ids: l.tag_ids, character_ids: l.character_ids });
        await saveLinkTags(l, tags.value());
        await saveLinkCharacters(l, chars.value());
        editing = null;
        toast('Saved', { type: 'ok', timeout: 1500 });
        rerender();
        if (moved) queuePreview(l, { force: true });
      } catch (err) { errorToast(err); save.disabled = false; }
    },
    onkeydown: (e) => { if (e.key === 'Escape') { e.preventDefault(); editing = null; rerender(); } },
  },
    h('label.field', h('span', 'Link'), url), urlNote,
    h('label.field', h('span', 'Title'), title),
    h('label.field', h('span', 'Description ', h('em.optional', 'optional')), desc),
    h('div.field', h('span', 'Status'), statusToggle(() => status, (s) => { status = s; })),
    h('label.field', h('span', 'Tags'), tags.el),
    h('label.field', h('span', 'Characters'), chars.el),
    h('label.field', h('span', 'Notes'), notes),
    h('div.row.end',
      h('button.btn', { type: 'button', onclick: () => { editing = null; rerender(); } }, 'Cancel'),
      save),
  );
}

// ---------------- thumbnail ----------------

function openThumbnailDialog(l) {
  const done = (files) => { dlg.close(); setThumbnail(l, files); };
  const drop = h('button.dropzone', { type: 'button', onclick: () => pickFiles(done) },
    h('span', h('strong', 'Choose an image'), h('br'), h('span.muted.small', 'From your photos or files — or drop / paste it')));
  const dlg = modal(h('div.dialog-body',
    h('p.eyebrow', linkTitle(l)),
    h('h2', 'Set thumbnail'),
    h('p.muted', 'Shown on the card instead of the automatic preview. It’s shrunk before uploading, like character images.'),
    drop,
    h('div.row.paste-row', pasteButton(done)),
    h('div.row.end', h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'))));
  const prev = () => setPasteTarget((files) => setThumbnail(l, files));
  setPasteTarget(done);
  dlg.addEventListener('close', prev);
}

async function setThumbnail(l, files) {
  const file = [...files].find(isImageFile);
  if (!file) { toast('That isn’t an image.'); return; }
  const t = toast('Uploading thumbnail…', { timeout: 0 });
  const old = [l.image_path, l.image_thumb_path];
  try {
    const img = await compressImage(file);
    const fields = await api.uploadLinkImage(state.user.id, l.id, img);
    try {
      Object.assign(l, await api.updateLink(l.id, fields), { tag_ids: l.tag_ids, character_ids: l.character_ids });
    } catch (e) { await api.removeFiles([fields.image_path, fields.image_thumb_path]); throw e; }
    api.removeFiles(old).catch(console.error);
    t.close();
    toast('Thumbnail set', { type: 'ok', timeout: 1500 });
    rerender();
  } catch (e) { t.close(); errorToast(e); }
}

async function removeThumbnail(l) {
  const old = [l.image_path, l.image_thumb_path];
  try {
    Object.assign(l, await api.updateLink(l.id, { image_path: null, image_thumb_path: null, image_width: null, image_height: null }),
      { tag_ids: l.tag_ids, character_ids: l.character_ids });
    api.removeFiles(old).catch(console.error);
    rerender();
  } catch (e) { errorToast(e); }
}

async function retryPreview(l) {
  const t = toast('Looking for a preview…', { timeout: 0 });
  const res = await queuePreview(l, { force: true });
  t.close();
  toast(res && linkCover(res) ? 'Preview found' : 'Still no preview — you can set a thumbnail yourself.', { timeout: 3000 });
  rerender();
}

async function removeLink(l) {
  if (!(await confirmDialog(`Delete “${linkTitle(l)}”?`, 'It is removed from your vault (and from any characters). This can’t be undone.'))) return;
  try {
    await api.deleteLink(l);
    state.links = state.links.filter((x) => x.id !== l.id);
    toast('Link deleted', { type: 'ok' });
    go('#/links');
  } catch (e) { errorToast(e); }
}
