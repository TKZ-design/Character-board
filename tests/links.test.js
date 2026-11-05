import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractUrl, normalizeUrl, detectPlatform, youtubeStart, domainOf, matchesLinkSearch } from '../src/linkutil.js';

test('extractUrl finds the link inside shared text', () => {
  assert.equal(extractUrl('Look at this https://youtu.be/dQw4w9WgXcQ?si=abc !'), 'https://youtu.be/dQw4w9WgXcQ?si=abc');
  assert.equal(extractUrl('(see https://en.wikipedia.org/wiki/Foo_(bar))'), 'https://en.wikipedia.org/wiki/Foo_(bar)');
  assert.equal(extractUrl('https://example.com/a.'), 'https://example.com/a');
  assert.equal(extractUrl('example.com/page'), 'https://example.com/page');
  assert.equal(extractUrl('hello world'), null);
  assert.equal(extractUrl(''), null);
});

test('YouTube: watch, youtu.be, shorts, embed and live all give the same id', () => {
  const id = 'dQw4w9WgXcQ';
  for (const u of [
    `https://www.youtube.com/watch?v=${id}&feature=share`,
    `https://youtu.be/${id}?si=xyz`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}?si=1`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://music.youtube.com/watch?v=${id}&list=RD`,
  ]) {
    const p = detectPlatform(u);
    assert.equal(p.platform, 'youtube', u);
    assert.equal(p.id, id, u);
    assert.equal(normalizeUrl(u).key, `youtube:${id}`, u);
  }
  assert.equal(detectPlatform(`https://youtube.com/shorts/${id}`).kind, 'short');
  assert.equal(detectPlatform('https://www.youtube.com/@somechannel').id, undefined);
  assert.equal(youtubeStart(`https://youtu.be/${id}?t=90`), 90);
  assert.equal(youtubeStart(`https://youtube.com/watch?v=${id}&t=1m30s`), 90);
});

test('X, Instagram and Reddit are recognised by post id', () => {
  assert.deepEqual(
    [normalizeUrl('https://x.com/someone/status/1234567890123?s=20&t=abc').key, normalizeUrl('https://twitter.com/someone/status/1234567890123').key],
    ['x:1234567890123', 'x:1234567890123']);
  assert.equal(normalizeUrl('https://x.com/someone/status/1234567890123?s=20&t=abc').url, 'https://x.com/someone/status/1234567890123');
  assert.equal(normalizeUrl('https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=MWQ1ZGUxMzBkMA==').key, 'instagram:C1a2B3c4D5e');
  assert.equal(normalizeUrl('https://www.instagram.com/reel/C1a2B3c4D5e/?igsh=MWQ1ZGUxMzBkMA==').url, 'https://www.instagram.com/reel/C1a2B3c4D5e/');
  assert.equal(normalizeUrl('https://instagram.com/p/C1a2B3c4D5e').key, 'instagram:C1a2B3c4D5e');
  assert.equal(detectPlatform('https://www.instagram.com/reel/C1a2B3c4D5e/').kind, 'reel');
  const r = 'https://www.reddit.com/r/Art/comments/1abcde/my_painting/?utm_source=share&utm_medium=ios_app';
  assert.equal(normalizeUrl(r).key, 'reddit:1abcde');
  assert.equal(normalizeUrl('https://old.reddit.com/r/Art/comments/1abcde/').key, 'reddit:1abcde');
  assert.equal(normalizeUrl(r).url, 'https://www.reddit.com/r/Art/comments/1abcde/my_painting/');
});

test('generic links: tracking removed, order/www/trailing slash/fragment ignored', () => {
  const a = normalizeUrl('https://www.Example.com/Article/?utm_source=x&b=2&a=1&fbclid=zzz#top');
  const b = normalizeUrl('example.com/article?a=1&b=2');
  assert.equal(a.key, b.key);
  assert.equal(a.url, 'https://www.example.com/Article/?b=2&a=1#top');
  assert.notEqual(normalizeUrl('https://example.com/a?id=1').key, normalizeUrl('https://example.com/a?id=2').key);
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('ftp://example.com/file'), null);
  assert.equal(normalizeUrl('not a link'), null);
  assert.equal(domainOf('https://www.artstation.com/x'), 'artstation.com');
});

test('vault search', () => {
  const l = { title: 'Lighting tutorial', url: 'https://youtu.be/x', site_name: 'YouTube', notes: 'rim light', description: '' };
  assert.ok(matchesLinkSearch(l, 'light'));
  assert.ok(matchesLinkSearch(l, 'RIM'));
  assert.ok(!matchesLinkSearch(l, 'zebra'));
  assert.ok(matchesLinkSearch(l, ' '));
});
