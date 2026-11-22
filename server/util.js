export const UA = 'DailyBrief/1.0 (+podcast app)';

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
export async function fetchFeedText(url) {
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

