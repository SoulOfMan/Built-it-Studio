import { useEffect, useState } from 'react';
import type { Brief } from '../lib/useBrief';
import { mb } from '../lib/model';
import { TrashIcon } from './Icons';

export function OfflineView({ b }: { b: Brief }) {
  const saved = Object.values(b.p.saved).sort((a, z) => z.savedAt - a.savedAt);
  const usedBytes = saved.reduce((a, e) => a + e.savedBytes, 0);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!confirm) return; const t = setTimeout(() => setConfirm(false), 3000); return () => clearTimeout(t); }, [confirm]);

  const avail = b.available;
  const availLabel = avail == null ? '' : avail > 1_073_741_824 ? `~${Math.round(avail / 1_073_741_824)} GB available` : `~${Math.round(avail / 1_048_576)} MB available`;
  const pct = avail ? Math.min(100, Math.max(usedBytes ? 1 : 0, usedBytes / (usedBytes + avail) * 100)) : 0;

  return (
    <div className="page">
      <div className="date">On this device</div>
      <h1>Offline</h1>

      <div className="card">
        <div className="big-num"><span>{mb(usedBytes).toFixed(1)}</span><span className="muted">MB used</span></div>
        <div className="meter"><div style={{ width: pct + '%' }} /></div>
        <div className="meter-labels">
          <span>{saved.length} {saved.length === 1 ? 'episode' : 'episodes'}</span><span>{availLabel}</span>
        </div>
      </div>

      <div className="section-row"><h2>Saved episodes</h2></div>
      {saved.map(e => (
        <div key={e.id} className="ep-row">
          <div className="art sm" style={{ background: e.bg }}>{e.ab}</div>
          <div className="ep-main" onClick={() => b.play(e.id)}>
            <div className="ep-title one">{e.title}</div>
            <div className="ep-sub">{e.show} · {mb(e.savedBytes)} MB</div>
          </div>
          <button className="icon-btn wide" aria-label={'Delete download ' + e.title} onClick={() => b.removeDownload(e.id)}><TrashIcon /></button>
        </div>
      ))}
      {saved.length === 0 && <div className="empty">Nothing saved yet. Download episodes from Today to listen without a connection.</div>}
      {saved.length > 0 && (
        <button className="ghost-btn danger" style={{ marginTop: 20 }}
          onClick={() => { if (confirm) { b.clearDownloads(); setConfirm(false); } else setConfirm(true); }}>
          {confirm ? 'Tap again to delete all' : 'Clear All Downloads'}
        </button>
      )}
    </div>
  );
}
