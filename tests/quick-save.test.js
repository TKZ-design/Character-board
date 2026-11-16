// Tests for the Quick Save Edge Function (supabase/functions/quick-save/index.ts):
// the key check, link validation, duplicate handling, and that its copied
// parts still match the originals (link-preview and src/links.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as qs from '../supabase/functions/quick-save/index.ts';
import * as app from '../src/links.js';

const { handle, sameKey, linkFromBody, isDuplicate, SAVED, ALREADY, REFUSED } = qs;
const KEY = 'test-key-0123456789-abcdefghij';
const OWNER = '00000000-0000-0000-0000-00000000000a';
const page = (html) => new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

/** A fake Supabase project: secrets, the owner's saved links, and a fake internet. */
function deps({ key = KEY, owner = OWNER, saved = [], routes = {}, dns = {}, dbDown = false } = {}) {
  const d = {
    rows: [], fetched: [], listed: 0,
    env: (name) => ({ QUICK_SAVE_KEY: key, OWNER_USER_ID: owner })[name],
    listUrls: async (id) => { d.listed++; assert.equal(id, OWNER); if (dbDown) throw new Error('down'); return [...saved, ...d.rows.map((r) => r.url)]; },
    insertLink: async (row) => { d.rows.push(row); },
    resolve: async (host) => dns[host] ?? ['93.184.216.34'],
    fetch: async (url, opts) => {
      d.fetched.push(url);
      assert.equal(opts.redirect, 'manual');
      const r = routes[url];
      if (!r) return new Response('not found', { status: 404 });
      return typeof r === 'function' ? r() : r;
    },
  };
  return d;
}
const post = (body, d, { key = KEY, method = 'POST', headers = {} } = {}) =>
  handle(new Request('https://fn.local/quick-save', {
    method, headers: { ...(key == null ? {} : { 'x-stash-key': key }), ...headers }, body: method === 'GET' ? undefined : body,
  }), d);
const untouched = (d) => { assert.equal(d.rows.length, 0, 'nothing saved'); assert.equal(d.fetched.length, 0, 'nothing fetched'); };

// ---------------- saving ----------------

test('correct key + new link: one link in Unsorted, with title and thumbnail, "Saved ✓"', async () => {
  const d = deps({ routes: { 'https://example.com/post': page('<meta property="og:title" content="Hello"><meta property="og:image" content="https://cdn.example.com/a.jpg"><meta property="og:site_name" content="Example"></head>') } });
  const res = await post('https://example.com/post?utm_source=share', d);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), SAVED);
  assert.match(res.headers.get('content-type'), /^text\/plain/);
  assert.equal(d.rows.length, 1);
  const row = d.rows[0];
  assert.equal(typeof row.preview_fetched_at, 'string');
  assert.deepEqual({ ...row, preview_fetched_at: null }, {
    user_id: OWNER, url: 'https://example.com/post', platform: 'web', folder_id: null,
    title: 'Hello', description: '', site_name: 'Example', thumbnail_url: 'https://cdn.example.com/a.jpg',
    preview_status: 'ok', preview_fetched_at: null,
  });
});

test('the same link again: "Already saved" and nothing new', async () => {
  const d = deps();
  assert.equal(await (await post('https://example.com/a', d)).text(), SAVED);
  for (const again of ['https://example.com/a', 'http://www.example.com/a/', 'https://example.com/a?utm_medium=x&fbclid=1']) {
    const res = await post(again, d);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), ALREADY, again);
  }
  assert.equal(d.rows.length, 1);
});

