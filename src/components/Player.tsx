import { useEffect, useState } from 'react';
import type { Brief } from '../lib/useBrief';
import { SPEEDS, fmt } from '../lib/model';
import { Back15, ChevronDown, Fwd15, PauseIcon, PlayIcon } from './Icons';

export function MiniPlayer({ b }: { b: Brief }) {
  const cur = b.current; if (!cur) return null;
  const pos = Math.min(cur.dur || Infinity, b.p.pos[cur.id] || 0);
  return (
    <div className="mini">
      <div className="mini-progress" style={{ width: cur.dur ? (pos / cur.dur * 100).toFixed(2) + '%' : '0%' }} />
      <div className="mini-row">
        <button className="mini-open" onClick={() => b.setExpanded(true)} aria-label="Open player">
          <div className="art sm" style={{ background: cur.bg }}>{cur.ab}</div>
          <div className="mini-text">
            <div className="mini-title">{cur.title}</div>
            <div className="mono-muted">{fmt(pos)} / {fmt(cur.dur)} · {b.p.speed}×</div>
          </div>
        </button>
        <button className="play-btn on solid" aria-label={b.playing ? 'Pause' : 'Play'} onClick={b.toggle}>
          {b.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="icon-btn" aria-label="Skip forward 15 seconds" onClick={() => b.seek(pos + 15)}><Fwd15 /></button>
      </div>
    </div>
  );
}

export function FullPlayer({ b }: { b: Brief }) {
  const cur = b.current;
  const pos = cur ? Math.min(cur.dur || Infinity, b.p.pos[cur.id] || 0) : 0;
  const [scrub, setScrub] = useState<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') b.setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [b]);
  if (!cur || !b.expanded) return null;

  const q = b.queue;
  const idx = q.findIndex(e => e.id === cur.id);
  const nx = b.nextUnplayed(cur.id, b.p.played);
  const shown = scrub ?? pos;
  const commit = () => { if (scrub != null) { b.seek(scrub); setScrub(null); } };

  return (
    <div className="full" role="dialog" aria-label="Now playing">
      <div className="full-top">
        <button className="round-btn" aria-label="Close player" onClick={() => b.setExpanded(false)}><ChevronDown /></button>
        <span className="date">{idx >= 0 ? `Episode ${idx + 1} of ${q.length}` : 'Saved episode'}</span>
        <span style={{ width: 44 }} />
      </div>
      <div className="full-art" style={{ background: cur.bg }}>{cur.ab}</div>
      <div style={{ marginTop: 28 }}>
        <div className="muted" style={{ fontSize: 13 }}>{cur.show}</div>
        <div className="full-title">{cur.title}</div>
        <div className="pill">{b.p.saved[cur.id] ? 'Playing from device' : b.buffering ? 'Buffering…' : 'Streaming'}</div>
      </div>
      {b.playError && <div className="error" role="alert" style={{ marginTop: 10 }}>{b.playError}</div>}
      <div style={{ marginTop: 20 }}>
        <input type="range" className="scrub" min={0} max={Math.max(1, cur.dur)} step={1} value={shown}
          aria-label="Seek"
          onChange={e => setScrub(+e.target.value)}
          onPointerUp={commit} onKeyUp={commit} onTouchEnd={commit} onBlur={commit} />
        <div className="times"><span>{fmt(shown)}</span><span>-{fmt(cur.dur - shown)}</span></div>
      </div>
      <div className="transport">
        <button className="icon-btn big" aria-label="Rewind 15 seconds" onClick={() => b.seek(pos - 15)}><Back15 size={32} sw={1.5} /></button>
        <button className="play-btn on solid huge" aria-label={b.playing ? 'Pause' : 'Play'} onClick={b.toggle}>
          {b.playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
        </button>
        <button className="icon-btn big" aria-label="Skip forward 15 seconds" onClick={() => b.seek(pos + 15)}><Fwd15 size={32} sw={1.5} /></button>
      </div>
      <div className="speeds">
        {SPEEDS.map(v => (
          <button key={v} className={'speed' + (b.p.speed === v ? ' on' : '')} onClick={() => b.setSpeed(v)}>{v}×</button>
        ))}
      </div>
      <div className="upnext">
        <span className="date">Up next</span>
        <span className="upnext-t">{nx ? nx.show + ' — ' + nx.title : 'End of today’s queue'}</span>
      </div>
    </div>
  );
}
