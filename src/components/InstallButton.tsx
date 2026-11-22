import { useState } from 'react';
import { useInstall } from '../lib/useInstall';
import { DownloadIcon } from './Icons';

/** Hidden when already installed or when the browser offers no install path. */
export function InstallButton() {
  const { installed, canPrompt, iosHint, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (installed || (!canPrompt && !iosHint)) return null;
  return (
    <>
      <button className="ghost-btn install-btn" onClick={() => (canPrompt ? install() : setHelp(h => !h))}>
        <DownloadIcon size={16} /> Install app
      </button>
      {help && <div className="install-help">Tap the <b>Share</b> button in Safari, then choose <b>Add to Home Screen</b>.</div>}
    </>
  );
}
