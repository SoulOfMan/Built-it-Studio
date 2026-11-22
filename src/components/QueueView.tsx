import type { Brief } from '../lib/useBrief';
import { agoLabel, fmt, sizeLabel } from '../lib/model';
import { CheckIcon, DownloadIcon, PauseIcon, PlayIcon, RefreshIcon } from './Icons';
import { useState } from 'react';
import { InstallButton } from './InstallButton';

export function QueueView({ b }: { b: Brief }) {
  const { p, queue, current, playing } = b;
  const [turns, setTurns] = useState(0);
  const unplayed = queue.filter(e => !p.played[e.id]);
  const totalLeft = unplayed.reduce((a, e) => a + Math.max(0, e.dur - (p.pos[e.id] || 0)), 0);
  const mins = Math.round(totalLeft / 60);
  const firstUp = unplayed[0];
  const curInQueue = !!current && queue.some(e => e.id === current.id) && !p.played[current.id];
  const curPos = current ? p.pos[current.id] || 0 : 0;
  const busy = queue.filter(e => b.dl[e.id] !== undefined).length;
  const missing = queue.filter(e => !p.saved[e.id] && b.dl[e.id] === undefined && !p.played[e.id]);
  const neverLoaded = p.feeds.length > 0 && p.feeds.every(f => !p.cache[f.id]);

  const unplayedAll = queue;
  const daybar = queue;
  const hr = new Date().getHours();
  const greeting = hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const summary = neverLoaded
    ? (b.online ? 'Loading your feeds…' : 'Connect once to load your feeds.')
    : unplayed.length ? `${unplayed.length} ${unplayed.length === 1 ? 'episode' : 'episodes'}, ${mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + ' min'} left` : 'You’re all caught up';
  const status = !b.online ? 'Offline, saved episodes only'
    : b.refreshing ? 'Refreshing…'
    : p.updatedAt ? 'Updated ' + new Date(p.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

  const todayPlaying = playing && curInQueue;
  const list = queue.filter(e => !(b.hidePlayed && p.played[e.id]));

  return (
    <div className="page">
      <div className="head-row">
        <div>
          <div className="date">{dateLabel}</div>
          <h1>{greeting}</h1>
        </div>
        <button className="round-btn" aria-label="Refresh feeds" disabled={!b.online}
          onClick={() => { setTurns(t => t + 1); b.refresh(true); }}
          style={{ transform: `rotate(${turns * 360}deg)`, transition: 'transform .9s ease' }}>
          <RefreshIcon />
        </button>
      </div>

      <section className="brief" aria-label="Today’s brief">
        <div className="brief-top">
          <button className="brief-play" aria-label={todayPlaying ? 'Pause' : curInQueue && curPos > 0 ? 'Resume today’s brief' : 'Play today’s brief'}
            disabled={!curInQueue && !firstUp}
            onClick={() => { if (curInQueue) b.toggle(); else if (firstUp) b.play(firstUp.id); }}>
            {todayPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
          <div className="brief-text">
            <div className="brief-title">{todayPlaying ? 'Playing your brief' : curInQueue && curPos > 0 ? 'Resume your brief' : 'Play your brief'}</div>
            <div className="brief-sub">{summary}</div>
          </div>
        </div>
        {unplayedAll.length > 0 && (
          <div className="daybar" role="group" aria-label="Today’s episodes">
            {daybar.map(e => {
              const done = !!p.played[e.id];
              const frac = done ? 1 : Math.min(1, (p.pos[e.id] || 0) / (e.dur || 1));
              return (
                <button key={e.id} className={'seg-ep' + (current?.id === e.id ? ' cur' : '')} style={{ flexGrow: Math.max(60, e.dur) }}
                  aria-label={`${e.show}: ${e.title}`} title={`${e.show}: ${e.title}`}
                  onClick={() => b.play(e.id)}>
                  <span style={{ width: frac * 100 + '%' }} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <InstallButton />

      <button className="ghost-btn" disabled={!b.online || (!busy && !missing.length)}
        onClick={() => missing.forEach(e => b.download(e.id))}>
        <DownloadIcon size={16} />
        {busy ? `Downloading ${busy}…` : missing.length ? `Download all for offline (${sizeLabel(missing.reduce((a, e) => a + e.bytes, 0))})` : 'All episodes downloaded'}
      </button>

      {b.playError && <div className="error" role="alert" style={{ marginTop: 10 }}>{b.playError}</div>}

      <div className="section-row">
        <h2>Queue</h2>
        <span className="mono-muted">{status}</span>
      </div>

      {list.map(e => {
        const pos = p.pos[e.id] || 0, played = !!p.played[e.id], d = b.dl[e.id], saved = !!p.saved[e.id];
        const isCur = current?.id === e.id;
        const unavailable = !b.online && !saved && !isCur;
        let sub = [agoLabel(e.published), e.dur ? Math.max(1, Math.round(e.dur / 60)) + ' min' : ''].filter(Boolean).join(' · ');
        if (played) sub = 'Played';
        else if (isCur) sub = (playing ? (b.buffering ? 'Loading… · ' : 'Playing · ') : 'Paused · ') + fmt(e.dur - pos) + ' left';
        else if (pos > 0) sub = fmt(e.dur - pos) + ' left';
        if (unavailable && !played) sub = 'Not downloaded';
        if (b.dlError[e.id]) sub = 'Download failed — tap ↓ to retry';
        const onPlay = () => isCur ? b.toggle() : b.play(e.id);
        return (
          <div key={e.id} className="ep-row" style={{ opacity: played || unavailable ? 0.42 : 1 }}>
            <div className="art" style={{ background: e.bg }}>{e.ab}</div>
            <div className="ep-main" onClick={onPlay}>
              <div className="ep-show">{isCur && playing && <span className="eq" aria-hidden="true"><i /><i /><i /></span>}{e.show}</div>
              <div className="ep-title">{e.title}</div>
              <div className="ep-sub" style={{ color: b.dlError[e.id] ? 'var(--red)' : undefined }}>{sub}</div>
              {pos > 0 && !played && e.dur > 0 && (
                <div className="bar"><div style={{ width: Math.min(100, pos / e.dur * 100) + '%' }} /></div>
              )}
            </div>
            <button className="icon-btn" aria-label={saved ? 'Downloaded' : d !== undefined ? 'Cancel download' : 'Download'}
              disabled={saved || (!b.online && d === undefined)}
              onClick={() => d !== undefined ? b.cancelDownload(e.id) : b.download(e.id)}>
              {saved ? <span className="dl-done"><CheckIcon /></span>
                : d !== undefined ? <span className="dl-ring" style={{ background: `conic-gradient(var(--amber) ${Math.round(d * 360)}deg, var(--rule) 0)` }}><span /></span>
                : <DownloadIcon />}
            </button>
            <button className={'play-btn' + (isCur ? ' on' : '')} aria-label={isCur && playing ? 'Pause' : 'Play'} onClick={onPlay}>
              {isCur && playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
            </button>
          </div>
        );
      })}

      {!neverLoaded && queue.length === 0 && <div className="empty">No episodes. Add feeds to build your queue.</div>}
    </div>
  );
}
