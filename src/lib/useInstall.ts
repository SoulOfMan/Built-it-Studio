import { useCallback, useSyncExternalStore } from 'react';

interface BIPEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Shared state: the browser fires beforeinstallprompt once, early, so capture it at module load.
let evt: BIPEvent | null = null;
let installed = isStandalone();
let snap = { installed, canPrompt: false, iosHint: !installed && isIOS() };
const subs = new Set<() => void>();
const publish = () => {
  snap = { installed, canPrompt: !!evt, iosHint: !installed && !evt && isIOS() };
  subs.forEach(f => f());
};
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evt = e as BIPEvent; publish(); });
window.addEventListener('appinstalled', () => { installed = true; evt = null; publish(); });
publish();

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** PWA install state. `canPrompt` = native prompt available; `iosHint` = iOS needs manual Add to Home Screen. */
export function useInstall() {
  const s = useSyncExternalStore(subscribe, () => snap);
  const install = useCallback(async () => {
    if (!evt) return;
    const e = evt;
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') installed = true;
    evt = null;
    publish();
  }, []);
  return { ...s, install };
}
