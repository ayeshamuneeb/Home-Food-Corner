export {};

interface PrecacheEntry {
  url: string;
  revision: string | null;
}

interface SWExtendableEvent extends Event {
  waitUntil: (promise: Promise<unknown>) => void;
}

interface SWFetchEvent extends SWExtendableEvent {
  request: Request;
  respondWith: (response: Promise<Response> | Response) => void;
}

interface SWPushEvent extends SWExtendableEvent {
  data?: {
    json: () => unknown;
    text: () => string;
  } | null;
}

interface SWNotificationEvent extends SWExtendableEvent {
  notification: Notification & {
    data?: { url?: string; orderNumber?: string };
  };
  action: string;
}

interface SWWindowClient {
  url: string;
  focus: () => Promise<SWWindowClient>;
  navigate?: (url: string) => Promise<SWWindowClient | null>;
}

interface SWGlobalScope {
  __WB_MANIFEST?: Array<string | PrecacheEntry>;
  location: Location;
  skipWaiting: () => Promise<void>;
  clients: {
    claim: () => Promise<void>;
    matchAll: (opts?: { type?: string; includeUncontrolled?: boolean }) => Promise<SWWindowClient[]>;
    openWindow: (url: string) => Promise<SWWindowClient | null>;
  };
  registration: ServiceWorkerRegistration;
  addEventListener: (
    type: string,
    listener: (event: any) => void
  ) => void;
}

const CACHE_NAME = 'hfc-pwa-cache-v3';
const API_CACHE = 'hfc-api-bootstrap-v2';

// TypeScript strips the type assertion so compiled output keeps literal `self.__WB_MANIFEST`
const manifestEntries = (self as unknown as SWGlobalScope).__WB_MANIFEST || [];
const precacheList = manifestEntries
  .map((entry) => {
    const raw = typeof entry === 'string' ? entry : entry.url;
    return raw.startsWith('/') ? raw : `/${raw}`;
  })
  .filter((urlPath) => !urlPath.endsWith('.html') && urlPath !== '/');

(self as unknown as SWGlobalScope).addEventListener('install', (event: SWExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => (precacheList.length > 0 ? cache.addAll(precacheList) : Promise.resolve()))
      .catch(() => undefined)
      .then(() => (self as unknown as SWGlobalScope).skipWaiting())
  );
});

(self as unknown as SWGlobalScope).addEventListener('activate', (event: SWExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => (self as unknown as SWGlobalScope).clients.claim())
  );
});

(self as unknown as SWGlobalScope).addEventListener('fetch', (event: SWFetchEvent) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== (self as unknown as SWGlobalScope).location.origin) return;

  // Never intercept Vite dev modules, HMR paths, WebSocket upgrades, or authenticated APIs
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/ws') ||
    url.pathname === '/dev-sw.js' ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  // Always network-first for HTML page navigations so stale index.html can never break module hashes
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((c) => c || Response.error()))
    );
    return;
  }

  // Network-first for bootstrap menu cache so offline browsing still works
  if (url.pathname === '/api/bootstrap') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(API_CACHE).then((c) => c.put(req, clone)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Never cache authenticated or dynamic API endpoints
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Stale-while-revalidate strictly for immutable static precached assets (icons, images, hashed bundles)
  if (precacheList.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const netFetch = fetch(req)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => undefined);
            }
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || netFetch;
      })
    );
  }
});

// ==================== REAL WEB PUSH NOTIFICATION HANDLER ====================
(self as unknown as SWGlobalScope).addEventListener('push', (event: SWPushEvent) => {
  let payload: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
    orderNumber?: string;
    recipientRole?: 'admin' | 'customer' | 'broadcast';
  } = {};

  try {
    if (event.data) {
      payload = event.data.json() as typeof payload;
    }
  } catch {
    payload = {
      title: 'Home Food Corner',
      body: event.data?.text() || 'You have a new update from Home Food Corner.',
    };
  }

  const isAdminAlert = payload.recipientRole === 'admin';
  const title = payload.title || 'Home Food Corner · تازہ اطلاع';
  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: payload.body || 'Tap to view live order & kitchen updates.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || payload.orderNumber || 'hfc-live-update',
    renotify: true,
    silent: false,
    requireInteraction: isAdminAlert,
    vibrate: isAdminAlert ? [280, 100, 280, 100, 280] : [200, 90, 200],
    data: {
      url: payload.url || (isAdminAlert ? '/admin/orders' : '/orders'),
      orderNumber: payload.orderNumber,
    },
  };

  event.waitUntil((self as unknown as SWGlobalScope).registration.showNotification(title, options));
});

(self as unknown as SWGlobalScope).addEventListener('notificationclick', (event: SWNotificationEvent) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  const swScope = self as unknown as SWGlobalScope;

  event.waitUntil(
    swScope.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.startsWith(swScope.location.origin)) {
            if (client.navigate) {
              return client.navigate(targetUrl).then(() => client.focus());
            }
            return client.focus();
          }
        }
        return swScope.clients.openWindow(targetUrl);
      })
  );
});
