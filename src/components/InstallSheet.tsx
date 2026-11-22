import { useEffect, useState } from 'react';
import { useInstall } from '../lib/useInstall';
import { DownloadIcon } from './Icons';

const KEY = 'dailybrief.installDismissed';
const SNOOZE_MS = 3 * 24 * 3600 * 1000;
const dismissedRecently = () => { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < SNOOZE_MS; } catch { return false; } };

/** Bottom sheet offered on load until the app is installed (snoozed for 3 days after "Not now"). */
export function InstallSheet() {
  const { installed, canPrompt, iosHint, install } = useInstall();
  const [open, setOpen] = useState(false);
  const available = !installed && (canPrompt || iosHint);

  // wait for the splash to finish before showing
  useEffect(() => {
    if (!available || dismissedRecently()) return;
    const t = setTimeout(() => setOpen(true), 2200);
    return () => clearTimeout(t);
  }, [available]);

  const close = () => { setOpen(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } };
  if (!open || !available) return null;
  return (
    <div className="sheet-wrap" role="dialog" aria-label="Install Labari">
      <div className="sheet-scrim" onClick={close} />
      <div className="sheet">
        <img src="/icon-192.png" alt="" width="56" height="56" />
        <h2>Install Labari</h2>
        <p>{canPrompt ? 'Add it to your home screen to open full-screen and listen offline.' : <>Tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</>}</p>
        {canPrompt && <button className="dark-btn sheet-cta" onClick={async () => { await install(); setOpen(false); }}><DownloadIcon size={16} /> Install app</button>}
        <button className="sheet-skip" onClick={close}>{canPrompt ? 'Not now' : 'Got it'}</button>
      </div>
    </div>
  );
}
