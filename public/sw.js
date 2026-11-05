// Service worker: makes the app installable and lets the app shell load
// offline/instantly. Your private data (Supabase) is never cached here.
const CACHE = 'cb-shell-v3';
const SHARE_CACHE = 'cb-share'; // images shared from other apps (Android), picked up by src/share.js
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Web Share Target (see manifest "share_target"): Android's Share sheet POSTs
// the images here. Keep them, then open the app, which asks what to do with them.
// A shared link (YouTube, X, …) goes to the Link Vault instead.
async function receiveShare(req) {
  const done = (q) => Response.redirect(new URL(`./?${q}`, self.registration.scope).href, 303);
  try {
    const form = await req.formData();
    const files = form.getAll('images').filter((f) => f && typeof f === 'object' && f.size > 0);
    // Sharing a link (no images) → open the app's "Add link" dialog
    if (!files.length) {
      const text = [form.get('url'), form.get('text'), form.get('title')].filter((v) => typeof v === 'string' && v.trim()).join(' ');
      const link = (text.match(/https?:\/\/[^\s<>"']+/i) || [])[0];
      if (link) return done(`add=${encodeURIComponent(link)}`);
    }
    const cache = await caches.open(SHARE_CACHE);
    for (const old of await cache.keys()) await cache.delete(old); // only the latest share
    const stamp = Date.now();
    await Promise.all(files.map((f, i) => cache.put(
      new URL(`./__shared/${stamp}-${i}`, self.registration.scope).href,
      new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(f.name || `shared-${i + 1}`) } }),
    )));
    return done(files.length ? 'shared=1' : 'shared=0');
  } catch (err) {
    console.error(err);
    return done('shared=error');
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/share-target')) {
    e.respondWith(receiveShare(req));
    return;
  }
  // Only handle our own static files. Supabase (auth, data, images) goes straight to the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Pages: network first (always get the latest version), fall back to cache offline.
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // Static assets (hashed filenames): cache first, then network.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
