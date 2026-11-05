// Background queue that asks the link-preview Edge Function for Open Graph data.
// Each link is fetched once: the function stores the result (preview_status) on the
// link, and we never auto-retry a link that has a status.
import { api, state, findLink } from './state.js';
import { toast } from './ui.js';

const tried = new Set();
const queue = [];
let running = 0;
let unavailable = false;
let onChange = () => {};

export function onPreviewChange(fn) { onChange = fn; }

/** Queue links that have never been looked up. */
export function queueMissingPreviews(links = state.links) {
  for (const l of links) if (!l.preview_status) queuePreview(l);
}

export function queuePreview(l, { force = false } = {}) {
  if (unavailable && !force) return Promise.resolve(null);
  if (!force && (l.preview_status || tried.has(l.id))) return Promise.resolve(null);
  tried.add(l.id);
  return new Promise((resolve) => { queue.push({ id: l.id, force, resolve }); pump(); });
}

function pump() {
  while (running < 2 && queue.length) {
    const job = queue.shift();
    running++;
    api.fetchPreview(job.id, { force: job.force })
      .then((row) => {
        const l = findLink(job.id);
        if (l && row) { Object.assign(l, row, { tag_ids: l.tag_ids, character_ids: l.character_ids }); onChange(l); }
        job.resolve(l || null);
      })
      .catch((e) => {
        console.warn('link preview failed', e);
        if (e.notDeployed && !unavailable) {
          unavailable = true;
          queue.splice(0).forEach((j) => j.resolve(null));
          if (job.force) toast('Link previews aren’t set up yet — deploy the “link-preview” Edge Function (see README).', { type: 'error', timeout: 8000 });
        }
        job.resolve(null);
      })
      .finally(() => { running--; pump(); });
  }
}
