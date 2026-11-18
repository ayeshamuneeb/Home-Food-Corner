import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';
import {
  INITIAL_CATEGORIES,
  INITIAL_OFFERS,
  INITIAL_OPENING_HOURS,
  INITIAL_ORDERS,
  INITIAL_POLICIES,
  INITIAL_PRODUCTS,
  INITIAL_REVIEWS,
  INITIAL_REWARDS,
  INITIAL_SETTINGS,
  INITIAL_SOCIAL_LINKS,
} from './src/lib/seedData.ts';
import { calculateOrderPricing, evaluateStoreOpenStatus, formatPKR } from './src/lib/storeHours.ts';
import type {
  AdminLog,
  AppNotification,
  Category,
  ChatMessage,
  OpeningHour,
  Order,
  OrderStatus,
  PolicyItem,
  Product,
  PromoOffer,
  PushSubscriptionRecord,
  RealtimeEvent,
  Review,
  RewardOffer,
  RewardTransaction,
  SavedAddress,
  SocialLink,
  StockHistoryEntry,
  StoreSettings,
  UserProfile,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StoredUser extends UserProfile {
  passwordHash: string;
  twoFactorPin?: string;
}

interface SessionRecord {
  token: string;
  userId: string;
  role: 'customer' | 'admin';
  expiresAt: number;
}

interface DatabaseState {
  users: StoredUser[];
  categories: Category[];
  products: Product[];
  stockHistory: StockHistoryEntry[];
  orders: Order[];
  notifications: AppNotification[];
  pushSubscriptions: PushSubscriptionRecord[];
  vapidKeys?: { publicKey: string; privateKey: string };
  sessionSecret?: string;
  reviews: Review[];
  rewards: RewardOffer[];
  rewardTransactions: RewardTransaction[];
  offers: PromoOffer[];
  policies: PolicyItem[];
  socialLinks: SocialLink[];
  settings: StoreSettings;
  openingHours: OpeningHour[];
  aiChatMessages: Record<string, ChatMessage[]>;
  adminLogs: AdminLog[];
  orderSequence: number;
}

function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

function sanitizeText(input: unknown, maxLen = 600): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

function validateImageUrlOrDataUri(val: unknown): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/')) {
    return trimmed.slice(0, 300);
  }
  if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    if (trimmed.length > 2_800_000) {
      throw new Error('Image size exceeds 2MB limit.');
    }
    return trimmed;
  }
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    return trimmed.slice(0, 500);
  }
  throw new Error('Unsupported image format. Only PNG, JPG, or WebP images are allowed.');
}

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

function createInitialDb(): DatabaseState {
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@homefoodcorner.pk';
  return {
    users: [
      {
        id: 'usr-admin-1',
        email: adminEmail.toLowerCase(),
        fullName: 'Home Food Corner Owner',
        phone: '+92 300 5550147',
        role: 'admin',
        pointsBalance: 0,
        savedAddresses: [],
        twoFactorEnabled: false,
        twoFactorPin: '246810',
        passwordHash: hashPassword('HFC@Admin2026!'),
        createdAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'usr-customer-1',
        email: 'bilal@example.com',
        fullName: 'Bilal Ahmed',
        phone: '0301-5550192',
        role: 'customer',
        pointsBalance: 265,
        savedAddresses: [
          {
            id: 'addr-1',
            label: 'Home',
            address: 'House 18, Street 4, Block C, Gulshan-e-Iqbal, Karachi',
            landmark: 'Near Ayesha Masjid',
          },
        ],
        passwordHash: hashPassword('Customer123!'),
        createdAt: '2026-11-01T15:00:00Z',
      },
    ],
    categories: structuredClone(INITIAL_CATEGORIES),
    products: structuredClone(INITIAL_PRODUCTS),
    stockHistory: [
      {
        id: 'sh-1',
        productId: 'prod-loaded-drum',
        productName: 'Loaded Drum',
        previousQty: 20,
        newQty: 5,
        reason: 'Evening rush sales — low stock alert triggered',
        createdAt: '2026-11-17T18:55:00Z',
      },
    ],
    orders: structuredClone(INITIAL_ORDERS),
    notifications: [
      {
        id: 'notif-seed-1',
        recipientRole: 'admin',
        recipientUserId: null,
        orderId: 'ord-seed-1042',
        orderNumber: 'HFC-1042',
        customerName: 'Sana Tariq',
        itemsSummary: '1× Loaded Drum, 2× Creamy White Sauce Chicken Pasta',
        totalAmount: 1530,
        title: 'New Order HFC-1042 · Sana Tariq',
        body: '1× Loaded Drum, 2× Creamy White Sauce Pasta — Total Rs. 1,530',
        isRead: false,
        createdAt: '2026-11-17T18:50:00Z',
      },
    ],
    pushSubscriptions: [],
    reviews: structuredClone(INITIAL_REVIEWS),
    rewards: structuredClone(INITIAL_REWARDS),
    rewardTransactions: [
      {
        id: 'rt-1',
        userId: 'usr-customer-1',
        orderId: 'ord-seed-1041',
        pointsDelta: 112,
        description: 'Earned on Order HFC-1041',
        createdAt: '2026-11-17T16:42:00Z',
      },
      {
        id: 'rt-2',
        userId: 'usr-customer-1',
        orderId: null,
        pointsDelta: 153,
        description: 'Welcome loyalty bonus & previous orders',
        createdAt: '2026-11-10T16:00:00Z',
      },
    ],
    offers: structuredClone(INITIAL_OFFERS),
    policies: structuredClone(INITIAL_POLICIES),
    socialLinks: structuredClone(INITIAL_SOCIAL_LINKS),
    settings: structuredClone(INITIAL_SETTINGS),
    openingHours: structuredClone(INITIAL_OPENING_HOURS),
    aiChatMessages: {},
    adminLogs: [
      {
        id: 'log-1',
        adminEmail: adminEmail.toLowerCase(),
        action: 'STORE_INITIALIZED',
        entity: 'store_settings',
        details: 'Initialized Home Food Corner store in Asia/Karachi timezone',
        createdAt: '2026-11-17T12:00:00Z',
      },
    ],
    orderSequence: 1043,
  };
}

function loadDb(): DatabaseState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseState;
      if (parsed && Array.isArray(parsed.products) && parsed.settings) {
        if (!Array.isArray(parsed.pushSubscriptions)) {
          parsed.pushSubscriptions = [];
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read store.json, re-seeding:', err);
  }
  const fresh = createInitialDb();
  saveDb(fresh);
  return fresh;
}

function saveDb(state: DatabaseState): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('Failed to persist store.json:', err);
  }
}

const db: DatabaseState = loadDb();
const envTimezone = (process.env.STORE_TIMEZONE || '').trim();
if (envTimezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: envTimezone });
    db.settings.timezone = envTimezone;
  } catch {
    // Keep default Asia/Karachi if STORE_TIMEZONE is invalid
  }
}

const rawSessionSecret = (process.env.SESSION_SECRET || '').trim();
let EFFECTIVE_SESSION_SECRET =
  rawSessionSecret && !rawSessionSecret.includes('replace-with-strong-random')
    ? rawSessionSecret
    : db.sessionSecret || '';

if (!EFFECTIVE_SESSION_SECRET) {
  EFFECTIVE_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  db.sessionSecret = EFFECTIVE_SESSION_SECRET;
  saveDb(db);
}

const sessions = new Map<string, SessionRecord>();

// ==================== VAPID WEB PUSH & SUPABASE SERVICE CLIENT ====================
function resolveVapidConfig(): { publicKey: string; privateKey: string; subject: string } {
  const envPublic = (process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '').trim();
  const envPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || 'mailto:orders@homefoodcorner.pk').trim();

  if (
    envPublic &&
    envPrivate &&
    !envPublic.includes('your-vapid') &&
    !envPrivate.includes('your-vapid')
  ) {
    return { publicKey: envPublic, privateKey: envPrivate, subject };
  }

  if (!db.vapidKeys?.publicKey || !db.vapidKeys?.privateKey) {
    const generated = webpush.generateVAPIDKeys();
    db.vapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
    };
    saveDb(db);
  }

  return {
    publicKey: db.vapidKeys.publicKey,
    privateKey: db.vapidKeys.privateKey,
    subject,
  };
}

const vapidConfig = resolveVapidConfig();
try {
  webpush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);
} catch (err) {
  console.error('VAPID initialization warning:', err);
}

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
).trim();
const SUPABASE_ANON_KEY = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function isConfiguredSupabase(url: string, key: string): boolean {
  return (
    Boolean(url) &&
    Boolean(key) &&
    !url.includes('your-project.supabase.co') &&
    !key.includes('your-supabase') &&
    !key.includes('your-service-role') &&
    /^https?:\/\/.+/.test(url)
  );
}

const supabaseAdmin: SupabaseClient | null = isConfiguredSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const supabaseClientEnabled = isConfiguredSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);

const paymentGatewaysStatus = {
  stripeConfigured: Boolean((process.env.STRIPE_SECRET_KEY || '').trim()),
  jazzcashConfigured: Boolean((process.env.JAZZCASH_MERCHANT_ID || '').trim()),
  easypaisaConfigured: Boolean((process.env.EASYPAISA_STORE_ID || '').trim()),
};

// Rate limiting maps
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const failedAdminLogins = new Map<string, { fails: number; lockedUntil: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxRequests) {
    return false;
  }
  bucket.count += 1;
  return true;
}

function recomputeProductRatings(productId: string | null) {
  if (!productId) return;
  const prod = db.products.find((p) => p.id === productId);
  if (!prod) return;
  const visible = db.reviews.filter((r) => r.productId === productId && r.isVisible);
  prod.reviewCount = visible.length;
  if (visible.length === 0) {
    prod.averageRating = 0;
  } else {
    const sum = visible.reduce((acc, r) => acc + r.rating, 0);
    prod.averageRating = Math.round((sum / visible.length) * 10) / 10;
  }
}

function toPublicUser(u: StoredUser): UserProfile {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    pointsBalance: u.pointsBalance,
    savedAddresses: u.savedAddresses,
    twoFactorEnabled: u.twoFactorEnabled,
    createdAt: u.createdAt,
  };
}

