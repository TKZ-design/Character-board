// Open Graph previews via the link-preview Edge Function.
// Each link is looked up once: the result is saved on the link
// (preview_status 'ok' or 'none'); only 'pending' links are tried again.
import { api, state } from './state.js';
import { toast } from './ui.js';

let unavailable = false; // function not deployed / not allowed: stop asking this session
let hinted = false;
const tried = new Set();  // link ids looked up this session

export const previewsUnavailable = () => unavailable;

/**
 * Look up a preview. Resolves to { title, description, image, site_name, status: 'ok'|'none' },
 * or null when it should be tried again later (network trouble, function missing).
 */
export async function lookUpPreview(url) {
  if (unavailable) return null;
  try {
    const d = await api.fetchPreview(url);
    const found = !!(d?.title || d?.image || d?.description);
    return {
      title: (d?.title || '').slice(0, 300),
      description: (d?.description || '').slice(0, 2000),
      image: /^https?:\/\//i.test(d?.image || '') && d.image.length <= 2048 ? d.image : null,
      site_name: (d?.site_name || '').slice(0, 200),
      status: found ? 'ok' : 'none',
    };
  } catch (e) {
    if (e.status === 400 || e.status === 413) return { title: '', description: '', image: null, site_name: '', status: 'none' }; // blocked / not a page
    if (e.status === 404 || e.status === 401 || e.status === 403) {
      unavailable = true;
      console.warn('link-preview Edge Function unavailable:', e.status, e.message);
      if (!hinted && e.status === 404) {
        hinted = true;
        toast('Link previews are off until the “link-preview” Edge Function is deployed (see README).', { timeout: 7000 });
      }
    } else console.warn('Preview failed, will retry later:', e.message);
    return null;
  }
}

/** The columns to save on a link for a preview result (never overwrites what you typed). */
export function previewPatch(l, r) {
  const patch = { preview_status: r.status, preview_fetched_at: new Date().toISOString() };
  if (!l.title?.trim() && r.title) patch.title = r.title;
  if (!l.description?.trim() && r.description) patch.description = r.description;
  if (!l.site_name && r.site_name) patch.site_name = r.site_name;
  if (r.image && l.platform !== 'youtube') patch.thumbnail_url = r.image;
  return patch;
}

/** Look up links that never got a preview (e.g. saved before the function existed), 2 at a time. */
export async function fillPendingPreviews(onUpdate) {
  const queue = state.links.filter((l) => l.preview_status === 'pending' && !tried.has(l.id));
  if (!queue.length) return;
  queue.forEach((l) => tried.add(l.id));
  let changed = false, timer;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // never re-render over a form you're typing in
      if (!document.querySelector('.detail-info form, dialog[open]')) onUpdate?.();
      else changed = true;
    }, 300);
  };
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (queue.length && !unavailable) {
      const l = queue.shift();
      const r = await lookUpPreview(l.url);
      if (!r || !state.links.includes(l)) continue;
      const patch = previewPatch(l, r);
      try {
        Object.assign(l, patch, { updated_at: (await api.updateLink(l.id, patch)).updated_at });
        refresh();
      } catch (e) { console.warn(e); }
    }
  }));
  return changed;
}
