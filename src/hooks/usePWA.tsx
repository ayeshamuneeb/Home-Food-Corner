import React, { useCallback, useEffect, useState } from 'react';
import { BellOff, BellRing, Download, Smartphone, WifiOff, X } from 'lucide-react';
import { Button, Surface } from '../components/ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    try {
      const isStandalone =
        Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches) ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandalone);
    } catch {
      setIsInstalled(false);
    }

    const ua = (window.navigator?.userAgent || '').toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export function useWebPush(token: string | null) {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    try {
      return isSupported ? Notification.permission : 'unsupported';
    } catch {
      return 'unsupported';
    }
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const syncExistingSubscription = useCallback(async () => {
    if (!isSupported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(existing));
      setPermission(Notification.permission);

      if (existing) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers,
          body: JSON.stringify({ subscription: existing.toJSON() }),
        }).catch(() => {});
      }
    } catch {
      // Service worker not active yet
    }
  }, [isSupported, token]);

  useEffect(() => {
    void syncExistingSubscription();
  }, [syncExistingSubscription]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Web Push is not supported in this browser.');
      return false;
    }
    setBusy(true);
    setError('');
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Notification permission was declined in browser settings.');
        return false;
      }

      const cfgRes = await fetch('/api/realtime/config');
      const cfg = (await cfgRes.json()) as { vapidPublicKey?: string };
      const publicKey = (cfg.vapidPublicKey || import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
      if (!publicKey) {
        setError('Server VAPID key is not available.');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const keyBytes = urlBase64ToUint8Array(publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes.buffer as ArrayBuffer,
        });
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to register push subscription');
      }
      setIsSubscribed(true);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to enable Web Push alerts.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [isSupported, token]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setBusy(true);
    setError('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        }).catch(() => {});
        await existing.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe.');
    } finally {
      setBusy(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    busy,
    error,
    subscribe,
    unsubscribe,
    syncExistingSubscription,
  };
}

export const PushNotificationToggle: React.FC<{
  token: string | null;
  compact?: boolean;
  onStatusChange?: () => void;
}> = ({ token, compact = false, onStatusChange }) => {
  const { isSupported, permission, isSubscribed, busy, error, subscribe, unsubscribe } =
    useWebPush(token);

  if (!isSupported) {
    return compact ? null : (
      <span className="text-xs text-muted">Push alerts unsupported in this browser</span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {isSubscribed && permission === 'granted' ? (
        <Button
          tone="quiet"
          disabled={busy}
          onClick={async () => {
            await unsubscribe();
            onStatusChange?.();
          }}
          className={compact ? 'min-h-8 px-2.5 text-xs' : ''}
        >
          <BellOff className="h-3.5 w-3.5 text-primary" />
          <span>{busy ? 'Updating…' : compact ? 'Push On (Turn Off)' : 'Web Push Active · Disable'}</span>
        </Button>
      ) : (
        <Button
          tone="primary"
          disabled={busy}
          onClick={async () => {
            const ok = await subscribe();
            if (ok) onStatusChange?.();
          }}
          className={compact ? 'min-h-8 px-2.5 text-xs' : ''}
        >
          <BellRing className="h-3.5 w-3.5" />
          <span>{busy ? 'Enabling…' : compact ? 'Enable Push Alerts' : 'Enable Web Push Alerts'}</span>
        </Button>
      )}
      {error ? <p className="text-[11px] text-spicy">{error}</p> : null}
    </div>
  );
};

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  return (
    <>
      <Button
        tone="quiet"
        onClick={() => {
          if (isInstallable) {
            void install();
          } else {
            setShowGuide(true);
          }
        }}
        className={compact ? 'min-h-9 px-3 text-xs' : ''}
        aria-label="Install Home Food Corner App"
      >
        <Download className="h-4 w-4 text-gold" />
        <span>{compact ? 'Install' : 'Install App'}</span>
      </Button>

      {showGuide ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowGuide(false);
          }}
        >
          <Surface className="w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="h-5 w-5 text-gold" />
                <h2 id="pwa-install-title" className="text-lg font-semibold">
                  Install Home Food Corner App
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="rounded-control p-1.5 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 border-t border-border/50 pt-4 text-sm text-muted">
              {isIOS ? (
                <>
                  <p className="text-foreground font-medium">For iPhone / iPad (Safari):</p>
                  <p>1. Tap the <strong>Share</strong> icon at the bottom of Safari.</p>
                  <p>2. Scroll down and tap <strong>Add to Home Screen</strong>.</p>
                  <p className="font-urdu text-foreground">
                    سفاری میں Share بٹن دبائیں اور "Add to Home Screen" منتخب کریں۔
                  </p>
                </>
              ) : (
                <>
                  <p className="text-foreground font-medium">For Android / Desktop Chrome & Edge:</p>
                  <p>1. Open your browser menu (⋮) or address bar install icon.</p>
                  <p>2. Select <strong>Install app</strong> or <strong>Add to Home screen</strong> for instant 1-tap access.</p>
                  <p className="font-urdu text-foreground">
                    براؤزر مینو کھولیں اور "Install App" یا "Add to Home Screen" پر کلک کریں۔
                  </p>
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button tone="primary" onClick={() => setShowGuide(false)}>
                Got it
              </Button>
            </div>
          </Surface>
        </div>
      ) : null}
    </>
  );
};

const BANNER_DISMISSED_KEY = 'hfc_pwa_banner_dismissed';

export const MobilePWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showIosTip, setShowIosTip] = useState(false);

  if (isInstalled || dismissed || (!isInstallable && !isIOS)) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch {
      // Ignore storage error
    }
  };

  return (
    <div className="border-b border-border/60 bg-[#141d15] px-4 py-2 text-xs text-foreground md:hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Smartphone className="h-4 w-4 shrink-0 text-gold" />
          <span className="truncate font-medium">
            {isIOS ? 'Add HFC App to iPhone Home Screen' : 'Install Home Food Corner App'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (isInstallable) {
                void install();
              } else {
                setShowIosTip((v) => !v);
              }
            }}
            className="rounded-control bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
          >
            {isIOS ? 'How to Add' : 'Install'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install banner"
            className="rounded p-1 text-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {showIosTip ? (
        <p className="mt-1.5 text-[11px] text-muted">
          Safari میں Share بٹن دبائیں اور <strong>Add to Home Screen</strong> منتخب کریں۔
        </p>
      ) : null}
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-border bg-ember px-4 py-2 text-center text-xs font-medium text-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 text-gold" />
        <span>Offline mode — Browsing cached menu. Reconnect to place live orders · انٹرنیٹ منقطع ہے</span>
      </span>
    </div>
  );
};

export function playOrderNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [587.33, 880]; // D5 -> A5 crisp pleasant order bell
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.3);
    });

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([180, 80, 220]);
    }
  } catch {
    // Audio playback blocked prior to user gesture
  }
}

export function triggerBrowserPushNotification(title: string, body: string) {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
      });
    }
  } catch {
    // Ignore unsupported notification environments
  }
}