function signTokenPayload(payloadB64: string): string {
  return crypto
    .createHmac('sha256', EFFECTIVE_SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
}

function createSession(user: StoredUser): string {
  // 8 hours for customer, 2 hours session timeout for admin
  const ttl = user.role === 'admin' ? 2 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const expiresAt = Date.now() + ttl;
  const payload = JSON.stringify({
    uid: user.id,
    role: user.role,
    exp: expiresAt,
    jti: crypto.randomBytes(12).toString('hex'),
  });
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = signTokenPayload(payloadB64);
  const token = `${payloadB64}.${sig}`;
  sessions.set(token, {
    token,
    userId: user.id,
    role: user.role,
    expiresAt,
  });
  return token;
}

function verifyTokenRecord(token: string): { userId: string; role: 'customer' | 'admin'; expiresAt: number } | null {
  if (!token) return null;
  const cached = sessions.get(token);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      sessions.delete(token);
      return null;
    }
    return cached;
  }
  // Verify stateless HMAC-SHA256 signature if SESSION_SECRET survived server restart
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = signTokenPayload(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      uid?: string;
      role?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) return null;
    const role = parsed.role === 'admin' ? 'admin' : 'customer';
    return { userId: parsed.uid, role, expiresAt: parsed.exp };
  } catch {
    return null;
  }
}

function getAuthenticatedUser(req: Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const session = verifyTokenRecord(token);
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to continue · براہ کرم لاگ ان کریں' });
    return;
  }
  (req as Request & { user?: StoredUser }).user = user;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin authorization required · صرف ایڈمن کو رسائی حاصل ہے' });
    return;
  }
  (req as Request & { user?: StoredUser }).user = user;
  next();
}

