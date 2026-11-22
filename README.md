# Daily Brief

An offline-ready news podcast queue, built from the *Daily Brief* clickable prototype. Each morning it pulls the latest episode (or two) from every feed you follow and lines them up into one “Today” queue. You can play the whole queue with one tap, download it for listening with no connection, and pick up where you left off.

It's a **Progressive Web App**: open it on your phone, choose *Add to Home Screen* (or tap **Install app** on the Today screen), and it runs full-screen like a native app.

## What works

| Screen | Features |
|---|---|
| **Today** | Live queue built from real RSS feeds · Play/Resume Today (auto-advances through the queue) · per-episode play, progress bar, “x left” · Download All / per-episode downloads with progress rings (tap a ring to cancel) · refresh · offline mode marks episodes you haven't downloaded |
| **Feeds** | Add a feed by URL (checked against the live feed and named automatically) · edit name/URL · delete · drag to reorder (mouse, touch and keyboard) · episodes per feed (1/2) · sort by Newest or Priority · show/hide played |
| **Offline** | Real storage used and space left on the device · saved episode list · delete one or clear all (asks you to tap twice) |
| **Player** | Mini player + full-screen player · scrub · ±15 s · 1×/1.25×/1.5×/2× · “Up next” · lock-screen and headphone controls (Media Session) · plays from the device when the episode is downloaded, otherwise streams |

Your feeds, playback positions, played episodes, speed and settings are saved on the device. Downloaded audio is kept in IndexedDB, and the app shell is cached by a service worker, so the app opens with no connection.

## Why there's a server

Browsers block web pages from reading most podcast RSS feeds and audio files directly (CORS). The small Express server in `server/` does two jobs:

- `GET /api/feed?url=…` fetches and parses a feed into JSON (cached for 5 minutes)
- `GET /api/audio?url=…` passes audio through so the browser can save it for offline use

Streaming playback goes straight to the podcast's own servers. Only downloads go through the proxy. The proxy refuses private/local addresses.

## Run it locally

Needs Node 18+ (20+ recommended).

```bash
npm install
npm run dev          # web app on http://localhost:5173, API on :8787
```

## Run in production

```bash
npm install
npm run build        # type-checks and builds the PWA into dist/
npm start            # serves the app + API on http://localhost:8787 (PORT to change)
```

Or with Docker:

```bash
docker build -t daily-brief .
docker run -p 8787:8787 daily-brief
```

Deploy it on any Node host (on Vercel the `api/` functions replace the Express server) (Render, Railway, Fly.io, a VPS…). **It must be served over HTTPS** for the service worker, offline mode and *Add to Home Screen* to work. `localhost` is the only exception.

## Tests

```bash
npm test             # feed parser + URL safety checks
npm run typecheck
```

## Project layout

```
server/index.js        Express: /api/feed, /api/audio, serves dist/ in production
server/rss.js          RSS/iTunes/Atom → JSON parser
src/lib/useBrief.ts    All app state: queue, audio element, downloads, persistence
src/lib/downloads.ts   API calls + IndexedDB audio storage
src/lib/model.ts       Types, default feeds, formatting helpers
src/components/        QueueView, FeedsView, OfflineView, Player (mini + full), Icons
```

## Notes

- The 11 starter feeds come from the prototype. A few of those URLs may have moved since. If a feed can't be loaded, its row in **Feeds** shows *COULDN'T UPDATE*: edit the URL or delete it.
- Downloads use whatever space the browser allows. The app asks the browser to keep them (`navigator.storage.persist()`), but iOS may still clear data for home-screen apps you haven't opened in a few weeks.
- `ALLOW_PRIVATE_HOSTS=1` lets the proxy reach local addresses. It's for testing against a local mock feed only. Never set it in production.
