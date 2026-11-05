// Tests for the quick-save Edge Function (supabase/functions/quick-save/index.ts).
// Fake network + fake database: nothing real is called.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, keysMatch, linkFromInput, optionalText, restDb, MAX_TEXT } from '../supabase/functions/quick-save/index.ts';

const KEY = 'k'.repeat(20) + '-correct-horse-battery-staple-42';
const OWNER = '11111111-2222-4333-8444-555555555555';

function fakeDb(existing = []) {
  const links = existing.map((url) => ({ url }));
  const notes = [];
  return {
    links, notes,
    linkUrls: async (uid) => { assert.equal(uid, OWNER); return links.map((l) => l.url); },
    insertLink: async (row) => { links.push(row); },
    insertNote: async (row) => { notes.push(row); },
  };
}
const page = (html) => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
function deps({ db = fakeDb(), dns = {}, routes = {}, key = KEY, ownerId = OWNER } = {}) {
  const calls = [];
  return {
    db, calls, key, ownerId,
    resolve: async (host) => dns[host] ?? ['93.184.216.34'],
    fetch: async (url, opts) => {
      calls.push(url);
      assert.equal(opts.redirect, 'manual');
      const r = routes[url];
      return r ? (typeof r === 'function' ? r() : r) : new Response('not found', { status: 404 });
    },
  };
}
const post = (body, d, key = KEY, method = 'POST') => {
  const headers = { 'content-type': 'application/json' };
  if (key != null) headers['x-stash-key'] = key;
  return handle(new Request('https://fn.local/quick-save', { method, headers, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined }), d);
};
const reply = async (res) => ({ status: res.status, text: await res.text() });

// ---------------- key ----------------

test('keysMatch: only the exact key, and never with a missing or short server key', async () => {
  assert.equal(await keysMatch(KEY, KEY), true);
  assert.equal(await keysMatch(KEY + 'x', KEY), false);
  assert.equal(await keysMatch(KEY.slice(0, -1), KEY), false);
  assert.equal(await keysMatch('', KEY), false);
  assert.equal(await keysMatch(null, KEY), false);
  assert.equal(await keysMatch(KEY, undefined), false);
  assert.equal(await keysMatch('', ''), false);
  assert.equal(await keysMatch('short', 'short'), false, 'a too-short server key never unlocks');
});

test('wrong or missing key → 401, nothing saved, nothing fetched', async () => {
  for (const key of [null, '', 'wrong', KEY.toUpperCase()]) {
    const d = deps();
    const r = await reply(await post({ type: 'link', url: 'https://example.com/a' }, d, key));
    assert.deepEqual(r, { status: 401, text: 'Unauthorized' }, String(key));
    assert.equal(d.db.links.length, 0);
    assert.equal(d.calls.length, 0);
  }
  const d = deps();
  assert.equal((await post({ type: 'note', body: 'hi' }, d, 'nope')).status, 401);
  assert.equal(d.db.notes.length, 0);
});

test('server without a key configured refuses everything', async () => {
  const d = deps({ key: undefined });
  assert.equal((await post({ type: 'note', body: 'hi' }, d, '')).status, 401);
  assert.equal((await post({ type: 'note', body: 'hi' }, d, 'undefined')).status, 401);
  assert.equal(d.db.notes.length, 0);
});

test('only POST', async () => {
  assert.equal((await post(null, deps(), KEY, 'GET')).status, 405);
});

// ---------------- validation ----------------

