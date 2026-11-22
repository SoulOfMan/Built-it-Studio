import { DEFAULT_FEEDS, type Persisted } from './model';

const KEY = 'dailybrief.v1';

export function loadState(): Persisted {
  let s: Partial<Persisted> = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* ignore */ }
  return {
    feeds: s.feeds?.length ? s.feeds : DEFAULT_FEEDS,
    cache: s.cache || {},
    pos: s.pos || {},
    played: s.played || {},
    durations: s.durations || {},
    saved: s.saved || {},
    speed: s.speed || 1,
    perFeed: s.perFeed === 2 ? 2 : 1,
    autoplay: s.autoplay !== false,
    sort: s.sort === 'priority' ? 'priority' : 'time',
    currentId: s.currentId ?? null,
    updatedAt: s.updatedAt || 0
  };
}

let timer: number | undefined;
export function saveState(s: Persisted, immediate = false) {
  const write = () => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota: ignore */ }
  };
  clearTimeout(timer);
  if (immediate) write();
  else timer = window.setTimeout(write, 800);
}

/** Drop positions/played marks for episodes no longer in any feed or download, so storage doesn't grow forever. */
export function prune(s: Persisted): Persisted {
  const live = new Set<string>(Object.keys(s.saved));
  for (const f of s.feeds) for (const e of s.cache[f.id]?.episodes || []) live.add(f.id + '::' + e.guid);
  const keep = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => live.has(k)));
  return { ...s, pos: keep(s.pos), played: keep(s.played) as Record<string, true>, durations: keep(s.durations) };
}
