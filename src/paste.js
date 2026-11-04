// "Paste image" for phones: the async Clipboard API, with a long-press
// paste field as a fallback when the browser blocks or lacks it.
import { h, icon, modal, toast } from './ui.js';
import { filesFromPaste } from './upload.js';

const MESSAGES = {
  unsupported: 'This browser doesn’t let websites read images from the clipboard. Long-press the box below and choose Paste instead.',
  blocked: 'The browser blocked clipboard access. You can allow “Clipboard” for this site in the browser’s site settings — or long-press the box below and choose Paste.',
  failed: 'Couldn’t read the clipboard. Long-press the box below and choose Paste instead.',
};
export const EMPTY_MESSAGE = 'No image on the clipboard — copy an image first (long-press it in another app → Copy), then try again.';

class PasteError extends Error {
  constructor(reason) { super(MESSAGES[reason] || EMPTY_MESSAGE); this.reason = reason; }
}

const stamp = (n, type) => `pasted-${Date.now()}-${n}.${(type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;

/** Read images from the clipboard. Throws PasteError with reason unsupported|blocked|failed|empty. */
export async function readClipboardImages() {
  if (!navigator.clipboard?.read) throw new PasteError('unsupported');
  let items;
  try {
    items = await navigator.clipboard.read();
  } catch (e) {
    throw new PasteError(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'blocked' : 'failed');
  }
  const files = [];
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (!type) continue;
    try {
      const blob = await item.getType(type);
      files.push(new File([blob], stamp(files.length, blob.type || type), { type: blob.type || type }));
    } catch { /* skip unreadable item */ }
  }
  if (!files.length) throw new PasteError('empty');
  return files;
}

/** A "Paste image" button. Falls back to the paste-field dialog when needed. */
export function pasteButton(onFiles, { label = 'Paste image', cls = '' } = {}) {
  return h(`button.btn.paste-btn${cls}`, {
    type: 'button',
    title: 'Paste an image from the clipboard',
    onclick: () => pasteFromClipboard(onFiles),
  }, icon('paste'), label);
}

export async function pasteFromClipboard(onFiles) {
  try {
    onFiles(await readClipboardImages());
  } catch (e) {
    if (e.reason === 'empty') toast(EMPTY_MESSAGE, { timeout: 6000 });
    else openPasteFallback(e.message, onFiles);
  }
}

/**
 * A box you can long-press → Paste into (works where the Clipboard API is blocked).
 * Accepts image files from the paste event, or <img> elements the browser inserts.
 */
export function pasteField(onFiles, { hint = 'Long-press here, then tap Paste' } = {}) {
  const box = h('div.paste-field', {
    contenteditable: 'true', role: 'textbox', 'aria-label': 'Paste an image here', 'aria-multiline': 'false',
    'data-placeholder': hint, spellcheck: 'false', autocapitalize: 'off',
  });
  let busy = false;
  const finish = (files) => {
    box.replaceChildren();
    if (files.length) onFiles(files);
    else toast('That wasn’t an image — copy an image and try again.');
  };
  box.addEventListener('paste', (e) => {
    e.stopPropagation(); // don't let the page-wide paste handler grab it too
    const files = filesFromPaste(e);
    if (files.length) { e.preventDefault(); finish(files); return; }
    // Some browsers paste images as <img> (HTML) instead of a file: let it land, then read it.
    if (busy) return;
    busy = true;
    setTimeout(async () => {
      busy = false;
      const imgs = [...box.querySelectorAll('img')].map((i) => i.src).filter(Boolean);
      const found = [];
      for (const src of imgs) {
        try {
          const blob = await (await fetch(src)).blob();
          if (blob.type.startsWith('image/')) found.push(new File([blob], stamp(found.length, blob.type), { type: blob.type }));
        } catch { /* cross-origin image we can't read */ }
      }
      finish(found);
    }, 50);
  });
  // never keep typed text around
  box.addEventListener('input', () => { if (!busy && !box.querySelector('img')) box.textContent = ''; });
  return box;
}

/** Dialog with an explanation and the long-press paste field. */
export function openPasteFallback(message, onFiles) {
  const field = pasteField((files) => { dlg.close(); onFiles(files); });
  const dlg = modal(
    h('div.dialog-body',
      h('h2', 'Paste image'),
      message ? h('p.notice', { role: 'status' }, message) : null,
      field,
      h('div.row.end', h('button.btn', { type: 'button', onclick: () => dlg.close() }, 'Cancel')),
    ),
  );
  field.focus();
  return dlg;
}
