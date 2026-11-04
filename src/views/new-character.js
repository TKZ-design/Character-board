import { h, icon, modal, errorToast } from '../ui.js';
import { api, state } from '../state.js';
import { tagInput } from './tag-input.js';
import { dropZone, pickFiles, addImages } from '../upload.js';
import { isImageFile } from '../compress.js';
import { go, setPasteTarget, getPasteTarget } from '../nav.js';

let open = false;
let addPending = null;

/** Opens the "New character" dialog (optionally pre-filled with images). */
export function openNewCharacter(initialFiles = []) {
  if (open) { addPending?.(initialFiles); return; }
  open = true;
  const pending = [];
  const previews = h('div.pending');
  const prevPaste = getPasteTarget();

  addPending = (files) => {
    for (const f of files.filter(isImageFile)) pending.push({ file: f, url: URL.createObjectURL(f) });
    drawPreviews();
  };
  function drawPreviews() {
    previews.replaceChildren(...pending.map((p, i) =>
      h('div.pending-item', h('img', { src: p.url, alt: '' }),
        h('button.icon-btn.small', { type: 'button', 'aria-label': 'Remove image', onclick: () => { URL.revokeObjectURL(p.url); pending.splice(i, 1); drawPreviews(); } }, icon('close')))));
  }

  const name = h('input', { required: true, placeholder: 'e.g. Captain Vex', maxlength: 200, autocomplete: 'off' });
  const tags = tagInput();
  const drop = h('button.dropzone', { type: 'button', onclick: () => pickFiles(addPending) },
    icon('upload'), h('span', h('strong', 'Add images'), h('br'), h('span.muted.small', 'Drop, paste (Ctrl+V) or tap to choose')));
  dropZone(drop, addPending);

  const submit = h('button.btn.primary', { type: 'submit' }, 'Create');
  const form = h('form.dialog-body', {
    onsubmit: async (e) => {
      e.preventDefault();
      submit.disabled = true;
      try {
        const c = await api.createCharacter({ name: name.value.trim(), tags: tags.value(), notes: '', links: [] });
        state.characters.unshift(c);
        const files = pending.map((p) => p.file);
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
    h('label.field', h('span', 'Tags'), tags.el),
    h('div.field', h('span', 'Images'), drop, previews),
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
