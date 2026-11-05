// Tests for the Edge Function's safety checks and HTML parsing.
// (Node 22.18+ runs the TypeScript file directly.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicIp, parseIPv6, checkUrl, parseMeta, decodeEntities } from '../supabase/functions/link-preview/index.ts';

test('private, local and special addresses are blocked', () => {
  for (const ip of [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1',
    '0.0.0.0', '224.0.0.1', '255.255.255.255', '192.0.2.10', '198.18.0.1',
    '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
    '64:ff9b::7f00:1', '64:ff9b::192.168.0.1', '2002:c0a8:0101::1', '2001:db8::1', 'not-an-ip',
  ]) assert.equal(isPublicIp(ip), false, ip);
});

test('public addresses are allowed', () => {
  for (const ip of ['1.1.1.1', '8.8.8.8', '142.250.74.46', '172.32.0.1', '2606:4700:4700::1111', '2a00:1450:4001:82b::200e', '::ffff:8.8.8.8'])
    assert.equal(isPublicIp(ip), true, ip);
});

test('IPv6 parsing', () => {
  assert.deepEqual(parseIPv6('::1'), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(parseIPv6('[::ffff:1.2.3.4]').slice(10), [255, 255, 1, 2, 3, 4]);
  assert.equal(parseIPv6('1::2::3'), null);
  assert.equal(parseIPv6('12345::'), null);
});

test('only http(s) on normal ports, no local host names', () => {
  assert.equal(checkUrl('https://example.com/x').hostname, 'example.com');
  for (const bad of ['file:///etc/passwd', 'ftp://example.com', 'gopher://x.y', 'http://localhost/', 'http://printer.local/',
    'http://metadata.google.internal/', 'http://intranet/', 'http://example.com:6379/', 'http://user:pw@example.com/', 'nonsense'])
    assert.throws(() => checkUrl(bad), undefined, bad);
  // tricky IPv4 spellings are normalised by the URL parser, then caught by isPublicIp
  assert.equal(checkUrl('http://0x7f.1/').hostname, '127.0.0.1');
  assert.equal(isPublicIp(checkUrl('http://2130706433/').hostname), false);
});

test('Open Graph parsing', () => {
  const html = `<html><head>
    <title>Fallback &amp; title</title>
    <meta property="og:title" content="A &quot;great&quot; video">
    <meta name='description' content='Plain description'>
    <meta content="/img/cover.jpg" property="og:image" />
    <meta property="og:site_name" content="Example">
    </head><body>…`;
  const p = parseMeta(html, new URL('https://example.com/post/1'));
  assert.equal(p.title, 'A "great" video');
  assert.equal(p.description, 'Plain description');
  assert.equal(p.image, 'https://example.com/img/cover.jpg');
  assert.equal(p.site_name, 'Example');
  const q = parseMeta('<title>Only a title</title><meta property="og:image" content="javascript:alert(1)">', new URL('https://e.com'));
  assert.equal(q.title, 'Only a title');
  assert.equal(q.image, null);
  assert.equal(decodeEntities('&#39;hi&#x21; &hellip;'), "'hi! …");
});
