import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUrl, cleanUrl, urlKey, platformOf, youtubeInfo, embedInfo, domainOf, findDuplicates, linkMatches } from '../src/links.js';

test('parseUrl finds the link in shared text', () => {
  assert.equal(parseUrl('Look at this https://youtu.be/dQw4w9WgXcQ?si=abc!'), 'https://youtu.be/dQw4w9WgXcQ?si=abc');
  assert.equal(parseUrl('youtu.be/dQw4w9WgXcQ'), 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(parseUrl('(https://example.com/a)'), 'https://example.com/a');
  assert.equal(parseUrl('  https://x.com/a/status/123456789  '), 'https://x.com/a/status/123456789');
  assert.equal(parseUrl('not a link'), null);
  assert.equal(parseUrl('javascript:alert(1)'), null);
  assert.equal(parseUrl('ftp://example.com/file'), null);
  assert.equal(parseUrl(''), null);
});

test('platform detection', () => {
  assert.equal(platformOf('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(platformOf('https://m.youtube.com/shorts/dQw4w9WgXcQ'), 'youtube');
  assert.equal(platformOf('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(platformOf('https://twitter.com/a/status/1'), 'x');
  assert.equal(platformOf('https://x.com/a/status/1'), 'x');
  assert.equal(platformOf('https://www.instagram.com/reel/Cabc123/'), 'instagram');
  assert.equal(platformOf('https://old.reddit.com/r/art/comments/abc/x/'), 'reddit');
  assert.equal(platformOf('https://notyoutube.com/watch?v=x'), 'web');
  assert.equal(platformOf('https://evil-youtube.com.example.org/'), 'web');
  assert.equal(domainOf('https://www.artstation.com/a'), 'artstation.com');
});

test('YouTube IDs from every link shape', () => {
  const id = 'dQw4w9WgXcQ';
  for (const u of [
    `https://youtu.be/${id}`, `https://youtu.be/${id}?si=XYZ`, `https://www.youtube.com/watch?v=${id}&list=PL1`,
    `https://m.youtube.com/watch?v=${id}`, `https://youtube.com/shorts/${id}?feature=share`, `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`, `https://music.youtube.com/watch?v=${id}`, `https://www.youtube-nocookie.com/embed/${id}`,
  ]) assert.equal(youtubeInfo(u)?.id, id, u);
  assert.equal(youtubeInfo(`https://youtube.com/shorts/${id}`).shorts, true);
  assert.equal(youtubeInfo(`https://youtu.be/${id}?t=90`).start, 90);
  assert.equal(youtubeInfo(`https://www.youtube.com/watch?v=${id}&t=1m30s`).start, 90);
  assert.equal(youtubeInfo('https://www.youtube.com/@channel'), null);
  assert.equal(youtubeInfo('https://www.youtube.com/watch?v=short'), null);
});

test('embed info for X, Instagram, Reddit', () => {
  assert.deepEqual(embedInfo('https://x.com/artist/status/1790000000000000000?s=20'), { kind: 'x', id: '1790000000000000000' });
  assert.deepEqual(embedInfo('https://twitter.com/i/web/status/123456789'), { kind: 'x', id: '123456789' });
  assert.equal(embedInfo('https://x.com/artist'), null);
  assert.deepEqual(embedInfo('https://www.instagram.com/reel/C7abcDEF12/?igsh=xyz'), { kind: 'instagram', code: 'C7abcDEF12', type: 'reel' });
  assert.deepEqual(embedInfo('https://www.instagram.com/p/C7abcDEF12/'), { kind: 'instagram', code: 'C7abcDEF12', type: 'p' });
  assert.deepEqual(embedInfo('https://www.reddit.com/r/ImaginaryCharacters/comments/1abc2d/cool_knight/?share_id=1'),
    { kind: 'reddit', path: '/r/ImaginaryCharacters/comments/1abc2d/cool_knight/' });
  assert.equal(embedInfo('https://www.reddit.com/r/art/s/AbCdEf'), null);
  assert.equal(embedInfo('https://example.com/'), null);
});

test('cleanUrl drops tracking parameters only', () => {
  assert.equal(cleanUrl('https://youtu.be/dQw4w9WgXcQ?si=abc&t=30'), 'https://youtu.be/dQw4w9WgXcQ?t=30');
  assert.equal(cleanUrl('https://www.instagram.com/reel/Cabc123/?igsh=MTc4'), 'https://www.instagram.com/reel/Cabc123/');
  assert.equal(cleanUrl('https://example.com/a?utm_source=x&utm_medium=y&page=2#top'), 'https://example.com/a?page=2#top');
  assert.equal(cleanUrl('https://github.com/a/b?ref=main'), 'https://github.com/a/b?ref=main'); // ref is meaningful here
  assert.equal(cleanUrl('https://x.com/a/status/1?s=20&t=abc'), 'https://x.com/a/status/1');
});

test('duplicate keys ignore tracking, www, http and link shape', () => {
  const same = (a, b) => assert.equal(urlKey(a), urlKey(b), `${a}  vs  ${b}`);
  const diff = (a, b) => assert.notEqual(urlKey(a), urlKey(b), `${a}  vs  ${b}`);
  same('https://youtu.be/dQw4w9WgXcQ?si=abc', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share');
  same('https://youtube.com/shorts/dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10');
  same('https://twitter.com/artist/status/123456789?s=20', 'https://x.com/artist/status/123456789');
  same('https://www.instagram.com/reel/C7abcDEF12/?igsh=xyz', 'https://instagram.com/p/C7abcDEF12');
  same('https://old.reddit.com/r/art/comments/1abc2d/title/', 'https://www.reddit.com/r/art/comments/1abc2d/?share_id=9&utm_source=share');
  same('https://redd.it/1abc2d', 'https://reddit.com/comments/1abc2d');
  same('http://www.example.com/page/?b=2&a=1&utm_campaign=z', 'https://example.com/page?a=1&b=2');
  diff('https://example.com/page?id=1', 'https://example.com/page?id=2');
  diff('https://youtu.be/dQw4w9WgXcQ', 'https://youtu.be/aaaaaaaaaaa');
  diff('https://example.com/a', 'https://example.org/a');
});

test('findDuplicates and search', () => {
  const links = [
    { id: 1, url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Run cycle tutorial', platform: 'youtube' },
    { id: 2, url: 'https://example.com/x', title: 'Armor refs', notes: 'great helmets', platform: 'web' },
  ];
  assert.deepEqual(findDuplicates('https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=1', links).map((l) => l.id), [1]);
  assert.deepEqual(findDuplicates('https://youtu.be/dQw4w9WgXcQ', links, 1), []);
  assert.ok(linkMatches(links[1], 'helmet'));
  assert.ok(linkMatches(links[0], 'youtube'));
  assert.ok(!linkMatches(links[0], 'armor'));
});
