import { h, icon, errorToast, toast, confirmDialog, prettyUrl, safeHref } from '../ui.js';
import { api, state, findChar, coverOf, toggleFavorite, tagsOf, tagNamesOf, saveCharacterTags, allSources, linksOf } from '../state.js';
import { miniLinkList } from './link-card.js';
import { openAddLink } from './add-link.js';
import { loadThumbs } from '../thumbs.js';
import { pasteButton } from '../paste.js';
import { tagInput } from './tag-input.js';
import { openLightbox } from './lightbox.js';
import { addImages, pickFiles } from '../upload.js';
import { go, rerender, setPasteTarget } from '../nav.js';

let editing = null; // id of the character currently in edit mode

export function renderDetail(root, id) {
  const c = findChar(id);
  if (!c) {
    root.replaceChildren(h('div.empty', h('h2', 'Character not found'), h('a.btn', { href: '#/characters' }, 'Back to board')));
    return;
  }
  const upload = (files) => addImages(c, files, () => rerender());
  setPasteTarget(upload);

  const cover = coverOf(c);
  const gallery = h('div.gallery',
    c.images.map((im, idx) => h(`figure.thumb${im === cover ? '.is-cover' : ''}`, { 'data-id': im.id },
      h('button.thumb-open', { 'aria-label': `Open image ${idx + 1}`, onclick: () => openLightbox(c.images, idx) },
        h('img', { alt: '', loading: 'lazy', 'data-path': im.thumb_path || im.path, style: `aspect-ratio:${im.width}/${im.height}` })),
      im === cover && c.images.length > 1 ? h('span.cover-badge', 'Cover') : null,
      h('div.thumb-actions',
        im !== cover ? h('button.icon-btn.small', { title: 'Use as cover', 'aria-label': 'Use as cover image', onclick: () => setCover(c, im) }, icon('cover')) : null,
        h('button.icon-btn.small.danger', { title: 'Delete image', 'aria-label': 'Delete image', onclick: () => removeImage(c, im) }, icon('trash'))),
    )),
    h('div.thumb-add-wrap',
      h('button.dropzone.thumb-add', { onclick: () => pickFiles(upload) },
        h('span', h('strong', 'Add images'), h('br'), h('span.muted.small', 'Drop, paste or tap'))),
      pasteButton(upload)),
  );
  loadGalleryUrls(gallery);

  const info = editing === c.id ? editForm(c) : infoView(c);

  root.replaceChildren(h('article.detail', h('section.detail-gallery', gallery), h('section.detail-info', info)));
}

function infoView(c) {
  const links = (c.links || []).map((l) => [l, safeHref(l)]).filter(([, href]) => href);
  return h('div.info',
    h('div.info-head',
      h('div.info-title',
        h('h1', c.name),
        c.source ? h('p.source', c.source) : null),
      h('div.row',
        h(`button.icon-btn.star-btn${c.is_favorite ? '.on' : ''}`, {
          title: c.is_favorite ? 'Remove from favorites' : 'Add to favorites',
          'aria-label': c.is_favorite ? 'Remove from favorites' : 'Add to favorites',
          'aria-pressed': String(!!c.is_favorite),
          onclick: () => toggleFavorite(c, rerender).catch(errorToast),
        }, icon('star')),
        h('button.btn', { onclick: () => { editing = c.id; rerender(); } }, 'Edit'),
      )),
    tagsOf(c).length
      ? h('div.chips.inline', tagsOf(c).map((t) => h('a.chip', { href: '#/characters', onclick: () => { state.tags.clear(); state.tags.add(t.id); state.search = ''; } }, t.name)))
      : null,
    h('h4.label', 'Notes'),
    c.notes?.trim() ? h('div.notes', c.notes) : h('p.muted', 'No notes yet.'),
    h('h4.label', 'Sources'),
    links.length
      ? h('ul.links', links.map(([l, href]) => h('li', h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, icon('link'), prettyUrl(href)))))
      : h('p.muted', 'No source links yet.'),
    state.linksReady ? linkedLinks(c) : null,
    h('div.danger-zone',
      h('button.btn.danger.ghost', { onclick: () => removeCharacter(c) }, 'Delete character')),
  );
}

