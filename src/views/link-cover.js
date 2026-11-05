// "Set thumbnail": your own picture for a link (uploaded or pasted),
// compressed in the browser exactly like character images.
import { toast, errorToast } from '../ui.js';
import { api, state } from '../state.js';
import { compressImage, isImageFile } from '../compress.js';

export async function setLinkCover(l, file) {
  if (!isImageFile(file)) { toast('That isn’t an image.', { type: 'error' }); return false; }
  const t = toast('Saving thumbnail…', { timeout: 0 });
  try {
    const img = await compressImage(file);
    const cols = await api.uploadLinkCover(state.user.id, l.id, img);
    const old = [l.cover_path, l.cover_thumb_path];
    let row;
    try { row = await api.updateLink(l.id, cols); }
    catch (e) { api.removeFiles([cols.cover_path, cols.cover_thumb_path]).catch(console.error); throw e; }
    Object.assign(l, cols, { updated_at: row.updated_at });
    api.removeFiles(old).catch(console.error);
    toast('Thumbnail saved', { type: 'ok', timeout: 1800 });
    return true;
  } catch (e) {
    errorToast(e);
    return false;
  } finally { t.close(); }
}

export async function removeLinkCover(l) {
  const old = [l.cover_path, l.cover_thumb_path];
  const patch = { cover_path: null, cover_thumb_path: null, cover_width: null, cover_height: null };
  try {
    const row = await api.updateLink(l.id, patch);
    Object.assign(l, patch, { updated_at: row.updated_at });
    api.removeFiles(old).catch(console.error);
    return true;
  } catch (e) { errorToast(e); return false; }
}
