import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  INITIAL_CATEGORIES,
  INITIAL_OFFERS,
  INITIAL_OPENING_HOURS,
  INITIAL_POLICIES,
  INITIAL_PRODUCTS,
  INITIAL_REVIEWS,
  INITIAL_REWARDS,
  INITIAL_SETTINGS,
  INITIAL_SOCIAL_LINKS,
} from '../lib/seedData';
import { evaluateStoreOpenStatus, type StoreOpenEvaluation } from '../lib/storeHours';
import { subscribeToRealtimeOrdersAndNotifications } from '../lib/supabaseClient';
import { playOrderNotificationSound, triggerBrowserPushNotification } from '../hooks/usePWA';
import type {
  AppNotification,
  BootstrapPayload,
  CartItem,
  Category,
  OpeningHour,
  Order,
  PolicyItem,
  Product,
  PromoOffer,
  RealtimeClientConfig,
  RealtimeEvent,
  Review,
  RewardOffer,
  SocialLink,
  StoreSettings,
  UserProfile,
} from '../types';

const CART_STORAGE_KEY = 'hfc_cart_v1';
const TOKEN_STORAGE_KEY = 'hfc_auth_token_v1';
const LAST_ORDER_KEY = 'hfc_last_order_v1';

function safeReadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteStorage(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Ignore storage quota issues
  }
}