/** Links from the Link Vault connected to this character. */
function linkedLinks(c) {
  const list = linksOf(c);
  const el = h('div.char-links',
    h('div.char-links-head',
      h('h4.label', 'Link Vault'),
      h('button.btn.small-btn', { type: 'button', onclick: () => openAddLink({ characterIds: [c.id] }) }, icon('plus'), 'Add link')),
    list.length ? miniLinkList(list) : h('p.muted', 'No saved links for this character yet.'));
  setTimeout(() => loadThumbs(el));
  return el;
}

function editForm(c) {
  const name = h('input', { value: c.name, required: true, maxlength: 200 });
  const source = h('input', { value: c.source || '', maxlength: 200, placeholder: 'e.g. Original, a game or anime', autocomplete: 'off', list: 'sources-edit' });
  const sourcesList = h('datalist', { id: 'sources-edit' }, allSources().map((s) => h('option', { value: s })));
  const tags = tagInput(tagNamesOf(c));
  const notes = h('textarea', { rows: 8, placeholder: 'Personality, backstory, palette ideas…' });
  notes.value = c.notes || '';
  const links = h('textarea', { rows: 4, placeholder: 'One link per line\nhttps://…', autocapitalize: 'off', spellcheck: false });
  links.value = (c.links || []).join('\n');
  const save = h('button.btn.primary', { type: 'submit' }, 'Save');

  return h('form.info.stack', {
    onsubmit: async (e) => {
      e.preventDefault();
      save.disabled = true;
      try {
        const patch = {
          name: name.value.trim(),
          source: source.value.trim(),
          notes: notes.value,
          links: links.value.split(/\s*\n\s*/).map((s) => s.trim()).filter(Boolean),
        };
        Object.assign(c, await api.updateCharacter(c.id, patch), { images: c.images, tag_ids: c.tag_ids });
        await saveCharacterTags(c, tags.value());
        editing = null;
        toast('Saved', { type: 'ok', timeout: 1500 });
        rerender();
      } catch (err) { errorToast(err); save.disabled = false; }
    },
    onkeydown: (e) => { if (e.key === 'Escape') { e.preventDefault(); editing = null; rerender(); } },
  },
    h('label.field', h('span', 'Name'), name),
    h('label.field', h('span', 'Source ', h('em.optional', 'optional')), source, sourcesList),
    h('label.field', h('span', 'Tags'), tags.el),
    h('label.field', h('span', 'Notes'), notes),
    h('label.field', h('span', 'Source links'), links),
    h('div.row.end',
      h('button.btn', { type: 'button', onclick: () => { editing = null; rerender(); } }, 'Cancel'),
      save),
  );
}

async function setCover(c, im) {
  const before = c.cover_image_id;
  c.cover_image_id = im.id;
  rerender();
  try {
    await api.updateCharacter(c.id, { cover_image_id: im.id });
    toast('Cover updated', { type: 'ok', timeout: 1500 });
  } catch (e) { c.cover_image_id = before; rerender(); errorToast(e); }
}

async function removeImage(c, im) {
  if (!(await confirmDialog('Delete this image?', 'It will be permanently removed from storage.'))) return;
  try {
    await api.deleteImage(im);
    c.images = c.images.filter((x) => x.id !== im.id);
    if (c.cover_image_id === im.id) c.cover_image_id = null; // database does the same (on delete set null)
    rerender();
  } catch (e) { errorToast(e); }
}

async function removeCharacter(c) {
  const n = c.images.length;
  const ok = await confirmDialog(`Delete “${c.name}”?`,
    `This permanently deletes the character${n ? ` and its ${n} image${n > 1 ? 's' : ''}` : ''}. This can't be undone.`);
  if (!ok) return;
  try {
    await api.deleteCharacter(c);
    state.characters = state.characters.filter((x) => x.id !== c.id);
    toast(`Deleted ${c.name}`, { type: 'ok' });
    go('#/characters');
  } catch (e) { errorToast(e); }
}

async function loadGalleryUrls(container) {
  const imgs = [...container.querySelectorAll('img[data-path]')];
  try {
    const urls = await api.getUrls(imgs.map((i) => i.dataset.path));
    for (const img of imgs) {
      const u = urls[img.dataset.path];
      if (u) { img.onload = () => img.classList.add('loaded'); img.src = u; }
    }
  } catch (e) { console.error(e); }
}

export function resetEditing() { editing = null; }
