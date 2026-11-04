import { h, icon, modal } from '../ui.js';
import { state, coverOf } from '../state.js';
import { isImageFile } from '../compress.js';
import { addImages } from '../upload.js';
import { duplicateInfo, acknowledge, whereText } from '../hash.js';
import { matchesSearch } from '../text.js';
import { go, setPasteTarget, getPasteTarget } from '../nav.js';
import { loadThumbs } from '../thumbs.js';
import { openNewCharacter } from './new-character.js';

let addToOpen = null; // set while the chooser is open

/**
 * Pasted / dropped / shared images on the board: ask "New character" or
 * "Add to existing" (searchable by name or source).
 */
export function openImageChooser(initialFiles) {
  const incoming = [...initialFiles].filter(isImageFile);
  if (!incoming.length) return;
  if (addToOpen) { addToOpen(incoming); return; }
  if (!state.characters.length) { openNewCharacter(incoming); return; }

  const pending = []; // { file, url, info }
  const previews = h('div.pending');
  const dupNote = h('div.dup-note', { hidden: true, role: 'status' });
  const title = h('h2');
  const prevPaste = getPasteTarget();

  async function addFiles(files) {
    for (const f of files.filter(isImageFile)) pending.push({ file: f, url: URL.createObjectURL(f), info: null });
    draw();
    const infos = await duplicateInfo(pending.map((p) => p.file));
    // drop exact repeats inside this batch
    for (let i = infos.length - 1; i >= 0; i--) {
      if (infos[i].repeat) { URL.revokeObjectURL(pending[i].url); pending.splice(i, 1); infos.splice(i, 1); }
      else pending[i].info = infos[i];
    }
    draw();
  }

  function draw() {
    const n = pending.length;
    title.textContent = n === 1 ? 'Add 1 image' : `Add ${n} images`;
    previews.replaceChildren(...pending.map((p, i) =>
      h(`div.pending-item${p.info?.stored.length ? '.is-dup' : ''}`,
        h('img', { src: p.url, alt: '' }),
        p.info?.stored.length ? h('span.dup-badge', 'Stored') : null,
        n > 1 ? h('button.icon-btn.small', { type: 'button', 'aria-label': 'Remove image', onclick: () => { URL.revokeObjectURL(p.url); pending.splice(i, 1); draw(); } }, icon('close')) : null)));
    const dups = pending.filter((p) => p.info?.stored.length);
    dupNote.hidden = !dups.length;
    if (dups.length) {
      const where = [...new Set(dups.flatMap((d) => d.info.stored))];
      dupNote.replaceChildren(...[
        icon('alert'),
        h('span', dups.length === 1 && n === 1 ? 'This exact image is already stored in ' : `${dups.length} of these ${dups.length === 1 ? 'is' : 'are'} already stored in `,
          h('strong', whereText(where)), '.'),
        n > dups.length
          ? h('button.btn', { type: 'button', onclick: () => { for (const d of dups) { URL.revokeObjectURL(d.url); pending.splice(pending.indexOf(d), 1); } draw(); } }, 'Leave them out')
          : null,
      ].filter(Boolean));
    }
    for (const b of form.querySelectorAll('[data-needs-files]')) b.disabled = !n;
  }

  // ----- existing characters, searchable -----
  const search = h('input', { type: 'search', placeholder: 'Search by name or source', autocomplete: 'off', 'aria-label': 'Search characters' });
  const results = h('ul.char-pick', { 'aria-label': 'Characters' });
  function drawResults() {
    const list = state.characters.filter((c) => matchesSearch(c, search.value));
    results.replaceChildren(...(list.length ? list.map((c) => {
      const cover = coverOf(c);
      return h('li', h('button.char-pick-item', { type: 'button', 'data-needs-files': '', onclick: () => chooseExisting(c) },
        h('span.char-pick-thumb', cover ? h('img', { alt: '', 'data-path': cover.thumb_path || cover.path }) : null),
        h('span.char-pick-text',
          h('span.char-pick-name', c.name),
          h('span.char-pick-source', c.source || '—')),
        h('span.char-pick-count', `${c.images.length} img`)));
    }) : [h('li.muted.char-pick-empty', 'No characters match')]));
    loadThumbs(results);
  }
  search.addEventListener('input', drawResults);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); results.querySelector('button')?.click(); }
  });

  const files = () => pending.map((p) => p.file);
  const shownDups = () => acknowledge(pending.filter((p) => p.info?.stored.length).map((p) => p.file));

  function chooseExisting(c) {
    const f = files();
    if (!f.length) return;
    shownDups();
    dlg.close();
    go(`#/c/${c.id}`);
    addImages(c, f, () => go(`#/c/${c.id}`));
  }

  const form = h('div.dialog-body.chooser',
    h('p.eyebrow', 'New images'),
    title,
    previews,
    dupNote,
    h('div.chooser-option',
      h('button.btn.primary', { type: 'button', 'data-needs-files': '', onclick: () => { const f = files(); shownDups(); dlg.close(); openNewCharacter(f); } },
        icon('plus'), 'New character')),
    h('div.chooser-or', h('span', 'or add to existing')),
    h('label.search.chooser-search', h('span.search-label', 'Find'), search),
    results,
    h('div.row.end', h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel')),
  );

  const dlg = modal(form, {
    cls: 'chooser-modal',
    onClose: () => {
      addToOpen = null;
      setPasteTarget(prevPaste);
      setTimeout(() => pending.forEach((p) => URL.revokeObjectURL(p.url)), 1000);
    },
  });
  addToOpen = addFiles;
  setPasteTarget(addFiles);
  drawResults();
  addFiles(incoming);
  form.querySelector('.btn.primary').focus();
}
