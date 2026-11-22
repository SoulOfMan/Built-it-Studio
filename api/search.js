import { searchPodcasts } from '../server/util.js';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  try {
    res.setHeader('cache-control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ results: await searchPodcasts(req.query.q) });
  } catch {
    res.status(502).json({ error: 'Search is unavailable right now. Try again in a moment.' });
  }
}
