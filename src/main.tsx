import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Splash preloader: progress eases toward 90% while loading, completes on page load (min ~1.6s on screen)
const splash = document.getElementById('splash');
if (splash) {
  const arc = document.getElementById('splash-arc') as SVGElement | null;
  const pct = document.getElementById('splash-pct');
  const MIN_MS = 1600;
  const t0 = performance.now();
  let loaded = document.readyState === 'complete';
  let shown = 0;
  const set = (v: number) => {
    shown = v;
    if (arc) arc.style.strokeDashoffset = String(100 - v);
    if (pct) pct.textContent = Math.round(v) + '%';
  };
  const tick = () => {
    const elapsed = performance.now() - t0;
    const timeCap = Math.min(1, elapsed / MIN_MS);
    const target = loaded ? 100 * timeCap : Math.min(90, 90 * timeCap);
    set(Math.max(shown, shown + (target - shown) * 0.2));
    if (loaded && shown > 99) {
      set(100);
      setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 500); }, 200);
    } else requestAnimationFrame(tick);
  };
  if (!loaded) window.addEventListener('load', () => { loaded = true; }, { once: true });
  requestAnimationFrame(tick);
}
