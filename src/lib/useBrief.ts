import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Episode, type Feed, type Persisted, type Tab,
  episodesFor, abbrev, validUrl
} from './model';
import { loadState, saveState, prune } from './persist';
import {
  fetchFeed, downloadEpisode, getBlob, removeBlob, savedIds, clearBlobs,
  requestPersistence, storageAvailable
} from './downloads';

const STALE_MS = 15 * 60 * 1000;
const MAX_PARALLEL_DOWNLOADS = 2;

export function useBrief() {
  const [p, setP] = useState<Persisted>(() => prune(loadState()));
  const [tab, setTab] = useState<Tab>('queue');
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hidePlayed, setHidePlayed] = useState(() => localStorage.getItem('dailybrief.hidePlayed') === '1');
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [dl, setDl] = useState<Record<string, number>>({}); // in-progress downloads, 0..1
  const [dlError, setDlError] = useState<Record<string, string>>({});
  const [playError, setPlayError] = useState('');
  const [available, setAvailable] = useState<number | null>(null);

  const pRef = useRef(p); pRef.current = p;
  const audio = useRef<HTMLAudioElement>(null as unknown as HTMLAudioElement);
  if (!audio.current) { audio.current = new Audio(); audio.current.preload = 'metadata'; }
  const loadedId = useRef<string | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const blobUrls = useRef<Record<string, string>>({});
  const controllers = useRef<Record<string, AbortController>>({});
  const dlQueue = useRef<string[]>([]);

  // ---------- persistence ----------
  useEffect(() => { saveState(p); }, [p]);
  useEffect(() => {
    const flush = () => saveState(pRef.current, true);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); };
  }, []);
  useEffect(() => { localStorage.setItem('dailybrief.hidePlayed', hidePlayed ? '1' : '0'); }, [hidePlayed]);

  // ---------- derived ----------
  const allEpisodes = useMemo(
    () => p.feeds.flatMap((f, i) => episodesFor(f, i, p.cache[f.id], p.durations)),
    [p.feeds, p.cache, p.durations]
  );
  const queue = useMemo(() => {
    const q = p.feeds.flatMap((f, i) => episodesFor(f, i, p.cache[f.id], p.durations).slice(0, p.perFeed));
    if (p.sort === 'time') q.sort((a, b) => b.published - a.published);
    return q;
  }, [p.feeds, p.cache, p.durations, p.perFeed, p.sort]);

  const findEp = useCallback((id: string | null): Episode | null => {
    if (!id) return null;
    const s = pRef.current;
    const live = s.feeds.flatMap((f, i) => episodesFor(f, i, s.cache[f.id], s.durations)).find(e => e.id === id);
    return live || s.saved[id] || null;
  }, []);

  const queueRef = useRef(queue); queueRef.current = queue;
  const nextUnplayed = useCallback((afterId: string, played: Record<string, true>) => {
    const q = queueRef.current;
    const i = q.findIndex(e => e.id === afterId);
    for (let k = i + 1; k < q.length; k++) if (!played[q[k].id]) return q[k];
    return null;
  }, []);

  // ---------- saved downloads: restore object URLs ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = await savedIds().catch(() => [] as string[]);
      const s = pRef.current;
      for (const id of ids) {
        if (!s.saved[id]) { await removeBlob(id); continue; } // orphan blob
        const b = await getBlob(id);
        if (b && alive) blobUrls.current[id] = URL.createObjectURL(b);
      }
      // metadata without a blob (e.g. browser evicted storage): forget it
      const have = new Set(ids);
      const lost = Object.keys(s.saved).filter(id => !have.has(id));
      if (lost.length && alive) setP(st => { const saved = { ...st.saved }; lost.forEach(id => delete saved[id]); return { ...st, saved }; });
      storageAvailable().then(v => alive && setAvailable(v));
    })();
    return () => { alive = false; };
  }, []);

  // ---------- feeds ----------
  const refresh = useCallback(async (fresh = true) => {
    if (!navigator.onLine) return;
    setRefreshing(true);
    const feeds = pRef.current.feeds;
    const results = await Promise.all(feeds.map(f =>
      fetchFeed(f.url, fresh).then(d => ({ id: f.id, d, err: '' }), (e: Error) => ({ id: f.id, d: null, err: e.message }))
    ));
    setP(st => {
      const cache = { ...st.cache };
      for (const r of results) {
        if (r.d) cache[r.id] = { at: Date.now(), title: r.d.title, image: r.d.image, episodes: r.d.episodes };
        else cache[r.id] = { ...(cache[r.id] || { at: 0, title: '', image: '', episodes: [] }), error: r.err };
      }
      return prune({ ...st, cache, updatedAt: Date.now() });
    });
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (Date.now() - pRef.current.updatedAt > STALE_MS) refresh(false);
    const on = () => { setOnline(true); if (Date.now() - pRef.current.updatedAt > STALE_MS) refresh(false); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [refresh]);

  const addFeed = useCallback(async (url: string): Promise<string | null> => {
    const u = url.trim();
    if (!validUrl(u)) return 'Enter a valid feed URL starting with https://';
    if (pRef.current.feeds.some(f => f.url === u)) return 'This feed is already in your list.';
    if (!navigator.onLine) return 'You’re offline. Connect to add a feed.';
    try {
      const d = await fetchFeed(u, true);
      if (!d.episodes.length) return 'That feed has no audio episodes.';
      const id = 'c' + Date.now().toString(36);
      const name = d.title || u;
      const f: Feed = { id, name, cat: 'Custom', ab: abbrev(name), url: u };
      setP(st => ({ ...st, feeds: [...st.feeds, f], cache: { ...st.cache, [id]: { at: Date.now(), title: d.title, image: d.image, episodes: d.episodes } } }));
      return null;
    } catch (e) {
      return (e as Error).message || 'Could not load that feed.';
    }
  }, []);

  const updateFeed = useCallback((id: string, name: string, url: string) => {
    const prev = pRef.current.feeds.find(f => f.id === id);
    setP(st => ({ ...st, feeds: st.feeds.map(f => f.id === id ? { ...f, name, url, ab: f.cat === 'Custom' ? abbrev(name) : f.ab } : f) }));
    if (prev && prev.url !== url) {
      fetchFeed(url, true).then(
        d => setP(st => ({ ...st, cache: { ...st.cache, [id]: { at: Date.now(), title: d.title, image: d.image, episodes: d.episodes } } })),
        (e: Error) => setP(st => ({ ...st, cache: { ...st.cache, [id]: { at: 0, title: '', image: '', episodes: [], error: e.message } } }))
      );
    }
  }, []);

  const deleteFeed = useCallback((id: string) => {
    setP(st => { const cache = { ...st.cache }; delete cache[id]; return { ...st, feeds: st.feeds.filter(f => f.id !== id), cache }; });
  }, []);

  const reorderFeeds = useCallback((feeds: Feed[]) => setP(st => ({ ...st, feeds })), []);

  // ---------- audio ----------
  const loadInto = useCallback((ep: Episode) => {
    const a = audio.current;
    if (loadedId.current === ep.id) return;
    loadedId.current = ep.id;
    setPlayError('');
    a.src = blobUrls.current[ep.id] || ep.audioUrl;
    a.playbackRate = a.defaultPlaybackRate = pRef.current.speed;
    const at = pRef.current.pos[ep.id] || 0;
    pendingSeek.current = at > 0 && at < ep.dur - 2 ? at : null;
  }, []);

  const startPlayback = useCallback(() => {
    const a = audio.current;
    a.play().catch(err => {
      if (err?.name === 'AbortError') return;
      setPlaying(false);
      setPlayError(navigator.onLine ? 'Couldn’t play this episode.' : 'You’re offline and this episode isn’t downloaded.');
    });
  }, []);

  const play = useCallback((id: string) => {
    const ep = findEp(id); if (!ep) return;
    setP(st => {
      if (!st.played[id]) return { ...st, currentId: id };
      const played = { ...st.played }; delete played[id];
      return { ...st, currentId: id, played, pos: { ...st.pos, [id]: 0 } };
    });
    if (pRef.current.played[id]) { pRef.current = { ...pRef.current, pos: { ...pRef.current.pos, [id]: 0 } }; loadedId.current = null; }
    loadInto(ep);
    startPlayback();
  }, [findEp, loadInto, startPlayback]);

  const toggle = useCallback(() => {
    const a = audio.current;
    const id = pRef.current.currentId;
    if (!id) return;
    if (!a.paused) { a.pause(); return; }
    const ep = findEp(id); if (!ep) return;
    loadInto(ep);
    startPlayback();
  }, [findEp, loadInto, startPlayback]);

  const finish = useCallback((id: string) => {
    const ep = findEp(id);
    const played = { ...pRef.current.played, [id]: true as const };
    const nx = nextUnplayed(id, played);
    setP(st => ({ ...st, played: { ...st.played, [id]: true }, pos: { ...st.pos, [id]: ep?.dur || st.pos[id] || 0 }, currentId: nx ? nx.id : st.currentId }));
    if (nx && pRef.current.autoplay) { pRef.current = { ...pRef.current, played, currentId: nx.id }; loadInto(nx); startPlayback(); }
    else { pRef.current = { ...pRef.current, played, currentId: nx ? nx.id : pRef.current.currentId }; setPlaying(false); }
  }, [findEp, nextUnplayed, loadInto, startPlayback]);

  const seek = useCallback((v: number) => {
    const id = pRef.current.currentId; const ep = findEp(id); if (!ep || !id) return;
    const dur = Number.isFinite(audio.current.duration) ? audio.current.duration : ep.dur;
    const t = Math.max(0, Math.min(dur, v));
    if (t >= dur - 0.25) { finish(id); return; }
    if (loadedId.current === id && audio.current.readyState > 0) audio.current.currentTime = t;
    else pendingSeek.current = t;
    setP(st => ({ ...st, pos: { ...st.pos, [id]: t } }));
  }, [findEp, finish]);

  const setSpeed = useCallback((v: number) => {
    audio.current.playbackRate = audio.current.defaultPlaybackRate = v;
    setP(st => ({ ...st, speed: v }));
  }, []);

  // audio element events
  useEffect(() => {
    const a = audio.current;
    const onMeta = () => {
      const id = loadedId.current; if (!id) return;
      if (pendingSeek.current != null) { a.currentTime = pendingSeek.current; pendingSeek.current = null; }
      if (Number.isFinite(a.duration) && a.duration > 0) {
        const d = Math.round(a.duration);
        setP(st => st.durations[id] === d ? st : { ...st, durations: { ...st.durations, [id]: d } });
      }
    };
    const onTime = () => {
      const id = loadedId.current; if (!id || pendingSeek.current != null) return;
      const t = a.currentTime;
      setP(st => Math.abs((st.pos[id] || 0) - t) < 0.2 ? st : { ...st, pos: { ...st.pos, [id]: t } });
    };
    const onEnded = () => { if (loadedId.current) finish(loadedId.current); };
    const onPlay = () => { setPlaying(true); setPlayError(''); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onError = () => {
      const id = loadedId.current; const ep = findEp(id);
      if (ep && id && a.src.startsWith('blob:')) { // saved copy broken: fall back to streaming
        delete blobUrls.current[id]; loadedId.current = null; loadInto(ep); startPlayback(); return;
      }
      setPlaying(false); setBuffering(false);
      setPlayError(navigator.onLine ? 'Couldn’t load this episode.' : 'You’re offline and this episode isn’t downloaded.');
    };
    const evs: [string, () => void][] = [
      ['loadedmetadata', onMeta], ['timeupdate', onTime], ['ended', onEnded], ['play', onPlay],
      ['pause', onPause], ['waiting', onWaiting], ['playing', onPlaying], ['error', onError]
    ];
    evs.forEach(([n, f]) => a.addEventListener(n, f));
    return () => evs.forEach(([n, f]) => a.removeEventListener(n, f));
  }, [finish, findEp, loadInto, startPlayback]);

  // lock-screen / headphone controls
  const current = findEp(p.currentId);
  useEffect(() => {
    const ms = navigator.mediaSession; if (!ms) return;
    if (current) ms.metadata = new MediaMetadata({ title: current.title, artist: current.show, album: 'Daily Brief', artwork: [...(current.img ? [{ src: current.img.replace(/^http:\/\//i, 'https://'), sizes: '512x512' }] : []), { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    const cur = () => audio.current.currentTime;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => toggle()], ['pause', () => toggle()],
      ['seekbackward', () => seek(cur() - 15)], ['seekforward', () => seek(cur() + 15)],
      ['nexttrack', () => { const id = pRef.current.currentId; if (id) finish(id); }],
      ['seekto', d => { if (d.seekTime != null) seek(d.seekTime); }]
    ];
    handlers.forEach(([a, h]) => { try { ms.setActionHandler(a, h); } catch { /* unsupported */ } });
  }, [current?.id, current, toggle, seek, finish]);

  // ---------- downloads ----------
  const pump = useCallback(() => {
    while (Object.keys(controllers.current).length < MAX_PARALLEL_DOWNLOADS && dlQueue.current.length) {
      const id = dlQueue.current.shift()!;
      const ep = findEp(id); if (!ep) { setDl(d => { const n = { ...d }; delete n[id]; return n; }); continue; }
      const ac = new AbortController(); controllers.current[id] = ac;
      downloadEpisode(id, ep.audioUrl, ep.bytes, v => setDl(d => d[id] === undefined ? d : { ...d, [id]: v }), ac.signal)
        .then(({ blob, bytes }) => {
          blobUrls.current[id] = URL.createObjectURL(blob);
          setP(st => ({ ...st, saved: { ...st.saved, [id]: { ...ep, savedBytes: bytes, savedAt: Date.now() } } }));
          storageAvailable().then(setAvailable);
        })
        .catch((e: Error) => { if (e.name !== 'AbortError') setDlError(x => ({ ...x, [id]: e.message })); })
        .finally(() => {
          delete controllers.current[id];
          setDl(d => { const n = { ...d }; delete n[id]; return n; });
          pump();
        });
    }
  }, [findEp]);

  const download = useCallback((id: string) => {
    if (pRef.current.saved[id] || controllers.current[id] || dlQueue.current.includes(id)) return;
    requestPersistence();
    setDlError(x => { const n = { ...x }; delete n[id]; return n; });
    setDl(d => ({ ...d, [id]: 0 }));
    dlQueue.current.push(id);
    pump();
  }, [pump]);

  const cancelDownload = useCallback((id: string) => {
    dlQueue.current = dlQueue.current.filter(x => x !== id);
    controllers.current[id]?.abort();
    setDl(d => { const n = { ...d }; delete n[id]; return n; });
  }, []);

  const removeDownload = useCallback(async (id: string) => {
    cancelDownload(id);
    await removeBlob(id);
    if (blobUrls.current[id]) {
      if (loadedId.current === id && !audio.current.paused) {
        // keep playing the in-memory copy; it's released on next track
      } else URL.revokeObjectURL(blobUrls.current[id]);
      delete blobUrls.current[id];
    }
    setP(st => { const saved = { ...st.saved }; delete saved[id]; return { ...st, saved }; });
    storageAvailable().then(setAvailable);
  }, [cancelDownload]);

  const clearDownloads = useCallback(async () => {
    Object.keys(controllers.current).forEach(cancelDownload);
    dlQueue.current = [];
    await clearBlobs();
    Object.entries(blobUrls.current).forEach(([id, u]) => { if (id !== loadedId.current) URL.revokeObjectURL(u); });
    blobUrls.current = {};
    setDl({});
    setP(st => ({ ...st, saved: {} }));
    storageAvailable().then(setAvailable);
  }, [cancelDownload]);

  return {
    p, tab, setTab, playing, buffering, expanded, setExpanded, hidePlayed, setHidePlayed,
    refreshing, online, dl, dlError, playError, available,
    queue, allEpisodes, current,
    refresh, addFeed, updateFeed, deleteFeed, reorderFeeds,
    play, toggle, seek, setSpeed, nextUnplayed,
    download, cancelDownload, removeDownload, clearDownloads,
    setAutoplay: (on: boolean) => setP(st => ({ ...st, autoplay: on })),
    setPerFeed: (n: 1 | 2) => setP(st => ({ ...st, perFeed: n })),
    setSort: (s: Persisted['sort']) => setP(st => ({ ...st, sort: s }))
  };
}

export type Brief = ReturnType<typeof useBrief>;
