// Tests for the Edge Function (supabase/functions/link-preview/index.ts).
// Runs in Node with type stripping: see "test" in package.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, checkUrl, parseMeta, handle, readCapped } from '../supabase/functions/link-preview/index.ts';

test('private and local addresses are recognised', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1',
    '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fd12:3456::1', 'fc00::1', '::ffff:127.0.0.1',
    '::ffff:7f00:1', '64:ff9b::a9fe:a9fe', 'ff02::1', '2001:db8::1', 'not-an-ip']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '142.250.74.46', '2606:4700::1111', '2a00:1450:4001:82a::200e', '::ffff:8.8.8.8']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('only public http(s) URLs on normal ports', () => {
  assert.ok(checkUrl('https://example.com/a'));
  assert.ok(checkUrl('http://example.com:80/'));
  for (const bad of ['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'http://localhost/', 'http://127.0.0.1/',
    'http://2130706433/', 'http://0x7f.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://10.0.0.1/', 'http://intranet/',
    'http://printer.local/', 'https://example.com:8443/', 'http://user:pw@example.com/', 'http://169.254.169.254/latest/meta-data']) {
    assert.throws(() => checkUrl(bad), undefined, bad);
  }
});

test('Open Graph parsing', () => {
  const html = `<html><head><title>Fallback &amp; title</title>
    <meta property="og:title" content="Knight &quot;Concept&quot; Art">
    <meta name="description" content="Plain description">
    <meta property="og:description" content='OG description'>
    <meta content="/img/cover.jpg" property="og:image">
    <meta property="og:site_name" content="ArtStation"></head><body>…</body></html>`;
  const m = parseMeta(html, new URL('https://www.artstation.com/artwork/abc'));
  assert.deepEqual(m, {
    title: 'Knight "Concept" Art', description: 'OG description',
    image: 'https://www.artstation.com/img/cover.jpg', site_name: 'ArtStation',
  });
  assert.equal(parseMeta('<title>Only title</title>', new URL('https://a.com')).title, 'Only title');
  assert.equal(parseMeta('<meta property="og:image" content="javascript:alert(1)">', new URL('https://a.com')).image, null);
});

test('response size is capped', async () => {
  const big = 'x'.repeat(2_000_000);
  const text = await readCapped(new Response(big), 1000);
  assert.equal(text.length, 1000);
});

// ---------------- the HTTP handler with fake network ----------------
const user = { id: 'u1' };
const page = (html, headers = {}) => new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
function deps({ dns = {}, routes = {}, loggedIn = true } = {}) {
  const calls = [];
  return {
    calls,
    getUser: async () => (loggedIn ? user : null),
    resolve: async (host) => dns[host] ?? ['93.184.216.34'],
    fetch: async (url, opts) => {
      calls.push(url);
      assert.equal(opts.redirect, 'manual');
      const r = routes[url];
      if (!r) return new Response('not found', { status: 404 });
      return typeof r === 'function' ? r() : r;
    },
  };
}
const call = (body, d, headers = { authorization: 'Bearer token', origin: 'https://tkz-design.github.io' }) =>
  handle(new Request('https://fn.local/link-preview', { method: 'POST', headers, body: JSON.stringify(body) }), d);

test('requires a logged-in user', async () => {
  const res = await call({ url: 'https://example.com' }, deps({ loggedIn: false }));
  assert.equal(res.status, 401);
});

test('CORS preflight', async () => {
  const res = await handle(new Request('https://fn.local/', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }), deps());
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('happy path returns the preview', async () => {
  const d = deps({ routes: { 'https://example.com/post': page('<meta property="og:title" content="Hello"><meta property="og:image" content="https://cdn.example.com/a.jpg"></head>') } });
  const res = await call({ url: 'https://example.com/post' }, d);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.title, 'Hello');
  assert.equal(body.image, 'https://cdn.example.com/a.jpg');
});

test('blocks hosts that resolve to private addresses (DNS)', async () => {
  const d = deps({ dns: { 'sneaky.example.com': ['93.184.216.34', '10.0.0.5'] } });
  const res = await call({ url: 'https://sneaky.example.com/' }, d);
  assert.equal(res.status, 400);
  assert.equal(d.calls.length, 0, 'nothing was fetched');
});

test('blocks redirects to private addresses', async () => {
  const d = deps({ routes: { 'https://example.com/r': new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } }) } });
  const res = await call({ url: 'https://example.com/r' }, d);
  assert.equal(res.status, 400);
  assert.deepEqual(d.calls, ['https://example.com/r']);
});

test('follows a few public redirects, then gives up', async () => {
  const routes = {};
  for (let i = 0; i < 10; i++) routes[`https://example.com/${i}`] = () => new Response(null, { status: 301, headers: { location: `/${i + 1}` } });
  const res = await call({ url: 'https://example.com/0' }, deps({ routes }));
  assert.equal(res.status, 502);
});

test('rejects non-http links and bad bodies', async () => {
  assert.equal((await call({ url: 'file:///etc/passwd' }, deps())).status, 400);
  assert.equal((await call({}, deps())).status, 400);
  const res = await handle(new Request('https://fn.local/', { method: 'POST', headers: { authorization: 'Bearer t' }, body: 'nope' }), deps());
  assert.equal(res.status, 400);
});

test('non-HTML responses give an empty preview, not an error', async () => {
  const d = deps({ routes: { 'https://example.com/file.zip': new Response('PK', { headers: { 'content-type': 'application/zip' } }) } });
  const body = await (await call({ url: 'https://example.com/file.zip' }, d)).json();
  assert.equal(body.ok, true);
  assert.equal(body.title, '');
  assert.equal(body.image, null);
});
