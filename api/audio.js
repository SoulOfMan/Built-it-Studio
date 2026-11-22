import { Readable } from 'node:stream';
import { checkUrl, UA } from '../server/util.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const u = checkUrl(req.query.url);
  if (!u) return res.status(400).json({ error: 'Invalid audio URL' });
  const ac = new AbortController();
  req.on('close', () => ac.abort());
  try {
    const headers = { 'user-agent': UA };
    if (req.headers.range) headers.range = req.headers.range;
    const r = await fetch(u, { headers, redirect: 'follow', signal: ac.signal });
    if (!r.ok && r.status !== 206) return res.status(502).json({ error: `Audio responded ${r.status}` });
    res.status(r.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = r.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader('cache-control', 'no-store');
    Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: e?.message || 'Could not load audio' });
    else res.destroy();
  }
}