function appendAdminLog(adminEmail: string, action: string, entity: string, details: string) {
  db.adminLogs.unshift({
    id: `log-${crypto.randomUUID().slice(0, 8)}`,
    adminEmail,
    action,
    entity,
    details,
    createdAt: new Date().toISOString(),
  });
  if (db.adminLogs.length > 200) {
    db.adminLogs.length = 200;
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '4mb' }));

  // Basic security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ==================== REALTIME WEBSOCKET HUB ====================
  interface ClientSocketMeta {
    ws: WebSocket;
    userId: string | null;
    role: 'customer' | 'admin' | 'guest';
  }
  const clients = new Set<ClientSocketMeta>();
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url?.split('?')[0] || '';
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/ws', 'http://localhost:3000');
    const token = url.searchParams.get('token') || '';
    const validSession = verifyTokenRecord(token);

    const meta: ClientSocketMeta = {
      ws,
      userId: validSession?.userId ?? null,
      role: validSession?.role ?? 'guest',
    };
    clients.add(meta);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === 'auth') {
          const s = typeof msg.token === 'string' ? verifyTokenRecord(msg.token) : null;
          if (s) {
            meta.userId = s.userId;
            meta.role = s.role;
          } else {
            meta.userId = null;
            meta.role = 'guest';
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      clients.delete(meta);
    });
  });

  function broadcastEvent(event: RealtimeEvent) {
    const serialized = JSON.stringify(event);
    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      if (event.type === 'notification:created') {
        const n = event.notification;
        if (n.recipientRole === 'admin' && client.role !== 'admin') continue;
        if (n.recipientRole === 'customer' && n.recipientUserId && client.userId !== n.recipientUserId) {
          continue;
        }
      } else if (event.type === 'order:created' || event.type === 'order:updated') {
        const o = event.order;
        if (client.role !== 'admin' && o.userId && client.userId !== o.userId) {
          // Guest orders without userId can still update by order id on client if tracked locally
          continue;
        }
      }

      client.ws.send(serialized);
    }
  }

  async function mirrorOrderToSupabase(order: Order) {
    if (!supabaseAdmin) return;
    try {
      await supabaseAdmin.from('orders').upsert({
        id: order.id,
        order_number: order.orderNumber,
        user_id: order.userId,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        customer_address: order.customerAddress,
        fulfillment_type: order.fulfillmentType,
        payment_method: order.paymentMethod,
        notes: order.notes,
        items: order.items,
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee,
        discount_amount: order.discountAmount,
        total_amount: order.totalAmount,
        points_earned: order.pointsEarned,
        points_redeemed: order.pointsRedeemed,
        reward_id_used: order.rewardIdUsed,
        status: order.status,
        cancel_reason: order.cancelReason ?? null,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      });
    } catch (err) {
      console.error('Supabase order sync skipped:', err);
    }
  }

  async function sendWebPushToSubscribers(
    notif: AppNotification
  ): Promise<{ delivered: number; failed: number; pruned: number }> {
    const targetUrl =
      notif.recipientRole === 'admin'
        ? '/admin/orders'
        : notif.recipientRole === 'customer'
          ? '/orders'
          : '/menu';

    const targets = db.pushSubscriptions.filter((sub) => {
      if (notif.recipientRole === 'admin') return sub.role === 'admin';
      if (notif.recipientRole === 'customer') {
        return Boolean(notif.recipientUserId && sub.userId === notif.recipientUserId);
      }
      return true;
    });

    if (targets.length === 0) {
      return { delivered: 0, failed: 0, pruned: 0 };
    }

    const payload = JSON.stringify({
      id: notif.id,
      title: notif.title,
      body: notif.body,
      url: targetUrl,
      tag: notif.orderNumber ? `hfc-order-${notif.orderNumber}` : `hfc-notif-${notif.id}`,
      orderNumber: notif.orderNumber ?? null,
      recipientRole: notif.recipientRole,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    });

    let delivered = 0;
    let failed = 0;
    const staleEndpoints = new Set<string>();

    await Promise.all(
      targets.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            },
            payload,
            { TTL: 3600 }
          );
          delivered += 1;
        } catch (err: unknown) {
          failed += 1;
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? Number((err as { statusCode?: unknown }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.add(sub.endpoint);
          }
        }
      })
    );

    if (staleEndpoints.size > 0) {
      db.pushSubscriptions = db.pushSubscriptions.filter((s) => !staleEndpoints.has(s.endpoint));
      saveDb(db);
      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .in('endpoint', Array.from(staleEndpoints));
        } catch {
          // Ignore optional cleanup sync error
        }
      }
    }

    return { delivered, failed, pruned: staleEndpoints.size };
  }

  /**
   * Strictly server-side notification creation & dispatch.
   * Persists notification, emits WebSocket event, mirrors to Supabase Realtime
   * (`notifications` table), and dispatches encrypted VAPID Web Push alerts.
   */
  async function createAndDispatchNotification(params: {
    recipientRole: AppNotification['recipientRole'];
    recipientUserId: string | null;
    orderId: string | null;
    orderNumber?: string;
    customerName?: string;
    itemsSummary?: string;
    totalAmount?: number;
    title: string;
    body: string;
  }): Promise<{
    notification: AppNotification;
    pushStats: { delivered: number; failed: number; pruned: number };
  }> {
    const notification: AppNotification = {
      id: `notif-${crypto.randomUUID().slice(0, 10)}`,
      recipientRole: params.recipientRole,
      recipientUserId: params.recipientUserId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      customerName: params.customerName,
      itemsSummary: params.itemsSummary,
      totalAmount: params.totalAmount,
      title: sanitizeText(params.title, 120),
      body: sanitizeText(params.body, 320),
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    db.notifications.unshift(notification);
    if (db.notifications.length > 200) {
      db.notifications.length = 200;
    }
    saveDb(db);

    broadcastEvent({ type: 'notification:created', notification });

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('notifications').insert({
          id: notification.id,
          recipient_role: notification.recipientRole,
          recipient_user_id: notification.recipientUserId,
          order_id: notification.orderId,
          order_number: notification.orderNumber ?? null,
          customer_name: notification.customerName ?? null,
          items_summary: notification.itemsSummary ?? null,
          total_amount: notification.totalAmount ?? null,
          title: notification.title,
          body: notification.body,
          is_read: notification.isRead,
          created_at: notification.createdAt,
        });
      } catch (err) {
        console.error('Supabase notification insert skipped:', err);
      }
    }

    const pushStats = await sendWebPushToSubscribers(notification);
    return { notification, pushStats };
  }

  // ==================== PUBLIC BOOTSTRAP & REALTIME CONFIG ====================
  app.get('/api/realtime/config', (_req, res) => {
    res.json({
      supabaseEnabled: supabaseClientEnabled,
      supabaseUrl: supabaseClientEnabled ? SUPABASE_URL : null,
      supabaseAnonKey: supabaseClientEnabled ? SUPABASE_ANON_KEY : null,
      vapidPublicKey: vapidConfig.publicKey,
      realtimeMode: supabaseClientEnabled ? 'supabase_and_ws' : 'ws',
      timezone: db.settings.timezone,
      paymentGateways: paymentGatewaysStatus,
    });
  });
  app.get('/api/bootstrap', (_req, res) => {
    const visibleReviews = db.reviews.filter((r) => r.isVisible);
    const activeCategories = db.categories
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const activeSocials = db.socialLinks
      .filter((s) => s.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    res.json({
      settings: db.settings,
      openingHours: db.openingHours,
      categories: activeCategories,
      products: db.products,
      offers: db.offers.filter((o) => o.isActive),
      rewards: db.rewards.filter((r) => r.isActive),
      reviews: visibleReviews,
      policies: db.policies,
      socialLinks: activeSocials,
    });
  });

  // ==================== AUTHENTICATION ====================
  app.post('/api/auth/signup', (req, res) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(`signup:${ip}`, 10, 60_000)) {
      res.status(429).json({ error: 'Too many signup attempts. Please wait a minute.' });
      return;
    }

    const email = sanitizeText(req.body?.email, 120).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const fullName = sanitizeText(req.body?.fullName, 80);
    const phone = sanitizeText(req.body?.phone, 30);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address · درست ای میل درج کریں' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters · پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے' });
      return;
    }
    if (!fullName) {
      res.status(400).json({ error: 'Please enter your full name · اپنا نام درج کریں' });
      return;
    }
    if (db.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'An account with this email already exists · یہ ای میل پہلے سے رجسٹرڈ ہے' });
      return;
    }

    const newUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 10)}`,
      email,
      fullName,
      phone,
      role: 'customer',
      pointsBalance: 50, // Welcome bonus 50 pts
      savedAddresses: [],
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    db.rewardTransactions.unshift({
      id: `rt-${crypto.randomUUID().slice(0, 8)}`,
      userId: newUser.id,
      orderId: null,
      pointsDelta: 50,
      description: 'Welcome signup bonus · خوش آمدید بونس پوائنٹس',
      createdAt: new Date().toISOString(),
    });
    saveDb(db);

    const token = createSession(newUser);
    res.status(201).json({ token, user: toPublicUser(newUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(`login:${ip}`, 15, 60_000)) {
      res.status(429).json({ error: 'Too many login attempts. Please try again in a minute.' });
      return;
    }

    const email = sanitizeText(req.body?.email, 120).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = db.users.find((u) => u.email === email && u.role === 'customer');

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password · ای میل یا پاس ورڈ غلط ہے' });
      return;
    }

    const token = createSession(user);
    res.json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/google', (req, res) => {
    const email = sanitizeText(req.body?.email || 'guest.foodie@gmail.com', 120).toLowerCase();
    const fullName = sanitizeText(req.body?.fullName || 'Ayesha Khan', 80);

    let user = db.users.find((u) => u.email === email && u.role === 'customer');
    if (!user) {
      user = {
        id: `usr-${crypto.randomUUID().slice(0, 10)}`,
        email,
        fullName,
        phone: '',
        role: 'customer',
        pointsBalance: 50,
        savedAddresses: [],
        passwordHash: hashPassword(crypto.randomUUID()),
        createdAt: new Date().toISOString(),
      };
      db.users.push(user);
      db.rewardTransactions.unshift({
        id: `rt-${crypto.randomUUID().slice(0, 8)}`,
        userId: user.id,
        orderId: null,
        pointsDelta: 50,
        description: 'Google Sign-In welcome bonus',
        createdAt: new Date().toISOString(),
      });
      saveDb(db);
    }

    const token = createSession(user);
    res.json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/admin-login', (req, res) => {
    const ip = req.ip || 'local';
    const email = sanitizeText(req.body?.email, 120).toLowerCase();
    const lockKey = `${ip}:${email}`;
    const lockRecord = failedAdminLogins.get(lockKey);

    if (lockRecord && Date.now() < lockRecord.lockedUntil) {
      const waitSecs = Math.ceil((lockRecord.lockedUntil - Date.now()) / 1000);
      res.status(429).json({
        error: `Account temporarily locked after failed attempts. Try again in ${waitSecs}s.`,
      });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const twoFactorCode = sanitizeText(req.body?.twoFactorCode, 10);
    const admin = db.users.find((u) => u.email === email && u.role === 'admin');

    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      const fails = (lockRecord?.fails ?? 0) + 1;
      const lockedUntil = fails >= 5 ? Date.now() + 5 * 60 * 1000 : 0;
      failedAdminLogins.set(lockKey, { fails, lockedUntil });
      res.status(401).json({
        error: `Invalid admin credentials (${Math.max(0, 5 - fails)} attempts remaining)`,
      });
      return;
    }

    if (admin.twoFactorEnabled && admin.twoFactorPin && twoFactorCode !== admin.twoFactorPin) {
      res.status(401).json({ error: 'Valid 6-digit 2FA security PIN required', requiresTwoFactor: true });
      return;
    }

    failedAdminLogins.delete(lockKey);
    const token = createSession(admin);
    appendAdminLog(admin.email, 'ADMIN_LOGIN', 'auth', 'Admin signed into management console');
    saveDb(db);
    res.json({ token, user: toPublicUser(admin) });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    res.json({ user: toPublicUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      sessions.delete(authHeader.slice(7).trim());
    }
    res.json({ ok: true });
  });

  // ==================== CUSTOMER PROFILE, ORDERS & REWARDS ====================
  app.put('/api/profile', requireAuth, (req, res) => {
    const user = (req as Request & { user: StoredUser }).user;
    user.fullName = sanitizeText(req.body?.fullName, 80) || user.fullName;
    user.phone = sanitizeText(req.body?.phone, 30);
    if (Array.isArray(req.body?.savedAddresses)) {
      user.savedAddresses = req.body.savedAddresses.slice(0, 6).map((a: SavedAddress) => ({
        id: sanitizeText(a.id, 40) || `addr-${crypto.randomUUID().slice(0, 6)}`,
        label: sanitizeText(a.label, 30) || 'Home',
        address: sanitizeText(a.address, 220),
        landmark: sanitizeText(a.landmark, 100),
      }));
    }
    if (user.role === 'admin' && typeof req.body?.twoFactorEnabled === 'boolean') {
      user.twoFactorEnabled = req.body.twoFactorEnabled;
    }
    saveDb(db);
    res.json({ user: toPublicUser(user) });
  });

  app.post('/api/admin/security', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newEmail = sanitizeText(req.body?.newEmail, 120).toLowerCase();
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const twoFactorEnabled = typeof req.body?.twoFactorEnabled === 'boolean'
      ? req.body.twoFactorEnabled
      : Boolean(admin.twoFactorEnabled);
    const newTwoFactorPin = typeof req.body?.newTwoFactorPin === 'string'
      ? req.body.newTwoFactorPin.trim()
      : '';

    if (!currentPassword || !verifyPassword(currentPassword, admin.passwordHash)) {
      res.status(401).json({ error: 'Current password is incorrect · موجودہ پاس ورڈ غلط ہے' });
      return;
    }

    if (newEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        res.status(400).json({ error: 'Please enter a valid admin email address.' });
        return;
      }
      if (db.users.some((u) => u.id !== admin.id && u.email === newEmail)) {
        res.status(409).json({ error: 'This email is already used by another account.' });
        return;
      }
      admin.email = newEmail;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'New password must be at least 8 characters long.' });
        return;
      }
      admin.passwordHash = hashPassword(newPassword);
    }

    if (newTwoFactorPin) {
      if (!/^\d{6}$/.test(newTwoFactorPin)) {
        res.status(400).json({ error: '2FA PIN must be exactly 6 digits.' });
        return;
      }
      admin.twoFactorPin = newTwoFactorPin;
    }

    admin.twoFactorEnabled = twoFactorEnabled;

    // Revoke all older admin sessions and issue a fresh session for the owner
    for (const [tok, rec] of sessions.entries()) {
      if (rec.userId === admin.id) {
        sessions.delete(tok);
      }
    }
    const token = createSession(admin);
    appendAdminLog(
      admin.email,
      'UPDATE_SECURITY',
      'admin_auth',
      `Updated owner security (2FA: ${admin.twoFactorEnabled ? 'ON' : 'OFF'})`
    );
    saveDb(db);
    res.json({ ok: true, token, user: toPublicUser(admin) });
  });

  app.get('/api/my/orders', requireAuth, (req, res) => {
    const user = (req as Request & { user: StoredUser }).user;
    const myOrders = db.orders
      .filter((o) => o.userId === user.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    res.json({ orders: myOrders });
  });

  app.get('/api/orders/lookup/:orderNumber', (req, res) => {
    const orderNumber = sanitizeText(req.params.orderNumber, 30).toUpperCase();
    const found = db.orders.find((o) => o.orderNumber.toUpperCase() === orderNumber);
    if (!found) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const requester = getAuthenticatedUser(req);
    if (found.userId && (!requester || (requester.id !== found.userId && requester.role !== 'admin'))) {
      res.status(403).json({ error: 'Sign in to view this order' });
      return;
    }
    res.json({ order: found });
  });

  app.get('/api/my/rewards', requireAuth, (req, res) => {
    const user = (req as Request & { user: StoredUser }).user;
    const history = db.rewardTransactions.filter((t) => t.userId === user.id);
    res.json({
      pointsBalance: user.pointsBalance,
      rewards: db.rewards.filter((r) => r.isActive),
      transactions: history,
    });
  });

  app.get('/api/notifications', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (user?.role === 'admin') {
      res.json({ notifications: db.notifications.slice(0, 60) });
      return;
    }
    if (user) {
      const scoped = db.notifications.filter(
        (n) =>
          n.recipientRole === 'broadcast' ||
          (n.recipientRole === 'customer' && n.recipientUserId === user.id)
      );
      res.json({ notifications: scoped.slice(0, 40) });
      return;
    }
    const publicBroadcasts = db.notifications.filter((n) => n.recipientRole === 'broadcast');
    res.json({ notifications: publicBroadcasts.slice(0, 15) });
  });

  app.patch('/api/notifications/:id/read', (req, res) => {
    const notif = db.notifications.find((n) => n.id === req.params.id);
    if (notif) {
      notif.isRead = true;
      saveDb(db);
    }
    res.json({ ok: true });
  });

  // Block any client attempt to forge notifications directly
  app.post('/api/notifications', (_req, res) => {
    res.status(403).json({
      error: 'Forbidden: Notifications are generated strictly server-side.',
    });
  });

  app.post('/api/push/subscribe', (req, res) => {
    const sub = req.body?.subscription;
    const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint.trim() : '';
    const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh.trim() : '';
    const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth.trim() : '';

    if (
      !endpoint ||
      !/^https:\/\/.+/.test(endpoint) ||
      !p256dh ||
      !auth ||
      endpoint.length > 1000
    ) {
      res.status(400).json({ error: 'Invalid Web Push subscription payload.' });
      return;
    }

    // Derive userId and role strictly from authenticated session (never from client body)
    const user = getAuthenticatedUser(req);
    const role: PushSubscriptionRecord['role'] = user ? user.role : 'guest';
    const userId = user ? user.id : null;
    const userAgent = sanitizeText(req.headers['user-agent'], 180) || 'Browser';
    const nowIso = new Date().toISOString();

    const existing = db.pushSubscriptions.find((s) => s.endpoint === endpoint);
    if (existing) {
      existing.userId = userId;
      existing.role = role;
      existing.keys = { p256dh, auth };
      existing.userAgent = userAgent;
      existing.updatedAt = nowIso;
    } else {
      db.pushSubscriptions.unshift({
        id: `push-${crypto.randomUUID().slice(0, 10)}`,
        userId,
        role,
        endpoint,
        keys: { p256dh, auth },
        userAgent,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    saveDb(db);

    if (supabaseAdmin) {
      void supabaseAdmin
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            role,
            endpoint,
            p256dh,
            auth,
            user_agent: userAgent,
            updated_at: nowIso,
          },
          { onConflict: 'endpoint' }
        )
        .then(() => undefined, () => undefined);
    }

    res.status(201).json({
      subscribed: true,
      role,
      totalSubscribers: db.pushSubscriptions.length,
    });
  });

  app.post('/api/push/unsubscribe', (req, res) => {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
    if (!endpoint) {
      res.status(400).json({ error: 'Subscription endpoint is required.' });
      return;
    }

    const before = db.pushSubscriptions.length;
    db.pushSubscriptions = db.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
    if (db.pushSubscriptions.length !== before) {
      saveDb(db);
    }

    if (supabaseAdmin) {
      void supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .then(() => undefined, () => undefined);
    }

    res.json({ unsubscribed: true, totalSubscribers: db.pushSubscriptions.length });
  });

  app.get('/api/push/status', (req, res) => {
    const user = getAuthenticatedUser(req);
    const adminSubscribers = db.pushSubscriptions.filter((s) => s.role === 'admin').length;
    const customerSubscribers = db.pushSubscriptions.filter((s) => s.role === 'customer').length;
    const guestSubscribers = db.pushSubscriptions.filter((s) => s.role === 'guest').length;
    res.json({
      vapidConfigured: Boolean(vapidConfig.publicKey && vapidConfig.privateKey),
      supabaseEnabled: supabaseClientEnabled,
      supabaseAdminActive: Boolean(supabaseAdmin),
      totalSubscribers: db.pushSubscriptions.length,
      adminSubscribers: user?.role === 'admin' ? adminSubscribers : undefined,
      customerSubscribers: user?.role === 'admin' ? customerSubscribers : undefined,
      guestSubscribers: user?.role === 'admin' ? guestSubscribers : undefined,
    });
  });

  app.post('/api/notifications/read-all', (req, res) => {
    const user = getAuthenticatedUser(req);
    for (const n of db.notifications) {
      if (user?.role === 'admin' && n.recipientRole === 'admin') {
        n.isRead = true;
      } else if (user && n.recipientUserId === user.id) {
        n.isRead = true;
      }
    }
    saveDb(db);
    res.json({ ok: true });
  });

  // ==================== PLACE ORDER (SERVER-SIDE VALIDATION) ====================
  app.post('/api/orders', (req, res) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(`order:${ip}`, 10, 60_000)) {
      res.status(429).json({ error: 'Too many order requests. Please wait a moment.' });
      return;
    }

    // 1. Store timing check in Asia/Karachi
    const storeStatus = evaluateStoreOpenStatus(db.settings, db.openingHours, new Date());
    if (!storeStatus.isOpen) {
      res.status(400).json({
        error: storeStatus.closedBannerUr || `ابھی آرڈرز بند ہیں، افتتاحی وقت: ${storeStatus.nextOpeningLabel}`,
      });
      return;
    }

    const user = getAuthenticatedUser(req);
    const customerName = sanitizeText(req.body?.customerName, 80);
    const customerPhone = sanitizeText(req.body?.customerPhone, 30);
    const fulfillmentType = req.body?.fulfillmentType === 'pickup' ? 'pickup' : 'delivery';
    const customerAddress =
      fulfillmentType === 'pickup'
        ? 'Self Pickup at Home Food Corner Stall'
        : sanitizeText(req.body?.customerAddress, 240);
    const notes = sanitizeText(req.body?.notes, 300);
    const paymentMethod = ['cod', 'whatsapp_cod', 'jazzcash_placeholder', 'easypaisa_placeholder', 'card_placeholder'].includes(
      req.body?.paymentMethod
    )
      ? req.body.paymentMethod
      : 'cod';
    const rewardId = sanitizeText(req.body?.rewardId, 40);

    if (!customerName || customerName.length < 2) {
      res.status(400).json({ error: 'Please enter your name · براہ کرم اپنا نام درج کریں' });
      return;
    }
    if (!customerPhone || customerPhone.length < 7) {
      res.status(400).json({ error: 'Please enter a valid phone number · درست فون نمبر درج کریں' });
      return;
    }
    if (fulfillmentType === 'delivery' && (!customerAddress || customerAddress.length < 6)) {
      res.status(400).json({ error: 'Please enter complete delivery address · مکمل پتہ درج کریں' });
      return;
    }

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      res.status(400).json({ error: 'Your cart is empty · آپ کی کارٹ خالی ہے' });
      return;
    }

    // 2. Validate every product & stock server-side
    const validatedItems: Order['items'] = [];
    for (const item of rawItems) {
      const qty = Math.floor(Number(item?.quantity));
      if (!Number.isFinite(qty) || qty <= 0 || qty > 50) {
        res.status(400).json({ error: 'Invalid item quantity in cart.' });
        return;
      }
      const product = db.products.find((p) => p.id === item?.productId);
      if (!product || !product.isAvailable || product.stockQty < qty) {
        res.status(400).json({
          error: product
            ? `${product.nameEn} (${product.nameUr}) has only ${product.stockQty} left in stock.`
            : 'One of the selected items is no longer available.',
        });
        return;
      }
      const unitPrice = product.discountPrice !== null ? product.discountPrice : product.price;
      validatedItems.push({
        id: `oi-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        productNameEn: product.nameEn,
        productNameUr: product.nameUr,
        unitPrice,
        quantity: qty,
        lineTotal: unitPrice * qty,
      });
    }

    // 3. Validate reward redemption if requested
    let rewardDiscount = 0;
    let pointsRedeemed = 0;
    let usedReward: RewardOffer | undefined;
    if (rewardId && user) {
      usedReward = db.rewards.find((r) => r.id === rewardId && r.isActive);
      if (usedReward && user.pointsBalance >= usedReward.pointsRequired) {
        rewardDiscount = usedReward.discountValue;
        pointsRedeemed = usedReward.pointsRequired;
      }
    }

    const pricing = calculateOrderPricing({
      items: validatedItems,
      fulfillmentType,
      deliveryFee: db.settings.deliveryFee,
      freeDeliveryThreshold: db.settings.freeDeliveryThreshold,
      rewardDiscount,
      pointsPer100Pkr: db.settings.pointsPer100Pkr,
    });

    // 4. Deduct inventory & record stock history
    const nowIso = new Date().toISOString();
    const orderNumber = `HFC-${db.orderSequence++}`;
    const lowStockAlerts: { productName: string; remaining: number; outOfStock: boolean }[] = [];

    for (const oi of validatedItems) {
      const prod = db.products.find((p) => p.id === oi.productId)!;
      const prev = prod.stockQty;
      prod.stockQty = Math.max(0, prod.stockQty - oi.quantity);
      if (prod.stockQty === 0 && prod.autoDisableOnZero) {
        prod.isAvailable = false;
      }
      if (prev > prod.lowStockThreshold && prod.stockQty <= prod.lowStockThreshold) {
        lowStockAlerts.push({
          productName: prod.nameEn,
          remaining: prod.stockQty,
          outOfStock: prod.stockQty === 0,
        });
      }
      db.stockHistory.unshift({
        id: `sh-${crypto.randomUUID().slice(0, 8)}`,
        productId: prod.id,
        productName: prod.nameEn,
        previousQty: prev,
        newQty: prod.stockQty,
        reason: `Order ${orderNumber} (-${oi.quantity})`,
        createdAt: nowIso,
      });
    }

    // 5. Update customer loyalty points
    if (user) {
      if (pointsRedeemed > 0 && usedReward) {
        user.pointsBalance = Math.max(0, user.pointsBalance - pointsRedeemed);
        db.rewardTransactions.unshift({
          id: `rt-${crypto.randomUUID().slice(0, 8)}`,
          userId: user.id,
          orderId: orderNumber,
          pointsDelta: -pointsRedeemed,
          description: `Redeemed "${usedReward.titleEn}" on ${orderNumber}`,
          createdAt: nowIso,
        });
      }
      if (pricing.pointsEarned > 0) {
        user.pointsBalance += pricing.pointsEarned;
        db.rewardTransactions.unshift({
          id: `rt-${crypto.randomUUID().slice(0, 8)}`,
          userId: user.id,
          orderId: orderNumber,
          pointsDelta: pricing.pointsEarned,
          description: `Earned points on Order ${orderNumber}`,
          createdAt: nowIso,
        });
      }
    }

    const newOrder: Order = {
      id: `ord-${crypto.randomUUID().slice(0, 10)}`,
      orderNumber,
      userId: user?.id ?? null,
      customerName,
      customerPhone,
      customerAddress,
      fulfillmentType,
      paymentMethod,
      notes,
      items: validatedItems,
      subtotal: pricing.subtotal,
      deliveryFee: pricing.deliveryFee,
      discountAmount: pricing.discountAmount,
      totalAmount: pricing.totalAmount,
      pointsEarned: user ? pricing.pointsEarned : 0,
      pointsRedeemed,
      rewardIdUsed: usedReward?.id ?? null,
      status: 'New',
      statusHistory: [{ status: 'New', note: 'Order placed by customer', timestamp: nowIso }],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.orders.unshift(newOrder);
    saveDb(db);

    broadcastEvent({ type: 'order:created', order: newOrder });
    broadcastEvent({ type: 'catalogue:updated' });
    void mirrorOrderToSupabase(newOrder);

    const itemsSummary = validatedItems.map((i) => `${i.quantity}× ${i.productNameEn}`).join(', ');
    void createAndDispatchNotification({
      recipientRole: 'admin',
      recipientUserId: null,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      customerName: newOrder.customerName,
      itemsSummary,
      totalAmount: newOrder.totalAmount,
      title: `New Order ${newOrder.orderNumber} · ${newOrder.customerName}`,
      body: `${itemsSummary} · ${formatPKR(newOrder.totalAmount)} (${fulfillmentType.toUpperCase()})`,
    });

    for (const alert of lowStockAlerts) {
      void createAndDispatchNotification({
        recipientRole: 'admin',
        recipientUserId: null,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        title: alert.outOfStock
          ? `Out of Stock: ${alert.productName}`
          : `Low Stock Alert: ${alert.productName}`,
        body: alert.outOfStock
          ? `${alert.productName} hit 0 stock after ${newOrder.orderNumber} and was auto-disabled.`
          : `${alert.productName} has only ${alert.remaining} units remaining after ${newOrder.orderNumber}.`,
      });
    }

    res.status(201).json({
      order: newOrder,
      updatedPointsBalance: user?.pointsBalance ?? null,
    });
  });

  // ==================== REVIEWS & RATINGS ====================
  app.post('/api/reviews', requireAuth, (req, res) => {
    const user = (req as Request & { user: StoredUser }).user;
    const rating = Math.round(Number(req.body?.rating));
    const comment = sanitizeText(req.body?.comment, 500);
    const productId = req.body?.productId ? sanitizeText(req.body.productId, 50) : null;

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
      return;
    }
    if (comment.length < 3) {
      res.status(400).json({ error: 'Please write a brief review · براہ کرم اپنا تبصرہ لکھیں' });
      return;
    }

    const prod = productId ? db.products.find((p) => p.id === productId) : undefined;
    const nowIso = new Date().toISOString();

    const review: Review = {
      id: `rev-${crypto.randomUUID().slice(0, 10)}`,
      productId: prod?.id ?? null,
      productNameEn: prod?.nameEn,
      userId: user.id,
      customerName: user.fullName,
      rating,
      comment,
      isVisible: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.reviews.unshift(review);
    recomputeProductRatings(review.productId);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.status(201).json({ review });
  });

  app.put('/api/reviews/:id', requireAuth, (req, res) => {
    const user = (req as Request & { user: StoredUser }).user;
    const review = db.reviews.find((r) => r.id === req.params.id);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    if (review.userId !== user.id) {
      res.status(403).json({ error: 'You can only edit your own review · آپ صرف اپنا تبصرہ تبدیل کر سکتے ہیں' });
      return;
    }

    const rating = Math.round(Number(req.body?.rating));
    const comment = sanitizeText(req.body?.comment, 500);
    if (rating >= 1 && rating <= 5) review.rating = rating;
    if (comment.length >= 3) review.comment = comment;
    review.updatedAt = new Date().toISOString();

    recomputeProductRatings(review.productId);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ review });
  });

  app.delete('/api/reviews/:id', requireAuth, (req, res) => {
    const user = (req as Request & { user: StoredUser }).user;
    const idx = db.reviews.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    const target = db.reviews[idx];
    if (target.userId !== user.id && user.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own review' });
      return;
    }
    db.reviews.splice(idx, 1);
    recomputeProductRatings(target.productId);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ ok: true });
  });

  // ==================== AI MENU ASSISTANT (SERVER-SIDE GEMINI API) ====================
  app.get('/api/ai/history/:sessionId', (req, res) => {
    const sid = sanitizeText(req.params.sessionId, 64);
    res.json({ messages: db.aiChatMessages[sid] ?? [] });
  });

  app.delete('/api/ai/history/:sessionId', (req, res) => {
    const sid = sanitizeText(req.params.sessionId, 64);
    if (sid && db.aiChatMessages[sid]) {
      delete db.aiChatMessages[sid];
      saveDb(db);
    }
    res.json({ ok: true });
  });

  app.post('/api/ai/chat', async (req, res) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(`ai:${ip}`, 15, 60_000)) {
      res.status(429).json({ error: 'Chat rate limit reached. Please wait 30 seconds.' });
      return;
    }

    if (!db.settings.aiEnabled) {
      res.status(503).json({
        error: 'AI Assistant is temporarily paused by store management · اسسٹنٹ فی الحال بند ہے۔',
      });
      return;
    }

    const message = sanitizeText(req.body?.message, 500);
    const sessionId = sanitizeText(req.body?.sessionId || 'default', 64);

    if (!message) {
      res.status(400).json({ error: 'Please enter a question.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: 'AI service key is not configured in Settings > Secrets.',
      });
      return;
    }

    const storeStatus = evaluateStoreOpenStatus(db.settings, db.openingHours, new Date());
    const categoriesSummary = db.categories
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => `${c.nameEn} (${c.nameUr})`)
      .join(', ');

    const menuSummary = db.products
      .map((p) => {
        const effective = p.discountPrice !== null ? `${p.discountPrice} PKR (was ${p.price})` : `${p.price} PKR`;
        const stockText = p.isAvailable && p.stockQty > 0 ? 'Available' : 'Out of Stock';
        return `- ${p.nameEn} (${p.nameUr}) [${p.categorySlug}]: ${effective}, Spice: ${p.spicyLevel}, ${stockText}${p.isDailyDeal ? ', DAILY DEAL' : ''}`;
      })
      .join('\n');

    const hoursSummary = db.openingHours
      .map((h) => `${h.dayNameEn}: ${h.isClosed ? 'Closed' : `${h.openTime} to ${h.closeTime} PKT`}`)
      .join('; ');

    const dealsSummary = db.offers
      .filter((o) => o.isActive)
      .map((o) => `${o.titleEn} (${o.discountPercent}% off, code: ${o.code})`)
      .join('; ');

    const rewardsSummary = db.rewards
      .filter((r) => r.isActive)
      .map((r) => `${r.pointsRequired} pts = ${r.titleEn} (Rs. ${r.discountValue} off)`)
      .join('; ');

    const policiesSummary = db.policies
      .map((p) => `${p.titleEn}: ${p.contentEn}`)
      .join(' | ');

    const langRule =
      db.settings.aiLanguage === 'urdu'
        ? 'Respond primarily in natural Urdu.'
        : db.settings.aiLanguage === 'english'
          ? 'Respond primarily in clear concise English.'
          : 'Match the language of the customer (Urdu, Roman Urdu, or English) naturally and warmly.';

    const systemInstruction = `
You are the official customer assistant for "${db.settings.brandName}".
Personality: ${db.settings.aiPersonality}
Admin Instructions: ${db.settings.aiInstructions}
Additional Store Note: ${db.settings.aiKnowledgeNote}
Language Preference: ${langRule}

STRICT BOUNDARY:
- Only answer questions related to ${db.settings.brandName}: our menu, categories, prices, spice levels, recommendations, current availability, store opening/closing status, offers/daily deals, loyalty points/rewards, how to order (cart -> checkout -> Cash on Delivery or WhatsApp confirmation), delivery fees, policies, and contact/location.
- If a user asks an unrelated question (politics, coding, general trivia, essays, etc.), politely decline in 1-2 friendly Urdu/English sentences and offer to help pick something delicious from the menu.
- Keep answers short (under 90 words), helpful, and accurate to the live database below.

LIVE STORE DATA (Timezone: Asia/Karachi):
- Current Status: ${storeStatus.statusLabelEn} / ${storeStatus.statusLabelUr} (Local Time: ${storeStatus.karachiTimeLabel})
- Categories: ${categoriesSummary}
- Address: ${db.settings.addressEn} (${db.settings.addressUr})
- Contact / WhatsApp: ${db.settings.contactPhone}
- Delivery Fee: Rs. ${db.settings.deliveryFee} (FREE delivery on orders Rs. ${db.settings.freeDeliveryThreshold}+)
- Loyalty Points: Earn ${db.settings.pointsPer100Pkr} points per Rs. 100 spent. Rewards: ${rewardsSummary}
- Weekly Opening Hours: ${hoursSummary}
- Active Promotions: ${dealsSummary || 'Daily Deals active on select items'}
- Store Policies: ${policiesSummary}

LIVE MENU:
${menuSummary}
`.trim();

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const history = db.aiChatMessages[sessionId] ?? [];
      const recentContext = history
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const prompt = recentContext
        ? `Recent conversation:\n${recentContext}\n\nCustomer: ${message}`
        : message;

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
      } catch (firstErr: unknown) {
        const msg = firstErr instanceof Error ? firstErr.message : '';
        if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('ECONNRESET')) {
          await new Promise((r) => setTimeout(r, 400));
          response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: prompt,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });
        } else {
          throw firstErr;
        }
      }

      const replyText = (response.text ?? '').trim() || 'معذرت، براہ کرم دوبارہ پوچھیں۔';
      const nowIso = new Date().toISOString();

      const userMsg: ChatMessage = {
        id: `msg-${crypto.randomUUID().slice(0, 8)}`,
        role: 'user',
        content: message,
        createdAt: nowIso,
      };
      const botMsg: ChatMessage = {
        id: `msg-${crypto.randomUUID().slice(0, 8)}`,
        role: 'assistant',
        content: replyText,
        createdAt: nowIso,
      };

      if (!db.aiChatMessages[sessionId]) {
        db.aiChatMessages[sessionId] = [];
      }
      db.aiChatMessages[sessionId].push(userMsg, botMsg);
      if (db.aiChatMessages[sessionId].length > 30) {
        db.aiChatMessages[sessionId] = db.aiChatMessages[sessionId].slice(-30);
      }
      saveDb(db);

      res.json({ reply: botMsg });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'AI assistant request failed.';
      res.status(502).json({
        error: `Assistant unavailable: ${rawMsg}`,
      });
    }
  });

  // ==================== ADMIN PANEL ENDPOINTS ====================
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const now = new Date();
    const karachiDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: db.settings.timezone || 'Asia/Karachi',
    }).format(now);

    const todayOrders = db.orders.filter((o) => {
      const d = new Intl.DateTimeFormat('en-CA', {
        timeZone: db.settings.timezone || 'Asia/Karachi',
      }).format(new Date(o.createdAt));
      return d === karachiDateStr;
    });

    const pendingStatuses: OrderStatus[] = ['New', 'Accepted', 'Preparing', 'Ready', 'Out for delivery'];
    const pendingOrders = db.orders.filter((o) => pendingStatuses.includes(o.status));
    const completedOrders = db.orders.filter((o) => o.status === 'Completed');
    const revenue = db.orders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const salesMap = new Map<string, { productId: string; nameEn: string; qtySold: number; revenue: number }>();
    for (const order of db.orders) {
      if (order.status === 'Cancelled') continue;
      for (const item of order.items) {
        const cur = salesMap.get(item.productId) || {
          productId: item.productId,
          nameEn: item.productNameEn,
          qtySold: 0,
          revenue: 0,
        };
        cur.qtySold += item.quantity;
        cur.revenue += item.lineTotal;
        salesMap.set(item.productId, cur);
      }
    }
    const popularProducts = Array.from(salesMap.values())
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 6);

    const lowStockProducts = db.products.filter((p) => p.stockQty <= p.lowStockThreshold);
    const customerCount = db.users.filter((u) => u.role === 'customer').length;

    res.json({
      stats: {
        totalOrders: db.orders.length,
        todayOrders: todayOrders.length,
        pendingOrders: pendingOrders.length,
        completedOrders: completedOrders.length,
        revenue,
        customerCount,
      },
      popularProducts,
      lowStockProducts,
      orders: db.orders,
      categories: db.categories.sort((a, b) => a.sortOrder - b.sortOrder),
      products: db.products,
      stockHistory: db.stockHistory.slice(0, 60),
      offers: db.offers,
      reviews: db.reviews,
      rewards: db.rewards,
      rewardTransactions: db.rewardTransactions.slice(0, 80),
      policies: db.policies,
      socialLinks: db.socialLinks.sort((a, b) => a.sortOrder - b.sortOrder),
      adminLogs: db.adminLogs.slice(0, 60),
    });
  });

  // Brand & Store Settings + Opening Hours
  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const b = req.body || {};

    try {
      if (b.logoUrl !== undefined) {
        db.settings.logoUrl = validateImageUrlOrDataUri(b.logoUrl) || '/icon.svg';
      }
      if (b.faviconUrl !== undefined) {
        db.settings.faviconUrl = validateImageUrlOrDataUri(b.faviconUrl) || '/icon.svg';
      }
    } catch (e: unknown) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid brand image' });
      return;
    }

    if (b.brandName !== undefined) db.settings.brandName = sanitizeText(b.brandName, 80) || db.settings.brandName;
    if (b.taglineEn !== undefined) db.settings.taglineEn = sanitizeText(b.taglineEn, 180);
    if (b.taglineUr !== undefined) db.settings.taglineUr = sanitizeText(b.taglineUr, 180);
    if (typeof b.primaryGreen === 'string' && /^#[0-9A-Fa-f]{6}$/.test(b.primaryGreen.trim())) {
      db.settings.primaryGreen = b.primaryGreen.trim();
    }
    if (typeof b.primaryYellow === 'string' && /^#[0-9A-Fa-f]{6}$/.test(b.primaryYellow.trim())) {
      db.settings.primaryYellow = b.primaryYellow.trim();
    }
    if (typeof b.accentRed === 'string' && /^#[0-9A-Fa-f]{6}$/.test(b.accentRed.trim())) {
      db.settings.accentRed = b.accentRed.trim();
    }
    if (b.contactPhone !== undefined) db.settings.contactPhone = sanitizeText(b.contactPhone, 40);
    if (b.whatsappNumber !== undefined) db.settings.whatsappNumber = sanitizeText(b.whatsappNumber, 30).replace(/[^\d]/g, '');
    if (b.addressEn !== undefined) db.settings.addressEn = sanitizeText(b.addressEn, 220);
    if (b.addressUr !== undefined) db.settings.addressUr = sanitizeText(b.addressUr, 220);
    if (b.mapsUrl !== undefined) db.settings.mapsUrl = sanitizeText(b.mapsUrl, 300);
    if (b.deliveryFee !== undefined) db.settings.deliveryFee = Math.max(0, Math.round(Number(b.deliveryFee) || 0));
    if (b.freeDeliveryThreshold !== undefined) {
      db.settings.freeDeliveryThreshold = Math.max(0, Math.round(Number(b.freeDeliveryThreshold) || 0));
    }
    if (b.pointsPer100Pkr !== undefined) {
      db.settings.pointsPer100Pkr = Math.max(0, Math.min(100, Math.round(Number(b.pointsPer100Pkr) || 0)));
    }
    if (['scheduled', 'force_open_24h', 'force_closed', 'one_hour_window'].includes(b.timingMode)) {
      db.settings.timingMode = b.timingMode;
      if (b.timingMode === 'one_hour_window') {
        db.settings.oneHourOpensUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      } else {
        db.settings.oneHourOpensUntil = null;
      }
    }
    if (typeof b.aiEnabled === 'boolean') db.settings.aiEnabled = b.aiEnabled;
    if (b.aiPersonality !== undefined) db.settings.aiPersonality = sanitizeText(b.aiPersonality, 250);
    if (b.aiInstructions !== undefined) db.settings.aiInstructions = sanitizeText(b.aiInstructions, 500);
    if (b.aiKnowledgeNote !== undefined) db.settings.aiKnowledgeNote = sanitizeText(b.aiKnowledgeNote, 500);
    if (['bilingual', 'urdu', 'english'].includes(b.aiLanguage)) db.settings.aiLanguage = b.aiLanguage;

    appendAdminLog(admin.email, 'UPDATE_SETTINGS', 'store_settings', `Timing mode: ${db.settings.timingMode}`);
    saveDb(db);
    broadcastEvent({ type: 'settings:updated', settings: db.settings, openingHours: db.openingHours });
    res.json({ settings: db.settings });
  });

  app.post('/api/admin/brand-assets', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const b = req.body || {};

    const assetMap: Array<{ key: string; filename: string; mimePrefix: RegExp }> = [
      { key: 'logoTransparent', filename: 'logo-transparent.png', mimePrefix: /^data:image\/png;base64,/ },
      { key: 'pwa192', filename: 'pwa-192x192.png', mimePrefix: /^data:image\/png;base64,/ },
      { key: 'pwa512', filename: 'pwa-512x512.png', mimePrefix: /^data:image\/png;base64,/ },
      { key: 'pwaMaskable', filename: 'pwa-maskable-512x512.png', mimePrefix: /^data:image\/png;base64,/ },
      { key: 'appleTouchIcon', filename: 'apple-touch-icon.png', mimePrefix: /^data:image\/png;base64,/ },
      { key: 'faviconIco', filename: 'favicon.ico', mimePrefix: /^data:image\/(x-icon|vnd\.microsoft\.icon|png);base64,/ },
      { key: 'ogImage', filename: 'og-image.png', mimePrefix: /^data:image\/png;base64,/ },
    ];

    const publicDir = path.resolve(__dirname, 'public');
    const distDir = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    let writtenCount = 0;
    for (const item of assetMap) {
      const val = b[item.key];
      if (typeof val !== 'string' || !item.mimePrefix.test(val)) {
        res.status(400).json({ error: `Invalid image format for ${item.filename}` });
        return;
      }
      const base64Data = val.slice(val.indexOf('base64,') + 7);
      const buf = Buffer.from(base64Data, 'base64');
      if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
        res.status(400).json({ error: `Asset ${item.filename} exceeds allowed size.` });
        return;
      }
      fs.writeFileSync(path.join(publicDir, item.filename), buf);
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, item.filename), buf);
      }
      writtenCount += 1;
    }

    const ver = Date.now();
    db.settings.logoUrl = `/logo-transparent.png?v=${ver}`;
    db.settings.faviconUrl = `/favicon.ico?v=${ver}`;
    appendAdminLog(
      admin.email,
      'UPDATE_BRAND_ASSETS',
      'store_settings',
      `Deployed ${writtenCount} transparent logo, PWA, favicon & OG brand assets`
    );
    saveDb(db);
    broadcastEvent({ type: 'settings:updated', settings: db.settings, openingHours: db.openingHours });
    res.json({ ok: true, settings: db.settings, filesWritten: writtenCount });
  });

  app.put('/api/admin/opening-hours', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    if (Array.isArray(req.body?.openingHours)) {
      db.openingHours = req.body.openingHours.map((h: OpeningHour) => ({
        dayOfWeek: Number(h.dayOfWeek),
        dayNameEn: sanitizeText(h.dayNameEn, 20),
        dayNameUr: sanitizeText(h.dayNameUr, 20),
        openTime: /^\d{2}:\d{2}$/.test(h.openTime) ? h.openTime : '19:00',
        closeTime: /^\d{2}:\d{2}$/.test(h.closeTime) ? h.closeTime : '00:00',
        isClosed: Boolean(h.isClosed),
      }));
      appendAdminLog(admin.email, 'UPDATE_OPENING_HOURS', 'opening_hours', 'Updated weekly Karachi store schedule');
      saveDb(db);
      broadcastEvent({ type: 'settings:updated', settings: db.settings, openingHours: db.openingHours });
    }
    res.json({ openingHours: db.openingHours });
  });

  // Categories CRUD
  app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const nameEn = sanitizeText(req.body?.nameEn, 60);
    const nameUr = sanitizeText(req.body?.nameUr, 60);
    if (!nameEn) {
      res.status(400).json({ error: 'Category English name is required' });
      return;
    }

    let imageUrl: string | undefined;
    try {
      const validated = validateImageUrlOrDataUri(req.body?.imageUrl);
      if (validated) imageUrl = validated;
    } catch (e: unknown) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid category image' });
      return;
    }

    const baseSlug =
      sanitizeText(req.body?.slug || nameEn, 60)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `cat-${Date.now()}`;
    const slug = db.categories.some((c) => c.slug === baseSlug) ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

    const cat: Category = {
      id: `cat-${crypto.randomUUID().slice(0, 8)}`,
      slug,
      nameEn,
      nameUr: nameUr || nameEn,
      descriptionEn: sanitizeText(req.body?.descriptionEn, 200),
      descriptionUr: sanitizeText(req.body?.descriptionUr, 200),
      imageUrl,
      sortOrder: Number(req.body?.sortOrder) || db.categories.length + 1,
      isActive: req.body?.isActive !== false,
    };
    db.categories.push(cat);
    appendAdminLog(admin.email, 'CREATE_CATEGORY', 'categories', cat.nameEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.status(201).json({ category: cat });
  });

  app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const cat = db.categories.find((c) => c.id === req.params.id);
    if (!cat) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    if (req.body?.imageUrl !== undefined) {
      try {
        cat.imageUrl = validateImageUrlOrDataUri(req.body.imageUrl) || undefined;
      } catch (e: unknown) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid category image' });
        return;
      }
    }
    if (req.body?.nameEn) cat.nameEn = sanitizeText(req.body.nameEn, 60);
    if (req.body?.nameUr !== undefined) cat.nameUr = sanitizeText(req.body.nameUr, 60);
    if (req.body?.descriptionEn !== undefined) cat.descriptionEn = sanitizeText(req.body.descriptionEn, 200);
    if (req.body?.descriptionUr !== undefined) cat.descriptionUr = sanitizeText(req.body.descriptionUr, 200);
    if (req.body?.sortOrder !== undefined) cat.sortOrder = Number(req.body.sortOrder) || 0;
    if (typeof req.body?.isActive === 'boolean') cat.isActive = req.body.isActive;

    appendAdminLog(admin.email, 'UPDATE_CATEGORY', 'categories', cat.nameEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ category: cat });
  });

  app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const idx = db.categories.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const removed = db.categories.splice(idx, 1)[0];
    appendAdminLog(admin.email, 'DELETE_CATEGORY', 'categories', removed.nameEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ ok: true });
  });

  // Products CRUD
  app.post('/api/admin/products', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const b = req.body || {};
    const nameEn = sanitizeText(b.nameEn, 90);
    if (!nameEn) {
      res.status(400).json({ error: 'Product name is required' });
      return;
    }
    const cat = db.categories.find((c) => c.id === b.categoryId) || db.categories[0];
    let imageUrl: string | null = null;
    try {
      imageUrl = validateImageUrlOrDataUri(b.imageUrl);
    } catch (e: unknown) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid product image' });
      return;
    }

    const baseSlug =
      nameEn
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `item-${Date.now()}`;
    const slug = db.products.some((p) => p.slug === baseSlug) ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

    const price = Math.max(0, Math.round(Number(b.price) || 0));
    const discountPrice =
      b.discountPrice !== null && b.discountPrice !== '' && b.discountPrice !== undefined
        ? Math.max(0, Math.round(Number(b.discountPrice)))
        : null;
    const stockQty = Math.max(0, Math.round(Number(b.stockQty ?? 25)));

    const prod: Product = {
      id: `prod-${crypto.randomUUID().slice(0, 8)}`,
      categoryId: cat.id,
      categorySlug: cat.slug,
      slug,
      nameEn,
      nameUr: sanitizeText(b.nameUr, 90) || nameEn,
      descriptionEn: sanitizeText(b.descriptionEn, 320) || nameEn,
      descriptionUr: sanitizeText(b.descriptionUr, 320) || nameEn,
      price,
      discountPrice,
      spicyLevel: ['none', 'mild', 'medium', 'hot', 'extra_hot'].includes(b.spicyLevel) ? b.spicyLevel : 'medium',
      accentTone: ['cream', 'spicy_red', 'golden', 'cool_fresh', 'ember'].includes(b.accentTone) ? b.accentTone : 'golden',
      imageUrl,
      isAvailable: b.isAvailable !== false && stockQty > 0,
      isFeatured: Boolean(b.isFeatured),
      isDailyDeal: Boolean(b.isDailyDeal),
      stockQty,
      lowStockThreshold: Math.max(1, Math.round(Number(b.lowStockThreshold ?? 6))),
      autoDisableOnZero: b.autoDisableOnZero !== false,
      seoTitle: sanitizeText(b.seoTitle, 120) || `${nameEn} — Home Food Corner`,
      seoDescription: sanitizeText(b.seoDescription, 200) || sanitizeText(b.descriptionEn, 160),
      averageRating: 0,
      reviewCount: 0,
    };

    db.products.unshift(prod);
    appendAdminLog(admin.email, 'CREATE_PRODUCT', 'products', `${prod.nameEn} (${formatPKR(prod.price)})`);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.status(201).json({ product: prod });
  });

  app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const prod = db.products.find((p) => p.id === req.params.id);
    if (!prod) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const b = req.body || {};
    if (b.imageUrl !== undefined) {
      try {
        prod.imageUrl = validateImageUrlOrDataUri(b.imageUrl);
      } catch (e: unknown) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid product image' });
        return;
      }
    }
    if (b.categoryId) {
      const cat = db.categories.find((c) => c.id === b.categoryId);
      if (cat) {
        prod.categoryId = cat.id;
        prod.categorySlug = cat.slug;
      }
    }
    if (b.nameEn) prod.nameEn = sanitizeText(b.nameEn, 90);
    if (b.nameUr !== undefined) prod.nameUr = sanitizeText(b.nameUr, 90);
    if (b.descriptionEn !== undefined) prod.descriptionEn = sanitizeText(b.descriptionEn, 320);
    if (b.descriptionUr !== undefined) prod.descriptionUr = sanitizeText(b.descriptionUr, 320);
    if (b.price !== undefined) prod.price = Math.max(0, Math.round(Number(b.price) || 0));
    if (b.discountPrice !== undefined) {
      prod.discountPrice =
        b.discountPrice === null || b.discountPrice === '' ? null : Math.max(0, Math.round(Number(b.discountPrice)));
    }
    if (['none', 'mild', 'medium', 'hot', 'extra_hot'].includes(b.spicyLevel)) prod.spicyLevel = b.spicyLevel;
    if (['cream', 'spicy_red', 'golden', 'cool_fresh', 'ember'].includes(b.accentTone)) prod.accentTone = b.accentTone;
    if (b.stockQty !== undefined) prod.stockQty = Math.max(0, Math.round(Number(b.stockQty) || 0));
    if (b.lowStockThreshold !== undefined) {
      prod.lowStockThreshold = Math.max(0, Math.round(Number(b.lowStockThreshold) || 0));
    }
    if (typeof b.autoDisableOnZero === 'boolean') prod.autoDisableOnZero = b.autoDisableOnZero;
    if (typeof b.isAvailable === 'boolean') prod.isAvailable = b.isAvailable;
    if (typeof b.isFeatured === 'boolean') prod.isFeatured = b.isFeatured;
    if (typeof b.isDailyDeal === 'boolean') prod.isDailyDeal = b.isDailyDeal;
    if (b.seoTitle !== undefined) prod.seoTitle = sanitizeText(b.seoTitle, 120);
    if (b.seoDescription !== undefined) prod.seoDescription = sanitizeText(b.seoDescription, 200);

    if (prod.stockQty === 0 && prod.autoDisableOnZero) {
      prod.isAvailable = false;
    }

    appendAdminLog(admin.email, 'UPDATE_PRODUCT', 'products', prod.nameEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ product: prod });
  });

  app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const removed = db.products.splice(idx, 1)[0];
    appendAdminLog(admin.email, 'DELETE_PRODUCT', 'products', removed.nameEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ ok: true });
  });

  // Inventory quick update
  app.patch('/api/admin/inventory/:productId', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const prod = db.products.find((p) => p.id === req.params.productId);
    if (!prod) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const prev = prod.stockQty;
    const nextQty = Math.max(0, Math.round(Number(req.body?.stockQty ?? prev)));
    const reason = sanitizeText(req.body?.reason, 120) || 'Manual stock adjustment';

    if (typeof req.body?.autoDisableOnZero === 'boolean') {
      prod.autoDisableOnZero = req.body.autoDisableOnZero;
    }

    prod.stockQty = nextQty;
    if (typeof req.body?.isAvailable === 'boolean') {
      prod.isAvailable = req.body.isAvailable;
    } else if (nextQty === 0 && prod.autoDisableOnZero) {
      prod.isAvailable = false;
    } else if (nextQty > 0 && req.body?.reEnable !== false) {
      prod.isAvailable = true;
    }

    if (nextQty !== prev) {
      db.stockHistory.unshift({
        id: `sh-${crypto.randomUUID().slice(0, 8)}`,
        productId: prod.id,
        productName: prod.nameEn,
        previousQty: prev,
        newQty: nextQty,
        reason,
        createdAt: new Date().toISOString(),
      });
    }
    appendAdminLog(admin.email, 'ADJUST_STOCK', 'inventory', `${prod.nameEn}: ${prev} -> ${nextQty}`);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ product: prod });
  });

  // Order status update + Customer Realtime Notification
  app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const allowed: OrderStatus[] = [
      'New',
      'Accepted',
      'Preparing',
      'Ready',
      'Out for delivery',
      'Completed',
      'Cancelled',
    ];
    const nextStatus = req.body?.status as OrderStatus;
    if (!allowed.includes(nextStatus)) {
      res.status(400).json({ error: 'Invalid order status' });
      return;
    }

    const cancelReason = sanitizeText(req.body?.cancelReason, 200);
    const nowIso = new Date().toISOString();
    order.status = nextStatus;
    if (nextStatus === 'Cancelled' && cancelReason) {
      order.cancelReason = cancelReason;
    }
    order.updatedAt = nowIso;
    order.statusHistory.push({
      status: nextStatus,
      note: nextStatus === 'Cancelled' ? cancelReason : undefined,
      timestamp: nowIso,
    });

    appendAdminLog(admin.email, 'UPDATE_ORDER_STATUS', 'orders', `${order.orderNumber} -> ${nextStatus}`);
    saveDb(db);
    broadcastEvent({ type: 'order:updated', order });
    void mirrorOrderToSupabase(order);

    if (order.userId) {
      void createAndDispatchNotification({
        recipientRole: 'customer',
        recipientUserId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        title: `Order ${order.orderNumber} · ${nextStatus}`,
        body:
          nextStatus === 'Cancelled'
            ? `Your order was cancelled${cancelReason ? `: ${cancelReason}` : ''}.`
            : `Your Home Food Corner order is now "${nextStatus}".`,
      });
    }

    res.json({ order });
  });

  // Broadcast notification to all customers (server-side created & Web Push dispatched)
  app.post('/api/admin/notifications/broadcast', requireAdmin, async (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const title = sanitizeText(req.body?.title, 100);
    const body = sanitizeText(req.body?.body, 280);
    if (!title || !body) {
      res.status(400).json({ error: 'Notification title and message are required' });
      return;
    }

    appendAdminLog(admin.email, 'BROADCAST_NOTIFICATION', 'notifications', title);
    const { notification, pushStats } = await createAndDispatchNotification({
      recipientRole: 'broadcast',
      recipientUserId: null,
      orderId: null,
      title,
      body,
    });
    res.status(201).json({ notification, pushStats });
  });

  // Admin test push notification (verifies end-to-end VAPID Web Push delivery)
  app.post('/api/admin/notifications/test-push', requireAdmin, async (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    appendAdminLog(admin.email, 'TEST_WEB_PUSH', 'notifications', 'Triggered test Web Push alert');
    const { notification, pushStats } = await createAndDispatchNotification({
      recipientRole: 'admin',
      recipientUserId: null,
      orderId: null,
      title: 'Home Food Corner · Test Kitchen Alert',
      body: 'Real-time Web Push notifications are active on this device!',
    });
    res.status(201).json({ notification, pushStats });
  });

  // Offers CRUD
  app.post('/api/admin/offers', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const b = req.body || {};
    let imageUrl: string | undefined;
    try {
      const validated = validateImageUrlOrDataUri(b.imageUrl);
      if (validated) imageUrl = validated;
    } catch (e: unknown) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid offer image' });
      return;
    }

    const offer: PromoOffer = {
      id: `offer-${crypto.randomUUID().slice(0, 8)}`,
      titleEn: sanitizeText(b.titleEn, 120) || 'Special Evening Deal',
      titleUr: sanitizeText(b.titleUr, 120) || 'خصوصی آفر',
      subtitleEn: sanitizeText(b.subtitleEn, 180),
      subtitleUr: sanitizeText(b.subtitleUr, 180),
      discountPercent: Math.max(0, Math.min(90, Math.round(Number(b.discountPercent) || 10))),
      code: sanitizeText(b.code, 24).toUpperCase() || 'HFCDEAL',
      imageUrl,
      startsAt: sanitizeText(b.startsAt, 40) || new Date().toISOString(),
      endsAt: sanitizeText(b.endsAt, 40) || '2027-12-31T23:59:59Z',
      isActive: b.isActive !== false,
    };
    db.offers.unshift(offer);
    appendAdminLog(admin.email, 'CREATE_OFFER', 'offers', offer.titleEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.status(201).json({ offer });
  });

  app.put('/api/admin/offers/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const offer = db.offers.find((o) => o.id === req.params.id);
    if (!offer) {
      res.status(404).json({ error: 'Offer not found' });
      return;
    }
    const b = req.body || {};
    if (b.imageUrl !== undefined) {
      try {
        offer.imageUrl = validateImageUrlOrDataUri(b.imageUrl) || undefined;
      } catch (e: unknown) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid offer image' });
        return;
      }
    }
    if (b.titleEn !== undefined) offer.titleEn = sanitizeText(b.titleEn, 120);
    if (b.titleUr !== undefined) offer.titleUr = sanitizeText(b.titleUr, 120);
    if (b.subtitleEn !== undefined) offer.subtitleEn = sanitizeText(b.subtitleEn, 180);
    if (b.subtitleUr !== undefined) offer.subtitleUr = sanitizeText(b.subtitleUr, 180);
    if (b.discountPercent !== undefined) {
      offer.discountPercent = Math.max(0, Math.min(90, Math.round(Number(b.discountPercent) || 0)));
    }
    if (b.code !== undefined) offer.code = sanitizeText(b.code, 24).toUpperCase();
    if (b.startsAt !== undefined) offer.startsAt = sanitizeText(b.startsAt, 40) || offer.startsAt;
    if (b.endsAt !== undefined) offer.endsAt = sanitizeText(b.endsAt, 40) || offer.endsAt;
    if (typeof b.isActive === 'boolean') offer.isActive = b.isActive;
    appendAdminLog(admin.email, 'UPDATE_OFFER', 'offers', offer.titleEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ offer });
  });

  app.delete('/api/admin/offers/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const idx = db.offers.findIndex((o) => o.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Offer not found' });
      return;
    }
    const removed = db.offers.splice(idx, 1)[0];
    appendAdminLog(admin.email, 'DELETE_OFFER', 'offers', removed.titleEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ ok: true });
  });

  // Admin review moderation
  app.patch('/api/admin/reviews/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const rev = db.reviews.find((r) => r.id === req.params.id);
    if (!rev) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    if (typeof req.body?.isVisible === 'boolean') rev.isVisible = req.body.isVisible;
    if (req.body?.adminReply !== undefined) rev.adminReply = sanitizeText(req.body.adminReply, 300);
    rev.updatedAt = new Date().toISOString();
    recomputeProductRatings(rev.productId);
    appendAdminLog(admin.email, 'MODERATE_REVIEW', 'reviews', `Review ${rev.id} visibility=${rev.isVisible}`);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ review: rev });
  });

  // Rewards CRUD
  app.post('/api/admin/rewards', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const b = req.body || {};
    const rew: RewardOffer = {
      id: `rew-${crypto.randomUUID().slice(0, 8)}`,
      titleEn: sanitizeText(b.titleEn, 80) || 'Loyalty Reward',
      titleUr: sanitizeText(b.titleUr, 80) || 'انعامی آفر',
      descriptionEn: sanitizeText(b.descriptionEn, 180),
      descriptionUr: sanitizeText(b.descriptionUr, 180),
      pointsRequired: Math.max(10, Math.round(Number(b.pointsRequired) || 100)),
      discountValue: Math.max(10, Math.round(Number(b.discountValue) || 100)),
      rewardType: b.rewardType === 'flat_discount' ? 'flat_discount' : 'free_item',
      isActive: b.isActive !== false,
    };
    db.rewards.push(rew);
    appendAdminLog(admin.email, 'CREATE_REWARD', 'rewards', rew.titleEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.status(201).json({ reward: rew });
  });

  app.put('/api/admin/rewards/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const rew = db.rewards.find((r) => r.id === req.params.id);
    if (!rew) {
      res.status(404).json({ error: 'Reward not found' });
      return;
    }
    const b = req.body || {};
    if (b.titleEn !== undefined) rew.titleEn = sanitizeText(b.titleEn, 80);
    if (b.titleUr !== undefined) rew.titleUr = sanitizeText(b.titleUr, 80);
    if (b.descriptionEn !== undefined) rew.descriptionEn = sanitizeText(b.descriptionEn, 180);
    if (b.descriptionUr !== undefined) rew.descriptionUr = sanitizeText(b.descriptionUr, 180);
    if (b.rewardType === 'free_item' || b.rewardType === 'flat_discount') rew.rewardType = b.rewardType;
    if (b.pointsRequired !== undefined) rew.pointsRequired = Math.max(10, Math.round(Number(b.pointsRequired) || 100));
    if (b.discountValue !== undefined) rew.discountValue = Math.max(10, Math.round(Number(b.discountValue) || 100));
    if (typeof b.isActive === 'boolean') rew.isActive = b.isActive;
    appendAdminLog(admin.email, 'UPDATE_REWARD', 'rewards', rew.titleEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ reward: rew });
  });

  app.delete('/api/admin/rewards/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const idx = db.rewards.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Reward not found' });
      return;
    }
    const removed = db.rewards.splice(idx, 1)[0];
    appendAdminLog(admin.email, 'DELETE_REWARD', 'rewards', removed.titleEn);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ ok: true });
  });

  // Policies CRUD
  app.post('/api/admin/policies', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const titleEn = sanitizeText(req.body?.titleEn, 100);
    if (!titleEn) {
      res.status(400).json({ error: 'Policy title (English) is required' });
      return;
    }
    const baseSlug =
      sanitizeText(req.body?.slug || titleEn, 60)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `policy-${Date.now()}`;
    const slug = db.policies.some((p) => p.slug === baseSlug) ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;
    const pol: PolicyItem = {
      slug,
      titleEn,
      titleUr: sanitizeText(req.body?.titleUr, 100) || titleEn,
      contentEn: sanitizeText(req.body?.contentEn, 1500),
      contentUr: sanitizeText(req.body?.contentUr, 1500),
      updatedAt: new Date().toISOString(),
    };
    db.policies.push(pol);
    appendAdminLog(admin.email, 'CREATE_POLICY', 'policies', pol.slug);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.status(201).json({ policy: pol });
  });

  app.put('/api/admin/policies/:slug', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const pol = db.policies.find((p) => p.slug === req.params.slug);
    if (!pol) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }
    if (req.body?.titleEn !== undefined) pol.titleEn = sanitizeText(req.body.titleEn, 100);
    if (req.body?.titleUr !== undefined) pol.titleUr = sanitizeText(req.body.titleUr, 100);
    if (req.body?.contentEn !== undefined) pol.contentEn = sanitizeText(req.body.contentEn, 1500);
    if (req.body?.contentUr !== undefined) pol.contentUr = sanitizeText(req.body.contentUr, 1500);
    pol.updatedAt = new Date().toISOString();
    appendAdminLog(admin.email, 'UPDATE_POLICY', 'policies', pol.slug);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ policy: pol });
  });

  app.delete('/api/admin/policies/:slug', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const idx = db.policies.findIndex((p) => p.slug === req.params.slug);
    if (idx === -1) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }
    const removed = db.policies.splice(idx, 1)[0];
    appendAdminLog(admin.email, 'DELETE_POLICY', 'policies', removed.slug);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ ok: true });
  });

  // Social Links CRUD
  app.post('/api/admin/social-links', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const b = req.body || {};
    const link: SocialLink = {
      id: `soc-${crypto.randomUUID().slice(0, 8)}`,
      platform: ['instagram', 'facebook', 'youtube', 'linkedin', 'whatsapp', 'tiktok', 'twitter', 'custom'].includes(
        b.platform
      )
        ? b.platform
        : 'custom',
      label: sanitizeText(b.label, 60) || 'Social Channel',
      url: sanitizeText(b.url, 300) || 'https://',
      isActive: b.isActive !== false,
      sortOrder: Number(b.sortOrder) || db.socialLinks.length + 1,
    };
    db.socialLinks.push(link);
    appendAdminLog(admin.email, 'CREATE_SOCIAL_LINK', 'social_links', `${link.platform}:${link.label}`);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.status(201).json({ socialLink: link });
  });

  app.put('/api/admin/social-links/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const link = db.socialLinks.find((s) => s.id === req.params.id);
    if (!link) {
      res.status(404).json({ error: 'Social link not found' });
      return;
    }
    if (
      ['instagram', 'facebook', 'youtube', 'linkedin', 'whatsapp', 'tiktok', 'twitter', 'custom'].includes(
        req.body?.platform
      )
    ) {
      link.platform = req.body.platform;
    }
    if (req.body?.label !== undefined) link.label = sanitizeText(req.body.label, 60);
    if (req.body?.url !== undefined) link.url = sanitizeText(req.body.url, 300);
    if (req.body?.sortOrder !== undefined) link.sortOrder = Number(req.body.sortOrder) || 1;
    if (typeof req.body?.isActive === 'boolean') link.isActive = req.body.isActive;
    appendAdminLog(admin.email, 'UPDATE_SOCIAL_LINK', 'social_links', `${link.platform}:${link.label}`);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ socialLink: link });
  });

  app.delete('/api/admin/social-links/:id', requireAdmin, (req, res) => {
    const admin = (req as Request & { user: StoredUser }).user;
    const idx = db.socialLinks.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Social link not found' });
      return;
    }
    const removed = db.socialLinks.splice(idx, 1)[0];
    appendAdminLog(admin.email, 'DELETE_SOCIAL_LINK', 'social_links', `${removed.platform}:${removed.label}`);
    saveDb(db);
    broadcastEvent({ type: 'catalogue:updated' });
    res.json({ ok: true });
  });

  // ==================== SEO ROBOTS.TXT & DYNAMIC SITEMAP.XML ====================
  app.get('/robots.txt', (req, res) => {
    const origin = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const staticRoutes = ['/', '/menu', '/rewards', '/reviews', '/policies', '/contact', '/orders'];
    const categoryRoutes = db.categories.filter((c) => c.isActive).map((c) => `/category/${c.slug}`);
    const productRoutes = db.products.map((p) => `/product/${p.slug}`);
    const allUrls = [...staticRoutes, ...categoryRoutes, ...productRoutes];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allUrls
      .map((route) => `  <url><loc>${origin}${route}</loc><changefreq>daily</changefreq></url>`)
      .join('\n')}\n</urlset>\n`;
    res.type('application/xml').send(xml);
  });

  // ==================== VITE MIDDLEWARE / PRODUCTION ASSETS ====================
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist/index.html'));

  if (!isProd) {
    // Self-cleaning service worker endpoints in dev mode:
    // 1) /dev-sw.js replaces & unregisters any old broken VitePWA dev-sw and clears stale caches
    // 2) /sw.js supports Web Push notifications cleanly without ever intercepting Vite modules or HTML
    const devPushSwScript = `
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch {
    payload = { title: 'Home Food Corner', body: event.data ? event.data.text() : 'New update' };
  }
  const isAdminAlert = payload.recipientRole === 'admin';
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Home Food Corner', {
      body: payload.body || 'Tap to view live order & kitchen updates.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || payload.orderNumber || 'hfc-live-update',
      renotify: true,
      silent: false,
      requireInteraction: isAdminAlert,
      data: { url: payload.url || (isAdminAlert ? '/admin/orders' : '/orders') },
    })
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin)) {
          if (client.navigate) return client.navigate(targetUrl).then(() => client.focus());
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
`.trim();

    app.get('/dev-sw.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(
        `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then((ks)=>Promise.all(ks.map((k)=>caches.delete(k)))).then(()=>self.registration.unregister()).catch(()=>{}));});`
      );
    });

    app.get('/sw.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(devPushSwScript);
    });

    app.get('/manifest.webmanifest', (_req, res) => {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.json({
        id: '/',
        name: 'Home Food Corner',
        short_name: 'HFC Food',
        description:
          'Fresh street food, sizzling BBQ, creamy pasta, karak chai, and family dinners from Home Food Corner.',
        theme_color: '#0B0B0B',
        background_color: '#0B0B0B',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      });
    });

    // Serve a clean, zero-WebSocket /@vite/client ESM shim in dev mode so AI Studio
    // preview iframes behind Cloud Run never suffer HMR WebSocket errors, SharedWorker
    // Blob failures, or unexpected location.reload() loops while CSS & React still work 100%.
    const devViteClientShim = `
const sheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (typeof document === 'undefined') return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
  }
  sheetsMap.delete(id);
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (typeof url !== 'string' || (url[0] !== '.' && url[0] !== '/')) return url;
  const pathname = url.replace(/[?#].*$/, '');
  const u = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (u.search ? '&' + u.search.slice(1) : '') + (u.hash || '');
}
export class ErrorOverlay {
  constructor() {}
}
`.trim();

    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(devViteClientShim);
    });

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: false,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Home Food Corner full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
