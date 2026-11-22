import { useBrief } from './lib/useBrief';
import { QueueView } from './components/QueueView';
import { FeedsView } from './components/FeedsView';
import { OfflineView } from './components/OfflineView';
import { FullPlayer, MiniPlayer } from './components/Player';
import { QueueIcon, RssIcon, TrayIcon } from './components/Icons';
import { InstallSheet } from './components/InstallSheet';
import type { Tab } from './lib/model';

const TABS: [Tab, string, () => JSX.Element][] = [
  ['queue', 'Today', () => <QueueIcon />],
  ['feeds', 'Feeds', () => <RssIcon />],
  ['storage', 'Offline', () => <TrayIcon />]
];

export default function App() {
  const b = useBrief();
  return (
    <div className="shell">
      <main className="scroll">
        {b.tab === 'queue' && <QueueView b={b} />}
        {b.tab === 'feeds' && <FeedsView b={b} />}
        {b.tab === 'storage' && <OfflineView b={b} />}
      </main>
      <MiniPlayer b={b} />
      <nav className="tabs">
        {TABS.map(([id, label, icon]) => (
          <button key={id} className={b.tab === id ? 'on' : ''} aria-current={b.tab === id ? 'page' : undefined} onClick={() => b.setTab(id)}>
            {icon()}{label}
          </button>
        ))}
      </nav>
      <FullPlayer b={b} />
      <InstallSheet />
    </div>
  );
}