interface StoreContextValue {
  loading: boolean;
  settings: StoreSettings;
  openingHours: OpeningHour[];
  storeStatus: StoreOpenEvaluation;
  categories: Category[];
  products: Product[];
  offers: PromoOffer[];
  rewards: RewardOffer[];
  reviews: Review[];
  policies: PolicyItem[];
  socialLinks: SocialLink[];
  user: UserProfile | null;
  token: string | null;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  notifications: AppNotification[];
  unreadCount: number;
  liveAlert: AppNotification | null;
  dismissLiveAlert: () => void;
  realtimeConfig: RealtimeClientConfig;
  wsConnected: boolean;
  supabaseStatus: 'disabled' | 'connecting' | 'connected' | 'error';
  statusAnnouncement: string;
  lastPlacedOrder: Order | null;
  setLastPlacedOrder: (order: Order | null) => void;
  addToCart: (productId: string, qty?: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setAuthSession: (token: string, profile: UserProfile) => void;
  updateUserProfileState: (profile: UserProfile) => void;
  logout: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(INITIAL_OPENING_HOURS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [offers, setOffers] = useState<PromoOffer[]>(INITIAL_OFFERS);
  const [rewards, setRewards] = useState<RewardOffer[]>(INITIAL_REWARDS);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [policies, setPolicies] = useState<PolicyItem[]>(INITIAL_POLICIES);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(INITIAL_SOCIAL_LINKS);

  const [token, setToken] = useState<string | null>(() => safeReadStorage<string | null>(TOKEN_STORAGE_KEY, null));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = safeReadStorage<CartItem[]>(CART_STORAGE_KEY, []);
    return Array.isArray(saved)
      ? saved.filter((i) => typeof i?.productId === 'string' && Number.isFinite(i?.quantity) && i.quantity > 0)
      : [];
  });
  const [lastPlacedOrder, setLastPlacedOrderState] = useState<Order | null>(() =>
    safeReadStorage<Order | null>(LAST_ORDER_KEY, null)
  );

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [liveAlert, setLiveAlert] = useState<AppNotification | null>(null);
  const [realtimeConfig, setRealtimeConfig] = useState<RealtimeClientConfig>({
    supabaseEnabled: false,
    supabaseUrl: null,
    supabaseAnonKey: null,
    vapidPublicKey: '',
    realtimeMode: 'ws',
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'disabled' | 'connecting' | 'connected' | 'error'>('disabled');
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [nowTick, setNowTick] = useState(() => new Date());

  const seenNotifIds = useRef<Set<string>>(new Set());

  const handleIncomingNotification = useCallback((incoming: AppNotification) => {
    if (seenNotifIds.current.has(incoming.id)) return;
    seenNotifIds.current.add(incoming.id);

    setNotifications((prev) => [incoming, ...prev]);
    setLiveAlert(incoming);
    playOrderNotificationSound();
    triggerBrowserPushNotification(incoming.title, incoming.body);
  }, []);

  const setLastPlacedOrder = useCallback((order: Order | null) => {
    setLastPlacedOrderState(order);
    safeWriteStorage(LAST_ORDER_KEY, order);
  }, []);

  const apiFetch = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers || {});
      if (!headers.has('Content-Type') && init?.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(url, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      return data as T;
    },
    [token]
  );

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await fetch('/api/bootstrap').then((r) => (r.ok ? (r.json() as Promise<BootstrapPayload>) : null));
      if (!data || typeof data !== 'object') return;
      if (data.settings && typeof data.settings === 'object') setSettings(data.settings);
      if (Array.isArray(data.openingHours)) setOpeningHours(data.openingHours);
      if (Array.isArray(data.categories)) setCategories(data.categories);
      if (Array.isArray(data.products)) setProducts(data.products);
      if (Array.isArray(data.offers)) setOffers(data.offers);
      if (Array.isArray(data.rewards)) setRewards(data.rewards);
      if (Array.isArray(data.reviews)) setReviews(data.reviews);
      if (Array.isArray(data.policies)) setPolicies(data.policies);
      if (Array.isArray(data.socialLinks)) setSocialLinks(data.socialLinks);
    } catch {
      // Keep cached/seeded data when offline
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: AppNotification[] }>('/api/notifications');
      if (Array.isArray(data.notifications)) {
        data.notifications.forEach((n) => seenNotifIds.current.add(n.id));
        setNotifications(data.notifications);
      }
    } catch {
      // Ignore unauthenticated or offline errors
    }
  }, [apiFetch]);

  // Initial load, realtime config & auth session hydration
  useEffect(() => {
    void refreshBootstrap();
    fetch('/api/realtime/config')
      .then((r) => (r.ok ? (r.json() as Promise<RealtimeClientConfig>) : null))
      .then((cfg) => {
        const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
        const envAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
        const resolvedUrl = cfg?.supabaseUrl || (envUrl && !envUrl.includes('your-project.supabase.co') ? envUrl : null);
        const resolvedAnon = cfg?.supabaseAnonKey || (envAnon && !envAnon.includes('your-supabase') ? envAnon : null);
        const enabled = Boolean(cfg?.supabaseEnabled || (resolvedUrl && resolvedAnon));
        setRealtimeConfig({
          supabaseEnabled: enabled,
          supabaseUrl: resolvedUrl,
          supabaseAnonKey: resolvedAnon,
          vapidPublicKey: cfg?.vapidPublicKey || (import.meta.env.VITE_VAPID_PUBLIC_KEY || null),
          realtimeMode: enabled ? 'supabase_and_ws' : 'ws',
        });
        setSupabaseStatus(enabled ? 'connecting' : 'disabled');
      })
      .catch(() => {});
  }, [refreshBootstrap]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      void refreshNotifications();
      return;
    }
    let active = true;
    apiFetch<{ user: UserProfile }>('/api/auth/me')
      .then((res) => {
        if (active) setUser(res.user);
      })
      .catch(() => {
        if (active) {
          setToken(null);
          setUser(null);
          safeWriteStorage(TOKEN_STORAGE_KEY, null);
        }
      });
    void refreshNotifications();
    return () => {
      active = false;
    };
  }, [token, apiFetch, refreshNotifications]);

  // Update Asia/Karachi clock display once per 30s (pure local clock, not network polling)
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Sync Admin-configured Brand Colors, Title, and Favicon live
  useEffect(() => {
    const root = document.documentElement;
    if (/^#[0-9A-Fa-f]{6}$/.test(settings.primaryGreen)) {
      root.style.setProperty('--color-primary', settings.primaryGreen);
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(settings.primaryYellow)) {
      root.style.setProperty('--color-gold', settings.primaryYellow);
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(settings.accentRed)) {
      root.style.setProperty('--color-spicy', settings.accentRed);
    }
    if (settings.faviconUrl) {
      const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (iconLink) {
        iconLink.href = settings.faviconUrl;
      }
    }
  }, [settings.primaryGreen, settings.primaryYellow, settings.accentRed, settings.faviconUrl]);

  // Real-time WebSocket connection (cleanup on unmount, auto-reconnect, idempotent deduplication)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const qs = token ? `?token=${encodeURIComponent(token)}` : '';
        ws = new WebSocket(`${proto}//${window.location.host}/ws${qs}`);
      } catch {
        if (!unmounted) {
          setWsConnected(false);
          reconnectTimer = window.setTimeout(connect, 5000);
        }
        return;
      }

      ws.onopen = () => {
        if (!unmounted) setWsConnected(true);
      };

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(String(evt.data)) as RealtimeEvent;
          if (event.type === 'notification:created') {
            handleIncomingNotification(event.notification);
          } else if (event.type === 'catalogue:updated') {
            void refreshBootstrap();
          } else if (event.type === 'settings:updated') {
            setSettings(event.settings);
            setOpeningHours(event.openingHours);
          } else if (event.type === 'order:updated') {
            setLastPlacedOrderState((prev) =>
              prev && prev.id === event.order.id ? event.order : prev
            );
          }
        } catch {
          // Ignore malformed event
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setWsConnected(false);
          reconnectTimer = window.setTimeout(connect, 3500);
        }
      };

      ws.onerror = () => {
        // Handled cleanly by onclose reconnect
      };
    };

    connect();

    return () => {
      unmounted = true;
      setWsConnected(false);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [token, refreshBootstrap, handleIncomingNotification]);

  // Scoped Supabase Realtime subscription (strictly `orders` & `notifications` tables)
  useEffect(() => {
    if (!realtimeConfig.supabaseEnabled || !realtimeConfig.supabaseUrl || !realtimeConfig.supabaseAnonKey) {
      setSupabaseStatus('disabled');
      return;
    }

    const unsubscribe = subscribeToRealtimeOrdersAndNotifications({
      supabaseUrl: realtimeConfig.supabaseUrl,
      supabaseAnonKey: realtimeConfig.supabaseAnonKey,
      userId: user?.id ?? null,
      role: user?.role ?? 'guest',
      onNotification: handleIncomingNotification,
      onOrderEvent: (orderPatch) => {
        setLastPlacedOrderState((prev) =>
          prev && (prev.id === orderPatch.id || prev.orderNumber === orderPatch.orderNumber)
            ? {
                ...prev,
                status: orderPatch.status ?? prev.status,
                updatedAt: orderPatch.updatedAt ?? prev.updatedAt,
              }
            : prev
        );
      },
      onStatusChange: (status) => setSupabaseStatus(status),
    });

    return () => {
      unsubscribe();
    };
  }, [
    realtimeConfig.supabaseEnabled,
    realtimeConfig.supabaseUrl,
    realtimeConfig.supabaseAnonKey,
    user?.id,
    user?.role,
    handleIncomingNotification,
  ]);

  // Persist cart safely
  useEffect(() => {
    safeWriteStorage(CART_STORAGE_KEY, cart);
  }, [cart]);

  const addToCart = useCallback(
    (productId: string, qty = 1) => {
      const prod = products.find((p) => p.id === productId);
      if (!prod || !prod.isAvailable || prod.stockQty <= 0) return;

      setCart((prev) => {
        const existing = prev.find((i) => i.productId === productId);
        const nextQty = Math.min(prod.stockQty, (existing?.quantity ?? 0) + Math.max(1, qty));
        if (existing) {
          return prev.map((i) => (i.productId === productId ? { ...i, quantity: nextQty } : i));
        }
        return [...prev, { productId, quantity: Math.min(prod.stockQty, Math.max(1, qty)) }];
      });
      setStatusAnnouncement(`Added ${prod.nameEn} to cart`);
    },
    [products]
  );

  const updateCartQty = useCallback(
    (productId: string, qty: number) => {
      const prod = products.find((p) => p.id === productId);
      const maxStock = prod ? prod.stockQty : 50;
      if (qty <= 0) {
        setCart((prev) => prev.filter((i) => i.productId !== productId));
        return;
      }
      setCart((prev) =>
        prev.map((i) =>
          i.productId === productId ? { ...i, quantity: Math.min(maxStock, Math.floor(qty)) } : i
        )
      );
    },
    [products]
  );

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
    setStatusAnnouncement('Removed item from cart');
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const setAuthSession = useCallback((newToken: string, profile: UserProfile) => {
    setToken(newToken);
    setUser(profile);
    safeWriteStorage(TOKEN_STORAGE_KEY, newToken);
  }, []);

  const updateUserProfileState = useCallback((profile: UserProfile) => {
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network error on logout
    }
    setToken(null);
    setUser(null);
    safeWriteStorage(TOKEN_STORAGE_KEY, null);
  }, [apiFetch]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      try {
        await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      } catch {
        // Ignore offline
      }
    },
    [apiFetch]
  );

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
    } catch {
      // Ignore offline
    }
  }, [apiFetch]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) return sum;
      const unit = prod.discountPrice !== null ? prod.discountPrice : prod.price;
      return sum + unit * item.quantity;
    }, 0);
  }, [cart, products]);

  const storeStatus = useMemo(
    () => evaluateStoreOpenStatus(settings, openingHours, nowTick),
    [settings, openingHours, nowTick]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const value: StoreContextValue = {
    loading,
    settings,
    openingHours,
    storeStatus,
    categories,
    products,
    offers,
    rewards,
    reviews,
    policies,
    socialLinks,
    user,
    token,
    cart,
    cartCount,
    cartSubtotal,
    notifications,
    unreadCount,
    liveAlert,
    dismissLiveAlert: () => setLiveAlert(null),
    realtimeConfig,
    wsConnected,
    supabaseStatus,
    statusAnnouncement,
    lastPlacedOrder,
    setLastPlacedOrder,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    setAuthSession,
    updateUserProfileState,
    logout,
    refreshBootstrap,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    apiFetch,
  };

  return (
    <StoreContext.Provider value={value}>
      <div className="sr-only" role="status" aria-live="polite">
        {statusAnnouncement}
      </div>
      {children}
    </StoreContext.Provider>
  );
};

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
