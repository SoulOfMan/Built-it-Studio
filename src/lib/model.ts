export interface Feed {
  id: string;
  name: string;
  cat: string;
  ab: string;
  url: string;
}

/** Episode as returned by the server's /api/feed. */
export interface RawEpisode {
  guid: string;
  title: string;
  audioUrl: string;
  type: string;
  bytes: number;
  duration: number;
  published: number;
  image: string;
}

export interface FeedCacheEntry {
  at: number;
  title: string;
  image: string;
  episodes: RawEpisode[];
  error?: string;
}

/** Episode as the UI uses it. */
export interface Episode {
  id: string;
  feedId: string;
  show: string;
  ab: string;
  bg: string;
  title: string;
  audioUrl: string;
  type: string;
  dur: number;
  published: number;
  bytes: number;
}

export type SortMode = 'time' | 'priority';
export type Tab = 'queue' | 'feeds' | 'storage';

export interface Persisted {
  feeds: Feed[];
  cache: Record<string, FeedCacheEntry>;
  pos: Record<string, number>;
  played: Record<string, true>;
  durations: Record<string, number>;
  saved: Record<string, Episode & { savedBytes: number; savedAt: number }>;
  speed: number;
  perFeed: 1 | 2;
  sort: SortMode;
  currentId: string | null;
  updatedAt: number;
}

export const SHADES = ['#1f3a5f', '#8a3b2e', '#2d5a4a', '#5b3f7a', '#8a5a1c', '#3a4a63'];
export const SPEEDS = [1, 1.25, 1.5, 2];

export const DEFAULT_FEEDS: Feed[] = [
  { id: 'bbc', name: 'BBC News Summary', cat: 'World', ab: 'BBC', url: 'https://podcasts.files.bbci.co.uk/p02nq0gn.rss' },
  { id: 'aj', name: 'Al Jazeera – The Take', cat: 'General', ab: 'AJ', url: 'https://feeds.aljazeera.net/podcasts/thetake.rss' },
  { id: 'dw', name: 'DW Newsbrief', cat: 'World', ab: 'DW', url: 'https://rss.dw.com/xml/podcast_newsbrief' },
  { id: 'w10', name: 'World in 10', cat: 'World', ab: 'W10', url: 'https://feeds.megaphone.fm/worldin10' },
  { id: 'gsw', name: "The Guardian's Science Weekly", cat: 'Science', ab: 'SW', url: 'https://www.theguardian.com/science/series/science/podcast.xml' },
  { id: 'nyt', name: 'New York Times – The Daily', cat: 'General', ab: 'TD', url: 'https://feeds.simplecast.com/54nAGcIl' },
  { id: 'reu', name: 'Reuters World News', cat: 'World', ab: 'R5', url: 'https://feeds.megaphone.fm/reuters-world-news' },
  { id: 'fre', name: 'Front Row Entrepreneur', cat: 'Technology', ab: 'FRE', url: 'https://feeds.buzzsprout.com/frontrowentrepreneur.rss' },
  { id: 'wsj', name: 'WSJ Tech News Briefing', cat: 'Technology', ab: 'TNB', url: 'https://video-api.wsj.com/podcast/rss/wsj/tech-news-briefing' },
  { id: 'gn', name: "Global's Newsroom", cat: 'World', ab: 'GN', url: 'https://feeds.global.com/newsroom' },
  { id: 'bmm', name: 'Bloomberg Market Minute', cat: 'Business', ab: 'BMM', url: 'https://feeds.bloomberg.fm/market-minute' }
];

export const fmt = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
};

export const host = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
};

export const validUrl = (u: string) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(u.trim());

export const abbrev = (name: string) => {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
  return (words[0] || 'POD').slice(0, 3).toUpperCase();
};

export const agoLabel = (ts: number, now = Date.now()) => {
  if (!ts) return '';
  const h = Math.floor((now - ts) / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : d + 'd ago';
};

/** Rough size when a feed doesn't report it: 128 kbps MP3. */
export const estBytes = (dur: number) => Math.round(dur * 16000);
export const mb = (bytes: number) => Math.round((bytes / 1_048_576) * 10) / 10;
export const sizeLabel = (bytes: number) => {
  const m = bytes / 1_048_576;
  return m >= 1024 ? (m / 1024).toFixed(1) + ' GB' : m >= 10 ? Math.round(m) + ' MB' : (Math.round(m * 10) / 10 || 0.1) + ' MB';
};

export function episodesFor(feed: Feed, index: number, entry: FeedCacheEntry | undefined, durations: Record<string, number>): Episode[] {
  if (!entry) return [];
  return entry.episodes.map(e => {
    const id = feed.id + '::' + e.guid;
    const dur = durations[id] || e.duration || (e.bytes ? Math.round(e.bytes / 16000) : 0);
    return {
      id, feedId: feed.id, show: feed.name, ab: feed.ab, bg: SHADES[index % SHADES.length],
      title: e.title, audioUrl: e.audioUrl, type: e.type, dur, published: e.published,
      bytes: e.bytes || estBytes(dur)
    };
  });
}
