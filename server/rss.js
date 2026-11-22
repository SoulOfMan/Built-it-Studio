import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  trimValues: true,
  processEntities: true,
  htmlEntities: true
});

const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = v => {
  if (v == null) return '';
  if (typeof v === 'object') return String(v['#text'] ?? '');
  return String(v);
};

/** Parse "1:02:03", "12:34", "754" or "754.2" into seconds. */
export function parseDuration(v) {
  const s = text(v).trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const parts = s.split(':').map(Number);
  if (parts.some(n => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Turn an RSS 2.0 / iTunes podcast feed (or Atom with enclosures) into a compact JSON shape. */
export function parseFeed(xml, feedUrl) {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel ?? doc?.feed;
  if (!channel) throw new Error('Not an RSS or Atom feed');

  const title = text(channel.title) || new URL(feedUrl).hostname;
  const image =
    channel['itunes:image']?.['@href'] ||
    text(channel.image?.url) ||
    '';

  const items = arr(channel.item ?? channel.entry);
  const episodes = [];
  for (const it of items) {
    let enc = arr(it.enclosure)[0];
    if (!enc && it.link) {
      enc = arr(it.link).find(l => l?.['@rel'] === 'enclosure');
      if (enc) enc = { '@url': enc['@href'], '@type': enc['@type'], '@length': enc['@length'] };
    }
    const audioUrl = enc?.['@url'];
    if (!audioUrl) continue;
    const pub = text(it.pubDate ?? it.published ?? it.updated);
    const ts = Date.parse(pub);
    episodes.push({
      guid: text(it.guid) || audioUrl,
      title: text(it.title) || 'Untitled episode',
      audioUrl,
      type: enc['@type'] || 'audio/mpeg',
      bytes: Number(enc['@length']) || 0,
      duration: parseDuration(it['itunes:duration']),
      published: Number.isNaN(ts) ? 0 : ts,
      image: it['itunes:image']?.['@href'] || ''
    });
  }
  episodes.sort((a, b) => b.published - a.published);
  return { title, image, episodes: episodes.slice(0, 10) };
}
