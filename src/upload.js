import { api, state } from './state.js';
import { compressImage, isImageFile } from './compress.js';
import { toast } from './ui.js';

/**
 * Compress and upload files to a character, one at a time.
 * `onEach` is called after every successful upload so the UI can refresh.
 */
export async function addImages(character, files, onEach) {
  const list = [...files].filter(isImageFile);
  const skipped = files.length - list.length;
  if (skipped) toast(`${skipped} file(s) skipped — not an image`, { type: 'error' });
  if (!list.length) return;

  const t = toast('', { timeout: 0 });
  let done = 0, failed = 0;
  for (const file of list) {
    t.update(`Uploading ${done + failed + 1} of ${list.length}…`);
    try {
      const img = await compressImage(file);
      const pos = Math.max(-1, ...character.images.map((i) => i.position ?? 0)) + 1;
      const row = await api.uploadImage(state.user.id, character.id, img, pos);
      character.images.push(row);
      done++;
      onEach?.(row);
    } catch (e) {
      failed++;
      console.error(e);
      toast(`Couldn't upload ${file.name || 'image'}: ${e.message || e}`, { type: 'error', timeout: 7000 });
    }
  }
  t.close();
  if (done) toast(`Added ${done} image${done > 1 ? 's' : ''}`, { type: 'ok' });
  return { done, failed };
}

/** Make an element accept dropped image files. */
export function dropZone(el, onFiles) {
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  el.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; el.classList.add('dragging'); });
  el.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  el.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; el.classList.remove('dragging'); } });
  el.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); e.stopPropagation();
    depth = 0; el.classList.remove('dragging');
    const files = [...e.dataTransfer.files];
    if (files.length) onFiles(files);
  });
}

/** Hidden <input type=file> — `accept="image/*"` lets phones offer camera roll + camera. */
export function pickFiles(onFiles) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = () => { if (input.files.length) onFiles([...input.files]); };
  input.click();
}

/** Extract image files from a paste event (Ctrl+V / Cmd+V). */
export function filesFromPaste(e) {
  const items = [...(e.clipboardData?.items || [])];
  return items.filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i, n) => {
    const f = i.getAsFile();
    return f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${Date.now()}-${n}.${f.type.split('/')[1] || 'png'}`, { type: f.type });
  });
}
