import { h, icon, modal, errorToast } from '../ui.js';
import { api, state, coverOf, allSources, saveCharacterTags } from '../state.js';
import { tagInput } from './tag-input.js';
import { dropZone, pickFiles, addImages } from '../upload.js';
import { isImageFile } from '../compress.js';
import { duplicateInfo, acknowledge, whereText } from '../hash.js';
import { pasteButton } from '../paste.js';
import { findSimilar } from '../text.js';
import { go, setPasteTarget, getPasteTarget } from '../nav.js';
import { loadThumbs } from '../thumbs.js';

let open = false;
let addPending = null;

/** Opens the "New character" dialog (optionally pre-filled with images). */
export function openNewCharacter(initialFiles = []) {
  if (open) { addPending?.(initialFiles); return; }
  open = true;
  const pending = []; // { file, url, stored: [characters] }
  const previews = h('div.pending');
  const dupNote = h('p.dup-note', { hidden: true, role: 'status' });
  const prevPaste = getPasteTarget();

  addPending = async (files) => {
    for (const f of files.filter(isImageFile)) pending.push({ file: f, url: URL.createObjectURL(f), stored: [] });
    drawPreviews();
    const infos = await duplicateInfo(pending.map((p) => p.file));
    for (let i = infos.length - 1; i >= 0; i--) {
      if (infos[i].repeat) { URL.revokeObjectURL(pending[i].url); pending.splice(i, 1); infos.splice(i, 1); }
      else pending[i].stored = infos[i].stored;
    }
    drawPreviews();
  };
  function drawPreviews() {
    previews.replaceChildren(...pending.map((p, i) =>
      h(`div.pending-item${p.stored.length ? '.is-dup' : ''}`, h('img', { src: p.url, alt: '' }),
        p.stored.length ? h('span.dup-badge', 'Stored') : null,
        h('button.icon-btn.small', { type: 'button', 'aria-label': 'Remove image', onclick: () => { URL.revokeObjectURL(p.url); pending.splice(i, 1); drawPreviews(); } }, icon('close')))));
    const dups = pending.filter((p) => p.stored.length);
    dupNote.hidden = !dups.length;
    if (dups.length) {
      dupNote.replaceChildren(icon('alert'),
        h('span', dups.length === 1 ? 'An image marked “Stored” is already in ' : `${dups.length} images marked “Stored” are already in `,
          h('strong', whereText([...new Set(dups.flatMap((d) => d.stored))])),
          '. Remove it with × or it will be uploaded again.'));
    }
  }

  const name = h('input', { required: true, placeholder: 'e.g. Captain Vex', maxlength: 200, autocomplete: 'off' });
  const sourcesId = 'sources-new';
  const source = h('input', { placeholder: 'e.g. Original, a game or anime', maxlength: 200, autocomplete: 'off', list: sourcesId });
  const sourcesList = h('datalist', { id: sourcesId }, allSources().map((s) => h('option', { value: s })));
  const tags = tagInput();
  const drop = h('button.dropzone', { type: 'button', onclick: () => pickFiles(addPending) },
    h('span', h('strong', 'Add images'), h('br'), h('span.muted.small', 'Drop, paste (Ctrl+V) or tap to choose')));
  dropZone(drop, addPending);

  // ----- "you may already have this one" -----
  const similar = h('div.similar', { hidden: true, 'aria-live': 'polite' });
  let strong = false;
  function checkSimilar() {
    const matches = findSimilar(name.value, source.value, state.characters);
    strong = matches.some((m) => m.strong);
    submit.textContent = strong ? 'Create anyway' : 'Create';
    similar.hidden = !matches.length;
    similar.className = `similar ${strong ? 'strong' : 'soft'}`;
    if (!matches.length) { similar.replaceChildren(); return; }
    similar.replaceChildren(...[
      h('p.similar-title', icon(strong ? 'alert' : 'search'),
        strong ? 'You may already have this character' : 'Similar names on your board'),
      h('ul.similar-list', matches.map(({ c, match, strong: s }) => {
        const cover = coverOf(c);
        const why = s ? (match === 'same' ? 'Same name & source' : 'Similar name, same source')
          : (match === 'same' ? 'Same name · different source' : 'Similar name');
        return h('li',
          h('span.char-pick-thumb', cover ? h('img', { alt: '', 'data-path': cover.thumb_path || cover.path }) : null),
          h('span.char-pick-text',
            h('span.char-pick-name', c.name),
            h('span.char-pick-source', c.source || 'No source'),
            h('span.similar-why', why)),
          h('button.btn', { type: 'button', onclick: () => addToExisting(c) }, 'Add images to this one'));
      })),
      strong ? h('p.similar-hint.muted.small', 'Or press “Create anyway” to make a separate character.') : null,
    ].filter(Boolean));
    loadThumbs(similar);
  }
  let t;
  const debounced = () => { clearTimeout(t); t = setTimeout(checkSimilar, 150); };
  name.addEventListener('input', debounced);
  source.addEventListener('input', debounced);

  function addToExisting(c) {
    const files = pending.map((p) => p.file);
    acknowledge(pending.filter((p) => p.stored.length).map((p) => p.file));
    dlg.close();
    go(`#/c/${c.id}`);
    if (files.length) addImages(c, files, () => go(`#/c/${c.id}`));
  }

  const submit = h('button.btn.primary', { type: 'submit' }, 'Create');
  const form = h('form.dialog-body', {
    onsubmit: async (e) => {
      e.preventDefault();
      submit.disabled = true;
      try {
        const c = await api.createCharacter({ name: name.value.trim(), source: source.value.trim(), notes: '', links: [] });
        state.characters.unshift(c);
        try { await saveCharacterTags(c, tags.value()); } catch (err) { errorToast(err); }
        const files = pending.map((p) => p.file);
        acknowledge(pending.filter((p) => p.stored.length).map((p) => p.file)); // already warned in this dialog
        dlg.close();
        go(`#/c/${c.id}`);
        if (files.length) {
          await addImages(c, files, () => go(`#/c/${c.id}`));
        }
      } catch (err) { errorToast(err); submit.disabled = false; }
    },
  },
    h('h2', 'New character'),
    h('label.field', h('span', 'Name'), name),
    h('label.field', h('span', 'Source ', h('em.optional', 'optional')), source, sourcesList),
    similar,
    h('label.field', h('span', 'Tags'), tags.el),
    h('div.field', h('span', 'Images'), drop,
      h('div.row.paste-row', pasteButton((files) => addPending(files))),
      previews, dupNote),
    h('div.row.end',
      h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel'),
      submit),
  );

  const dlg = modal(form, {
    onClose: () => {
      open = false; addPending = null;
      setPasteTarget(prevPaste);
      setTimeout(() => pending.forEach((p) => URL.revokeObjectURL(p.url)), 1000);
    },
  });
  setPasteTarget(addPending);
  addPending(initialFiles);
  name.focus();
}
