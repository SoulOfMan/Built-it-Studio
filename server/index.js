import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { parseFeed } from './rss.js';

const PORT = Number(process.env.PORT) || 8787;
const FEED_TTL_MS = 5 * 60 * 1000;
const UA = 'DailyBrief/1.0 (+podcast app)';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

const app = express();
app.disable('x-powered-by');

/** Only allow public http(s) URLs, so the proxy can't be pointed at the server's own network. */
export function checkUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (process.env.ALLOW_PRIVATE_HOSTS === '1') return u; // local testing only
  if (
    h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h === '[::1]' || h.startsWith('[fc') || h.startsWith('[fd') || h.startsWith('[fe80')
  ) return null;
  return u;
}

const feedCache = new Map(); // url -> { at, data }

app.get('/api/feed', async (req, res) => {
  const u = checkUrl(req.query.url);
  if (!u) return res.status(400).json({ error: 'Invalid feed URL' });
  const key = u.toString();
  const hit = feedCache.get(key);
  if (hit && Date.now() - hit.at < FEED_TTL_MS && req.query.fresh !== '1') return res.json(hit.data);
  try {
    const r = await fetch(key, {
      headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) return res.status(502).json({ error: `Feed responded ${r.status}` });
    const data = parseFeed(await r.text(), key);
    feedCache.set(key, { at: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e?.name === 'TimeoutError' ? 'Feed timed out' : (e?.message || 'Could not load feed') });
  }
});

/** Streams episode audio with CORS so the browser can save it for offline playback. */
app.get('/api/audio', async (req, res) => {
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
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`Daily Brief server on http://localhost:${PORT}`));
}

export default app;
