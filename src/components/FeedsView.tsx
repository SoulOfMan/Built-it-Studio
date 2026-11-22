import { useEffect, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from './Switch';
import type { Brief } from '../lib/useBrief';
import { host, validUrl, type Feed } from '../lib/model';
import { searchPodcasts, type PodcastHit } from '../lib/downloads';
import { EditIcon, GripIcon, TrashIcon } from './Icons';

export function FeedsView({ b }: { b: Brief }) {
  const { p } = b;
  const [addUrl, setAddUrl] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [hits, setHits] = useState<PodcastHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const isUrl = /^https?:\/\//i.test(addUrl.trim());

  useEffect(() => {
    const q = addUrl.trim();
    if (isUrl || q.length < 2) { setHits([]); setSearchErr(''); setSearching(false); return; }
    setSearching(true);
    const ac = new AbortController();
    const t = setTimeout(() => {
      searchPodcasts(q, ac.signal)
        .then(r => { setHits(r); setSearchErr(''); setSearching(false); })
        .catch(e => { if (e.name !== 'AbortError') { setSearchErr(e.message); setHits([]); setSearching(false); } });
    }, 350);
    return () => { clearTimeout(t); ac.abort(); };
  }, [addUrl, isUrl]);

  const addHit = async (h: PodcastHit) => {
    setAddingId(h.id);
    const err = await b.addFeed(h.feedUrl);
    setAddingId(null);
    setAddError(err || '');
  };

  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const add = async () => {
    if (adding) return;
    setAdding(true);
    const err = await b.addFeed(addUrl);
    setAdding(false);
    if (err) setAddError(err); else { setAddUrl(''); setAddError(''); }
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = p.feeds.findIndex(f => f.id === e.active.id);
    const to = p.feeds.findIndex(f => f.id === e.over!.id);
    b.reorderFeeds(arrayMove(p.feeds, from, to));
  };

  return (
    <div className="page">
      <div className="date">{p.feeds.length} active</div>
      <h1>Feeds</h1>

      <form className="add-row" onSubmit={e => { e.preventDefault(); if (isUrl) add(); }}>
        <input className="input" type="search" inputMode="search" enterKeyHint="search" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          aria-label="Search podcasts" value={addUrl} onChange={e => { setAddUrl(e.target.value); setAddError(''); }}
          placeholder="Search podcasts or paste a link" />
        {isUrl && <button className="dark-btn" type="submit" disabled={adding}>{adding ? 'Checking…' : 'Add'}</button>}
      </form>
      {addError && <div className="error" role="alert">{addError}</div>}

      {!isUrl && addUrl.trim().length >= 2 && (
        <div className="results" aria-live="polite">
          {searching && <div className="muted results-note">Searching…</div>}
          {searchErr && <div className="error">{searchErr}</div>}
          {!searching && !searchErr && hits.length === 0 && <div className="muted results-note">No podcasts found for “{addUrl.trim()}”.</div>}
          {hits.map(h => {
            const have = p.feeds.some(f => f.url === h.feedUrl);
            return (
              <div key={h.id} className="hit">
                <img src={h.image} alt="" width="48" height="48" loading="lazy" />
                <div className="hit-main">
                  <div className="feed-name">{h.name}</div>
                  <div className="feed-meta">{[h.author, h.genre].filter(Boolean).join(' · ')}</div>
                </div>
                <button className="light-btn" disabled={have || addingId === h.id} onClick={() => addHit(h)}>
                  {have ? 'Added' : addingId === h.id ? 'Adding…' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-row">
        <h2>Priority order</h2>
        <span className="mono-muted">Drag to reorder</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={p.feeds.map(f => f.id)} strategy={verticalListSortingStrategy}>
          {p.feeds.map((f, i) => (
            <FeedRow key={f.id} f={f} i={i} b={b} editing={editingId === f.id}
              onEdit={() => setEditingId(f.id)} onDone={() => setEditingId(null)} />
          ))}
        </SortableContext>
      </DndContext>

      <h2 style={{ marginTop: 28 }}>Queue settings</h2>
      <div className="settings">
        <div className="setting">
          <span>Autoplay next episode</span>
          <Switch on={p.autoplay} label="Autoplay next episode" onChange={b.setAutoplay} />
        </div>
        <div className="setting">
          <span>Episodes per feed</span>
          <Seg options={[[1, '1'], [2, '2']]} value={p.perFeed} onChange={v => b.setPerFeed(v as 1 | 2)} />
        </div>
        <div className="setting">
          <span>Sort queue by</span>
          <Seg options={[['time', 'Newest'], ['priority', 'Priority']]} value={p.sort} onChange={v => b.setSort(v as 'time' | 'priority')} />
        </div>
        <div className="setting">
          <span>Played episodes</span>
          <Seg options={[[0, 'Show'], [1, 'Hide']]} value={b.hidePlayed ? 1 : 0} onChange={v => b.setHidePlayed(v === 1)} />
        </div>
      </div>
    </div>
  );
}

function Seg<T extends string | number>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

function FeedRow({ f, i, b, editing, onEdit, onDone }: { f: Feed; i: number; b: Brief; editing: boolean; onEdit: () => void; onDone: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id, disabled: editing });
  const [name, setName] = useState(f.name);
  const [url, setUrl] = useState(f.url);
  const [err, setErr] = useState('');
  const cacheErr = b.p.cache[f.id]?.error;

  const save = () => {
    if (!name.trim()) return setErr('Name can’t be empty.');
    if (!validUrl(url)) return setErr('Enter a valid feed URL.');
    b.updateFeed(f.id, name.trim(), url.trim());
    setErr(''); onDone();
  };

  return (
    <div ref={setNodeRef} className="feed-row"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 2 : undefined, position: 'relative' }}>
      {!editing ? (
        <div className="feed-line">
          <span className="grip" aria-label={'Reorder ' + f.name} {...attributes} {...listeners}><GripIcon /></span>
          <span className="num">{String(i + 1).padStart(2, '0')}</span>
          <div className="feed-main">
            <div className="feed-name">{f.name}</div>
            <div className="feed-meta" style={cacheErr ? { color: 'var(--red)' } : undefined}>
              {cacheErr ? 'Couldn’t update · ' + host(f.url) : `${f.cat} · ${host(f.url)}`}
              {cacheErr && <div title={cacheErr} style={{ textTransform: 'none', marginTop: 2 }}>{cacheErr}</div>}
            </div>
          </div>
          <button className="icon-btn" aria-label={'Edit ' + f.name} onClick={() => { setName(f.name); setUrl(f.url); setErr(''); onEdit(); }}><EditIcon /></button>
          <button className="icon-btn" aria-label={'Delete ' + f.name} onClick={() => b.deleteFeed(f.id)}><TrashIcon /></button>
        </div>
      ) : (
        <div className="feed-edit">
          <input className="input strong" value={name} onChange={e => setName(e.target.value)} placeholder="Show name" autoFocus />
          <input className="input mono small" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="RSS URL" />
          {err && <div className="error">{err}</div>}
          <div className="edit-actions">
            <button className="light-btn" onClick={onDone}>Cancel</button>
            <button className="dark-btn sm" onClick={save}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
