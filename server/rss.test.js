import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, parseDuration } from './rss.js';
import { checkUrl } from './index.js';

const XML = `<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>Test News &amp; Views</title>
  <itunes:image href="https://example.com/art.jpg"/>
  <item>
    <title>Older story</title>
    <guid>a1</guid>
    <pubDate>Fri, 20 Nov 2026 06:00:00 GMT</pubDate>
    <enclosure url="https://cdn.example.com/a1.mp3" length="4800000" type="audio/mpeg"/>
    <itunes:duration>05:00</itunes:duration>
  </item>
  <item>
    <title>Newest story</title>
    <guid isPermaLink="false">b2</guid>
    <pubDate>Sun, 22 Nov 2026 06:00:00 GMT</pubDate>
    <enclosure url="https://cdn.example.com/b2.mp3" length="0" type="audio/mpeg"/>
    <itunes:duration>1:02:03</itunes:duration>
  </item>
  <item><title>No audio, skipped</title></item>
</channel></rss>`;

test('parses an iTunes podcast feed', () => {
  const f = parseFeed(XML, 'https://example.com/feed.xml');
  assert.equal(f.title, 'Test News & Views');
  assert.equal(f.image, 'https://example.com/art.jpg');
  assert.equal(f.episodes.length, 2);
  assert.equal(f.episodes[0].title, 'Newest story');
  assert.equal(f.episodes[0].guid, 'b2');
  assert.equal(f.episodes[0].duration, 3723);
  assert.equal(f.episodes[1].bytes, 4800000);
});

test('parses durations', () => {
  assert.equal(parseDuration('754'), 754);
  assert.equal(parseDuration('12:34'), 754);
  assert.equal(parseDuration(''), 0);
});

test('rejects non-feeds', () => {
  assert.throws(() => parseFeed('<html></html>', 'https://x.com'));
});

test('blocks private and non-http URLs', () => {
  assert.equal(checkUrl('http://localhost:3000/x'), null);
  assert.equal(checkUrl('http://192.168.1.4/feed'), null);
  assert.equal(checkUrl('file:///etc/passwd'), null);
  assert.ok(checkUrl('https://feeds.megaphone.fm/x'));
});

test('trimFeed keeps the first entries and still parses big feeds', async () => {
  const { trimFeed, parseFeed } = await import('./rss.js');
  const items = Array.from({ length: 200 }, (_, i) => `<item><title>T${i} &nbsp;&eacute;</title><enclosure url="http://x/${i}.mp3"/></item>`).join('');
  const xml = `<rss><channel><title>Big</title>${items}</channel></rss>`;
  assert.ok(trimFeed(xml).length < xml.length);
  assert.equal(parseFeed(xml, 'http://x/feed').episodes.length, 10);
});

test('mapSearch keeps only shows with a feed URL', async () => {
  const { mapSearch } = await import('./util.js');
  const out = mapSearch({ results: [
    { collectionId: 1, collectionName: 'A', artistName: 'X', primaryGenreName: 'News', artworkUrl100: 'i', feedUrl: 'https://f/a.rss' },
    { collectionId: 2, collectionName: 'No feed' }
  ] });
  assert.deepEqual(out.map(r => r.name), ['A']);
  assert.equal(out[0].feedUrl, 'https://f/a.rss');
});