test('a link already in the vault (saved from the app) counts as a duplicate too', async () => {
  const d = deps({ saved: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'] });
  assert.equal(await (await post('https://youtu.be/dQw4w9WgXcQ?si=abc', d)).text(), ALREADY);
  untouched(d);
});

test('accepts JSON {"url": …} as well as plain text', async () => {
  const d = deps();
  assert.equal(await (await post(JSON.stringify({ url: 'https://example.com/json' }), d, { headers: { 'content-type': 'application/json' } })).text(), SAVED);
  assert.equal(d.rows[0].url, 'https://example.com/json');
});

test('YouTube links keep the app\'s own thumbnail (none stored)', async () => {
  const d = deps({ routes: { 'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ':
    new Response(JSON.stringify({ title: 'A video', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', provider_name: 'YouTube' }), { status: 200 }) } });
  assert.equal(await (await post('https://youtu.be/dQw4w9WgXcQ', d)).text(), SAVED);
  assert.equal(d.rows[0].platform, 'youtube');
  assert.equal(d.rows[0].title, 'A video');
  assert.equal(d.rows[0].thumbnail_url, null);
});

test('no preview available: the link is still saved (the app looks it up later)', async () => {
  const d = deps({ routes: { 'https://example.com/slow': () => { throw new Error('network down'); } } });
  assert.equal(await (await post('https://example.com/slow', d)).text(), SAVED);
  assert.deepEqual(d.rows[0], { user_id: OWNER, url: 'https://example.com/slow', platform: 'web', folder_id: null, preview_status: 'pending' });
});

// ---------------- refusing ----------------

test('wrong or missing key: refused, nothing saved, database not even asked', async () => {
  for (const key of [null, '', 'wrong', KEY + 'x', KEY.slice(0, -1), KEY.toUpperCase()]) {
    const d = deps();
    const res = await post('https://example.com/a', d, { key });
    assert.equal(res.status, 401, String(key));
    assert.equal(await res.text(), REFUSED);
    untouched(d);
    assert.equal(d.listed, 0);
  }
  // the key in the wrong place does not count
  const d = deps();
  assert.equal((await post('https://example.com/a', d, { key: null, headers: { authorization: `Bearer ${KEY}` } })).status, 401);
  assert.equal((await handle(new Request(`https://fn.local/quick-save?key=${KEY}`, { method: 'POST', body: 'https://example.com/a' }), d)).status, 401);
  untouched(d);
});

test('a function without a (long enough) key refuses everyone', async () => {
  for (const key of [undefined, '', 'short']) {
    const d = deps({ key });
    for (const given of [key ?? '', '', 'not configured']) {
      const res = await post('https://example.com/a', d, { key: given });
      assert.equal(res.status, 401);
      assert.equal(await res.text(), REFUSED);
    }
    untouched(d);
  }
});

test('only POST is accepted, even with the right key', async () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
    const d = deps();
    const res = await post(method === 'GET' ? undefined : 'https://example.com/a', d, { method });
    assert.equal(res.status, 405, method);
    assert.equal(await res.text(), REFUSED);
    untouched(d);
  }
});

test('anything that is not one http(s) address is rejected and saves nothing', async () => {
  for (const bad of ['', '   ', 'hello', 'example.com', 'ftp://example.com/a', 'javascript:alert(1)', 'file:///etc/passwd',
    'data:text/html,<p>hi', 'shortcuts://run', 'https://', 'look at https://example.com', 'https://a.com https://b.com',
    '{"url": 5}', '{"link": "https://example.com"}', '{broken', '["https://example.com"]', 'https://example.com/' + 'a'.repeat(2100)]) {
    const d = deps();
    const res = await post(bad, d);
    assert.equal(res.status, 400, bad);
    assert.match(await res.text(), /^Not saved: /);
    untouched(d);
  }
});

test('oversized requests are rejected', async () => {
  const d = deps();
  const res = await post('https://example.com/?' + 'a'.repeat(5000), d);
  assert.equal(res.status, 413);
  untouched(d);
});

test('a missing or wrong OWNER_USER_ID is reported (only to someone with the key)', async () => {
  for (const owner of [null, '', 'me', `${OWNER}&select=*`]) {
    const d = deps({ owner });
    const res = await post('https://example.com/a', d);
    assert.equal(res.status, 500);
    assert.match(await res.text(), /OWNER_USER_ID/);
    untouched(d);
    assert.equal((await post('https://example.com/a', d, { key: 'wrong' })).status, 401);
  }
});

test('database trouble gives a clear error instead of "Saved"', async () => {
  const d = deps({ dbDown: true });
  const res = await post('https://example.com/a', d);
  assert.equal(res.status, 500);
  assert.match(await res.text(), /^Not saved: /);
  untouched(d);
});

// ---------------- safety of the preview lookup (same rules as link-preview) ----------------

test('never fetches private or local addresses — the link is saved without a preview', async () => {
  for (const url of ['http://127.0.0.1/admin', 'http://169.254.169.254/latest/meta-data', 'http://router.local/', 'https://example.com:8443/x']) {
    const d = deps();
    assert.equal(await (await post(url, d)).text(), SAVED, url);
    assert.equal(d.fetched.length, 0, url);
    assert.equal(d.rows[0].preview_status, 'none');
  }
  const sneaky = deps({ dns: { 'sneaky.example.com': ['93.184.216.34', '10.0.0.5'] } });
  await post('https://sneaky.example.com/', sneaky);
  assert.equal(sneaky.fetched.length, 0);
  const redirect = deps({ routes: { 'https://example.com/r': new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } }) } });
  await post('https://example.com/r', redirect);
  assert.deepEqual(redirect.fetched, ['https://example.com/r']);
  assert.equal(redirect.rows[0].preview_status, 'none');
});

// ---------------- the small pieces ----------------

test('key comparison', async () => {
  assert.equal(await sameKey('abc', 'abc'), true);
  for (const [a, b] of [['abc', 'abd'], ['abc', 'abcd'], ['', 'abc'], ['abc', ''], ['ABC', 'abc']]) assert.equal(await sameKey(a, b), false);
});

test('linkFromBody cleans tracking parameters and trims', () => {
  assert.equal(linkFromBody('  https://example.com/a?utm_source=x&id=7 \n'), 'https://example.com/a?id=7');
  assert.equal(linkFromBody('"https://example.com/a"'), 'https://example.com/a');
  assert.equal(linkFromBody('HTTPS://Example.com'), 'https://example.com/');
});

// ---------------- the copies still match the originals ----------------

const SAMPLES = [
  'https://example.com', 'http://www.example.com/a/b/?b=2&a=1&utm_source=x#frag', 'https://m.example.com//a//b/', 'https://example.com:8080/x',
  'https://youtu.be/dQw4w9WgXcQ?si=abc', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&feature=share', 'https://youtube.com/shorts/dQw4w9WgXcQ',
  'https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube.com/live/dQw4w9WgXcQ',
  'https://www.youtube.com/@channel', 'https://www.youtube.com/playlist?list=PL123&si=x', 'https://www.youtube.com/watch?v=short',
  'https://x.com/user/status/1234567890123?s=20&t=abc', 'https://twitter.com/user/status/1234567890123', 'https://mobile.twitter.com/user', 'https://fxtwitter.com/user/statuses/1234567890123',
  'https://www.instagram.com/p/Cabc123_-x/?igsh=abc', 'https://instagram.com/reel/Cabc123_-x/', 'https://www.instagram.com/someone/?hl=en', 'https://www.instagram.com/tv/Cabc123_-x',
  'https://www.reddit.com/r/art/comments/1abcde/some_title/?share_id=x', 'https://old.reddit.com/r/art/comments/1ABCDE/', 'https://redd.it/1abcde',
  'https://www.reddit.com/comments/1abcde', 'https://www.reddit.com/r/art/s/AbCdEf123', 'https://np.reddit.com/r/art/', 'https://www.reddit.com/user/x?context=3',
  'https://www.tiktok.com/@user/video/123?_r=1&is_from_webapp=1', 'https://vm.tiktok.com/ZM123/', 'https://example.com/?q=a b&Q=%20&fbclid=1', 'https://EXAMPLE.com./Path',
];

test('duplicate key, clean-up and platform rules are the same as the app\'s (src/links.js)', () => {
  for (const u of SAMPLES) {
    assert.equal(qs.urlKey(u), app.urlKey(u), `urlKey ${u}`);
    assert.equal(qs.cleanUrl(u), app.cleanUrl(u), `cleanUrl ${u}`);
    assert.equal(qs.platformOf(u), app.platformOf(u), `platformOf ${u}`);
  }
  for (const a of SAMPLES) for (const b of SAMPLES) {
    assert.equal(isDuplicate(a, [b]), app.findDuplicates(a, [{ id: 1, url: b }]).length > 0, `${a} vs ${b}`);
  }
});

test('the safety checks and preview lookup are an exact copy of link-preview', () => {
  const read = (p) => readFileSync(new URL(`../supabase/functions/${p}/index.ts`, import.meta.url), 'utf8');
  const between = (s, from, to) => { const i = s.indexOf(from), j = s.indexOf(to, i); assert.ok(i >= 0 && j > i, `${from} … ${to}`); return s.slice(i, j).trim(); };
  const original = read('link-preview'), copy = read('quick-save');
  for (const [from, to] of [
    ['const REQUEST_TIMEOUT_MS', '\ntype Deps'],
    ['// ---------------- IP address checks', '// ---------------- HTTP handler'],
    ['async function resolveDns', '\nasync function getUser'],
  ]) {
    const want = between(original, from, to);
    assert.ok(copy.includes(want), `quick-save is out of step with link-preview (block starting "${from}")`);
  }
});
