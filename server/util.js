export const UA = 'Labari/1.0 (+podcast app)';

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


const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ACCEPT = 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8';

/** Some CDNs (e.g. BBC) reject unknown user agents or blip with 403/5xx: retry with a browser UA. */
async function fetchText(url) {
  let lastErr;
  for (const ua of [UA, BROWSER_UA, BROWSER_UA]) {
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': ua, accept: ACCEPT, 'accept-language': 'en-GB,en;q=0.9' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000)
      });
      if (r.ok) return await r.text();
      lastErr = new Error(`Feed responded ${r.status}`);
      if (r.status === 404 || r.status === 410) break; // genuinely gone
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}


const looksLikeFeed = t => /<(rss|feed|rdf:RDF)[\s>]/i.test(t.slice(0, 3000));

/**
 * Fetches a feed and returns { xml, url }. If the URL is a web page instead (or an Apple Podcasts link),
 * finds the real RSS address from the page's <link rel="alternate"> or the iTunes lookup API.
 */
export async function fetchFeedText(url) {
  const apple = url.match(/podcasts\.apple\.com\/.*\/id(\d+)/);
  if (apple) {
    const r = JSON.parse(await fetchText(`https://itunes.apple.com/lookup?id=${apple[1]}&entity=podcast`));
    const feedUrl = r?.results?.[0]?.feedUrl;
    if (!feedUrl) throw new Error('Could not find the RSS feed for that Apple Podcasts link');
    return fetchFeedText(feedUrl);
  }
  const text = await fetchText(url);
  if (looksLikeFeed(text)) return text;
  const link = text.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i)?.[0];
  const href = link?.match(/href=["']([^"']+)["']/i)?.[1];
  if (href) {
    const next = new URL(href, url).toString();
    if (checkUrl(next) && next !== url) return fetchText(next);
  }
  throw new Error('That address is a web page, not an RSS feed');
}

/** Shape iTunes Search API results into what the app needs. Only shows with a public RSS address are kept. */
export function mapSearch(json) {
  return (json?.results || [])
    .filter(r => r.feedUrl && r.collectionName)
    .map(r => ({
      id: String(r.collectionId),
      name: r.collectionName,
      author: r.artistName || '',
      genre: r.primaryGenreName || '',
      image: r.artworkUrl100 || r.artworkUrl60 || '',
      feedUrl: r.feedUrl
    }));
}

/** Search the free iTunes Search API (no key needed) for podcasts. */
export async function searchPodcasts(term) {
  const q = String(term || '').trim().slice(0, 100);
  if (q.length < 2) return [];
  const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=20&term=${encodeURIComponent(q)}`;
  return mapSearch(JSON.parse(await fetchText(url)));
}
