import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

function renderMountFallback(rootEl: HTMLElement, message: string) {
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0B0B0B;color:#F9F8F6;font-family:Figtree,system-ui,sans-serif;">
      <div style="max-width:420px;width:100%;background:#171414;border:1px solid #332E2B;border-radius:14px;padding:24px;text-align:center;">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#FACC15;">Home Food Corner</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#B0A9A2;">${message}</p>
        <button onclick="window.location.reload()" style="background:#16A34A;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;">
          Reload Page
        </button>
      </div>
    </div>
  `;
}

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(<App />);
  } catch (err) {
    console.error('Root mount failure:', err);
    renderMountFallback(rootEl, 'The display encountered an unexpected error. Tap below to reload.');
  }
}

// Safely register push-capable Service Worker after initial render & clean stale dev caches
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    () => {
      window.setTimeout(() => {
        void (async () => {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(
              regs
                .filter((r) => {
                  const scriptUrl = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || '';
                  return scriptUrl.includes('dev-sw.js');
                })
                .map((r) => r.unregister().catch(() => false))
            );
            if ('caches' in window && import.meta.env.DEV) {
              const keys = await caches.keys();
              await Promise.all(
                keys
                  .filter((k) => k.startsWith('hfc-pwa-cache-'))
                  .map((k) => caches.delete(k).catch(() => false))
              );
            }
            await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          } catch {
            // Ignore restricted iframe / unsupported SW environments cleanly
          }
        })();
      }, 250);
    },
    { once: true }
  );
}
