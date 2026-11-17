// The "+" button's sheet: the four ways to put something into Stash.
import { h, icon, sheet } from '../ui.js';
import { openNewCharacter } from './new-character.js';
import { openAddLink, pasteLink } from './add-link.js';
import { openImageChooser } from './image-chooser.js';
import { pasteFromClipboard } from '../paste.js';

const ROWS = [
  { ic: 'users', title: 'New character', sub: 'A name, images, tags and notes', run: () => openNewCharacter() },
  { ic: 'link', title: 'Add link', sub: 'Type or paste an address and save it', run: () => openAddLink() },
  { ic: 'paste', title: 'Paste link', sub: 'Save the link you just copied', run: () => pasteLink() },
  { ic: 'image', title: 'Paste image', sub: 'Add the image you just copied', run: () => pasteFromClipboard((files) => openImageChooser(files)) },
];

let open = null;

export function openAddSheet() {
  if (open) return;
  const dlg = sheet(
    h('div.sheet-rows', ROWS.map((r) =>
      h('button.sheet-row', {
        type: 'button',
        // close first, then act: the next dialog (or the clipboard prompt) must not stack on the sheet
        onclick: () => { dlg.close(); setTimeout(r.run, 0); },
      },
        h('span.sheet-row-icon', icon(r.ic)),
        h('span.sheet-row-text', h('strong', r.title), h('span', r.sub))))),
    { title: 'Add to Stash', onClose: () => { open = null; } });
  open = dlg;
}