test('linkFromInput finds the link in shared text and cleans it', () => {
  assert.equal(linkFromInput('Check out this post! https://www.reddit.com/r/art/comments/1abc2d/knight/?share_id=xyz&utm_source=share'),
    'https://www.reddit.com/r/art/comments/1abc2d/knight/');
  assert.equal(linkFromInput('  https://youtu.be/dQw4w9WgXcQ?si=abc  '), 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(linkFromInput('youtu.be/dQw4w9WgXcQ'), 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(linkFromInput('Look 👀\nhttps://x.com/artist/status/123456789?s=20 via @someone'), 'https://x.com/artist/status/123456789');
});

test('linkFromInput rejects junk, other schemes, private addresses and long links', () => {
  const bad = (v, msg) => assert.throws(() => linkFromInput(v), (e) => e.message === msg, String(v).slice(0, 40));
  bad('', 'No link found');
  bad(undefined, 'No link found');
  bad(42, 'No link found');
  bad('just some words', 'No link found');
  bad('javascript:alert(1)', 'No link found');
  bad('ftp://example.com/file', 'No link found');
  bad('file:///etc/passwd', 'No link found');
  for (const u of ['http://localhost/admin', 'http://127.0.0.1/', 'http://10.0.0.1/', 'http://169.254.169.254/latest/meta-data',
    'http://[::1]/', 'http://printer.local/', 'http://intranet/']) bad(u, 'Link not allowed');
  bad('https://example.com:8443/', 'Not a valid link');
  bad('https://example.com/' + 'a'.repeat(2000), 'Link too long');
  bad('x'.repeat(MAX_TEXT + 1), 'Too long');
});

test('optionalText limits', () => {
  assert.equal(optionalText(undefined), '');
  assert.equal(optionalText(null), '');
  assert.equal(optionalText('  hi  '), 'hi');
  assert.equal(optionalText('x'.repeat(MAX_TEXT)).length, MAX_TEXT);
  assert.throws(() => optionalText('x'.repeat(MAX_TEXT + 1)), /too long/);
  assert.throws(() => optionalText({ a: 1 }), /must be text/);
});

test('bad bodies get a short 400', async () => {
  assert.deepEqual(await reply(await post('not json', deps())), { status: 400, text: 'Send JSON' });
  assert.deepEqual(await reply(await post('null', deps())), { status: 400, text: 'Send JSON' });
  assert.deepEqual(await reply(await post({ type: 'photo' }, deps())), { status: 400, text: 'Unknown type' });
  assert.deepEqual(await reply(await post({ type: 'note', body: '   ' }, deps())), { status: 400, text: 'Empty note' });
  assert.equal((await post({ type: 'note', body: 'x'.repeat(MAX_TEXT + 1) }, deps())).status, 400);
  assert.equal((await post({ type: 'link', url: 'https://example.com', note: 'x'.repeat(MAX_TEXT + 1) }, deps())).status, 400);
  assert.equal((await post({ type: 'note', body: 'x'.repeat(20_000) }, deps())).status, 413);
});

// ---------------- links ----------------

test('new link → saved with preview, then "Already saved" for the same link in another shape', async () => {
  const d = deps({ routes: { 'https://example.com/post': page('<meta property="og:title" content="Hello"><meta property="og:image" content="https://cdn.example.com/a.jpg"><meta property="og:site_name" content="Example"></head>') } });
  assert.deepEqual(await reply(await post({ type: 'link', url: 'Look: https://example.com/post?utm_source=ios', note: ' for later ' }, d)), { status: 200, text: 'Saved ✓' });
  assert.equal(d.db.links.length, 1);
  const row = d.db.links[0];
  assert.equal(row.user_id, OWNER);
  assert.equal(row.url, 'https://example.com/post');
  assert.equal(row.platform, 'web');
  assert.equal(row.title, 'Hello');
  assert.equal(row.site_name, 'Example');
  assert.equal(row.thumbnail_url, 'https://cdn.example.com/a.jpg');
  assert.equal(row.notes, 'for later');
  assert.equal(row.preview_status, 'ok');

  assert.deepEqual(await reply(await post({ type: 'link', url: 'http://www.example.com/post/' }, d)), { status: 200, text: 'Already saved' });
  assert.equal(d.db.links.length, 1);
});

test('duplicate check matches the app (youtu.be = youtube.com/watch)', async () => {
  const d = deps({ db: fakeDb(['https://www.youtube.com/watch?v=dQw4w9WgXcQ']) });
  assert.deepEqual(await reply(await post({ type: 'link', url: 'https://youtu.be/dQw4w9WgXcQ?si=abc' }, d)), { status: 200, text: 'Already saved' });
  assert.equal(d.calls.length, 0, 'no preview fetched for a duplicate');
});

test('YouTube: oEmbed title, no stored thumbnail (the app uses the video ID)', async () => {
  const oembed = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://youtu.be/dQw4w9WgXcQ');
  const d = deps({ routes: { [oembed]: new Response(JSON.stringify({ title: 'Run cycle', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', provider_name: 'YouTube' })) } });
  assert.equal((await reply(await post({ type: 'link', url: 'https://youtu.be/dQw4w9WgXcQ' }, d))).text, 'Saved ✓');
  const row = d.db.links[0];
  assert.equal(row.platform, 'youtube');
  assert.equal(row.title, 'Run cycle');
  assert.equal(row.thumbnail_url, null);
});

test('hosts that resolve to private addresses are rejected and not saved', async () => {
  const d = deps({ dns: { 'sneaky.example.com': ['10.0.0.5'] } });
  assert.deepEqual(await reply(await post({ type: 'link', url: 'https://sneaky.example.com/x' }, d)), { status: 400, text: 'Link not allowed' });
  assert.equal(d.db.links.length, 0);
  assert.equal(d.calls.length, 0);
});

test('redirects to private addresses: rejected and not saved', async () => {
  const d = deps({ routes: { 'https://example.com/r': new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }) } });
  assert.equal((await reply(await post({ type: 'link', url: 'https://example.com/r' }, d))).text, 'Link not allowed');
  assert.equal(d.db.links.length, 0);
});

test('literal private URLs are rejected before anything happens', async () => {
  const d = deps();
  assert.deepEqual(await reply(await post({ type: 'link', url: 'http://192.168.1.1/admin' }, d)), { status: 400, text: 'Link not allowed' });
  assert.equal(d.calls.length, 0);
  assert.equal(d.db.links.length, 0);
});

test('slow or broken sites are still saved (preview retried later by the app)', async () => {
  const d = deps({ routes: { 'https://example.com/slow': () => { throw new Error('network down'); } } });
  assert.equal((await reply(await post({ type: 'link', url: 'https://example.com/slow' }, d))).text, 'Saved ✓');
  assert.equal(d.db.links[0].preview_status, 'pending');
  assert.equal(d.db.links[0].title, '');

  const d2 = deps();
  d2.resolve = async () => { throw new Error('DNS hiccup'); };
  assert.equal((await reply(await post({ type: 'link', url: 'https://example.org/x' }, d2))).text, 'Saved ✓');
  assert.equal(d2.db.links[0].preview_status, 'pending');
});

test('database errors give a short 500', async () => {
  const d = deps();
  d.db.insertNote = async () => { throw new Error('db down'); };
  const orig = console.error; console.error = () => {};
  try { assert.deepEqual(await reply(await post({ type: 'note', body: 'hi' }, d)), { status: 500, text: 'Could not save, try again' }); }
  finally { console.error = orig; }
});

test('misconfigured owner id is reported, nothing saved', async () => {
  const d = deps({ ownerId: 'not-a-uuid' });
  assert.equal((await post({ type: 'note', body: 'hi' }, d)).status, 500);
  assert.equal(d.db.notes.length, 0);
});

// ---------------- notes ----------------

test('note → saved for the owner + "Note saved ✓"', async () => {
  const d = deps();
  assert.deepEqual(await reply(await post({ type: 'note', body: '  Idea: a knight who is afraid of horses  ' }, d)), { status: 200, text: 'Note saved ✓' });
  assert.deepEqual(d.db.notes, [{ user_id: OWNER, body: 'Idea: a knight who is afraid of horses' }]);
});

// ---------------- REST database adapter ----------------

test('restDb uses the service key server-side and pages through all links', async () => {
  const seen = [];
  const fakeFetch = async (url, opts) => {
    seen.push({ url, opts });
    if (opts.method === 'POST') return new Response(null, { status: 201 });
    const offset = Number(new URL(url).searchParams.get('offset'));
    const n = offset === 0 ? 1000 : 3;
    return new Response(JSON.stringify(Array.from({ length: n }, (_, i) => ({ url: `https://e.com/${offset + i}` }))));
  };
  const db = restDb('https://proj.supabase.co', 'service-key', fakeFetch);
  const urls = await db.linkUrls(OWNER);
  assert.equal(urls.length, 1003);
  assert.match(seen[0].url, /vault_links\?select=url&user_id=eq\.11111111-/);
  assert.equal(seen[0].opts.headers.apikey, 'service-key');
  await db.insertNote({ user_id: OWNER, body: 'x' });
  assert.equal(seen.at(-1).url, 'https://proj.supabase.co/rest/v1/notes');
  assert.equal(JSON.parse(seen.at(-1).opts.body).body, 'x');
});
