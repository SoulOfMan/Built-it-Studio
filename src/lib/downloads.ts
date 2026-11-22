import { createStore, get, set, del, keys, clear } from 'idb-keyval';
import type { RawEpisode } from './model';

const store = createStore('dailybrief-audio', 'episodes');

export const audioProxyUrl = (url: string) => '/api/audio?url=' + encodeURIComponent(url);

export async function fetchFeed(url: string, fresh = false): Promise<{ title: string; image: string; episodes: RawEpisode[] }> {
  const r = await fetch('/api/feed?url=' + encodeURIComponent(url) + (fresh ? '&fresh=1' : ''));
  const body = await r.json().catch(() => ({ error: `Feed API not reachable (HTTP ${r.status}). The Node server must host /api` }));
  if (!r.ok) throw new Error(body.error || 'Could not load feed');
  return body;
}

export interface PodcastHit { id: string; name: string; author: string; genre: string; image: string; feedUrl: string }

export async function searchPodcasts(q: string, signal?: AbortSignal): Promise<PodcastHit[]> {
  const r = await fetch('/api/search?q=' + encodeURIComponent(q), { signal });
  const body = await r.json().catch(() => ({ error: 'Search is unavailable right now.' }));
  if (!r.ok) throw new Error(body.error || 'Search is unavailable right now.');
  return body.results;
}

/**
 * Downloads an episode through the server proxy and stores it in IndexedDB.
 * Reports progress 0..1; resolves with the stored size in bytes.
 */
export async function downloadEpisode(
  id: string,
  audioUrl: string,
  expectedBytes: number,
  onProgress: (p: number) => void,
  signal: AbortSignal
): Promise<{ blob: Blob; bytes: number }> {
  const r = await fetch(audioProxyUrl(audioUrl), { signal });
  if (!r.ok || !r.body) throw new Error('Download failed (' + r.status + ')');
  const total = Number(r.headers.get('content-length')) || expectedBytes || 0;
  const type = r.headers.get('content-type') || 'audio/mpeg';
  const reader = r.body.getReader();
  const chunks: BlobPart[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.byteLength;
    if (total) onProgress(Math.min(0.99, got / total));
  }
  const blob = new Blob(chunks, { type });
  await set(id, blob, store);
  return { blob, bytes: blob.size };
}

export const getBlob = (id: string) => get<Blob>(id, store);
export const removeBlob = (id: string) => del(id, store);
export const savedIds = () => keys(store) as Promise<string[]>;
export const clearBlobs = () => clear(store);

/** Ask the browser not to evict downloads under storage pressure. */
export async function requestPersistence() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* ignore */ }
}

export async function storageAvailable(): Promise<number | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e?.quota) return null;
    return e.quota - (e.usage || 0);
  } catch { return null; }
}
