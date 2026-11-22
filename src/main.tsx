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

// Dismiss splash after a short minimum display time
const splash = document.getElementById('splash');
if (splash) {
  const shown = performance.now();
  const hide = () => setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 500); }, Math.max(0, 1200 - shown));
  document.readyState === 'complete' ? hide() : window.addEventListener('load', hide, { once: true });
}
