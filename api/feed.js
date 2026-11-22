import { parseFeed } from '../server/rss.js';
import { checkUrl, fetchFeedText } from '../server/util.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const u = checkUrl(req.query.url);
  if (!u) return res.status(400).json({ error: 'Invalid feed URL' });
  try {
    const data = parseFeed(await fetchFeedText(u.toString()), u.toString());
    res.setHeader('cache-control', req.query.fresh === '1' ? 'no-store' : 's-maxage=300, stale-while-revalidate=3600');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: e?.name === 'TimeoutError' ? 'Feed timed out' : (e?.message || 'Could not load feed') });
  }
}
