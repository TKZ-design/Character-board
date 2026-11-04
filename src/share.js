// Android "Share → Characters": the service worker (public/sw.js) receives
// the shared images, keeps them in this cache and opens the app. Here we
// collect them (once you're logged in) and hand them to the chooser.
export const SHARE_CACHE = 'cb-share';

export async function takeSharedFiles() {
  if (!('caches' in window)) return [];
  try {
    if (!(await caches.has(SHARE_CACHE))) return [];
    const cache = await caches.open(SHARE_CACHE);
    const files = [];
    for (const req of await cache.keys()) {
      const res = await cache.match(req);
      if (res) {
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get('x-file-name') || '') || `shared-${files.length + 1}`;
        files.push(new File([blob], name, { type: blob.type || res.headers.get('content-type') || '' }));
      }
      await cache.delete(req);
    }
    return files;
  } catch (e) {
    console.error(e);
    return [];
  }
}
