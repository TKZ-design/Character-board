// Exact-duplicate image detection: a SHA-256 fingerprint of the ORIGINAL
// file (before compression) is stored with every upload. Only images
// uploaded since this feature exists have a fingerprint.
import { h, modal } from './ui.js';
import { state } from './state.js';

const hashes = new WeakMap();        // File -> Promise<string|null>
const acknowledged = new WeakSet();  // Files the user has already been warned about

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 hex of a file's bytes (cached per File). null if the browser can't hash. */
export function hashFile(file) {
  if (!hashes.has(file)) {
    const p = globalThis.crypto?.subtle
      ? file.arrayBuffer().then((b) => crypto.subtle.digest('SHA-256', b)).then(toHex).catch(() => null)
      : Promise.resolve(null);
    hashes.set(file, p);
  }
  return hashes.get(file);
}

/** Characters that already store an image with this fingerprint. */
export function charactersWithHash(hash) {
  if (!hash) return [];
  return state.characters.filter((c) => c.images.some((im) => im.sha256 === hash));
}

/**
 * For each file: { file, hash, stored: [characters], repeat: bool (same file earlier in this batch) }.
 */
export async function duplicateInfo(files) {
  const seen = new Set();
  const out = [];
  for (const file of files) {
    const hash = await hashFile(file);
    out.push({ file, hash, stored: charactersWithHash(hash), repeat: !!hash && seen.has(hash) });
    if (hash) seen.add(hash);
  }
  return out;
}

/** Mark files as "the user has seen the duplicate warning for these" (so we don't ask twice). */
export function acknowledge(files) { for (const f of files) acknowledged.add(f); }

export function whereText(chars) {
  const names = chars.map((c) => c.name);
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

/**
 * Before uploading: if some files are already stored (and the user hasn't
 * been warned yet), ask. Same file twice in one batch is silently dropped.
 * Resolves to the files to upload.
 */
export async function confirmDuplicates(files) {
  const info = await duplicateInfo(files);
  const unique = info.filter((i) => !i.repeat);
  const dups = unique.filter((i) => i.stored.length && !acknowledged.has(i.file));
  if (!dups.length) return unique.map((i) => i.file);

  const urls = dups.map((d) => URL.createObjectURL(d.file));
  const choice = await new Promise((resolve) => {
    let picked = 'skip';
    const n = dups.length;
    const dlg = modal(
      h('form.dialog-body', { method: 'dialog' },
        h('p.eyebrow', 'Duplicate check'),
        h('h2', n === 1 ? 'Already stored' : `${n} images already stored`),
        h('p.muted', n === 1
          ? 'This exact image is already on your board.'
          : 'These exact images are already on your board.'),
        h('ul.dup-images', dups.map((d, i) =>
          h('li', h('img', { src: urls[i], alt: '' }),
            h('span', 'In ', h('strong', whereText(d.stored)))))),
        h('div.row.end',
          h('button.btn', { type: 'submit', onclick: () => (picked = 'all') }, 'Upload anyway'),
          h('button.btn.primary', { type: 'submit', onclick: () => (picked = 'skip') }, n === 1 ? 'Skip it' : 'Skip duplicates')),
      ),
      { onClose: () => resolve(picked) },
    );
    dlg.querySelector('.btn.primary').focus();
  });
  urls.forEach((u) => URL.revokeObjectURL(u));
  acknowledge(dups.map((d) => d.file));
  const skip = new Set(choice === 'skip' ? dups.map((d) => d.file) : []);
  return unique.map((i) => i.file).filter((f) => !skip.has(f));
}
