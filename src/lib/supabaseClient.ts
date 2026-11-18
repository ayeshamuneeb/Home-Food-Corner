import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { AppNotification, Order, OrderStatus } from '../types';

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';

export function isValidSupabaseConfig(url?: string, anonKey?: string): boolean {
  if (!url || !anonKey) return false;
  const trimmedUrl = url.trim();
  const trimmedKey = anonKey.trim();
  if (!trimmedUrl || !trimmedKey) return false;
  if (
    trimmedUrl.includes('your-project.supabase.co') ||
    trimmedKey.includes('your-supabase-anon-key')
  ) {
    return false;
  }
  return /^https?:\/\/.+/.test(trimmedUrl);
}

export function getSupabaseBrowserClient(url: string, anonKey: string): SupabaseClient | null {
  if (!isValidSupabaseConfig(url, anonKey)) return null;
  const cacheSig = `${url}::${anonKey}`;
  if (cachedClient && cachedKey === cacheSig) {
    return cachedClient;
  }
  cachedKey = cacheSig;
  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  return cachedClient;
}

interface RealtimeSubscriptionOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userId: string | null;
  role: 'admin' | 'customer' | 'guest';
  onNotification: (notification: AppNotification) => void;
  onOrderEvent: (orderPatch: Partial<Order> & { id: string; orderNumber?: string }) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'error') => void;
}

function mapSupabaseNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id || `notif-sb-${Date.now()}`),
    recipientRole:
      row.recipient_role === 'admin' || row.recipient_role === 'customer'
        ? row.recipient_role
        : 'broadcast',
    recipientUserId: row.recipient_user_id ? String(row.recipient_user_id) : null,
    orderId: row.order_id ? String(row.order_id) : null,
    orderNumber: row.order_number ? String(row.order_number) : undefined,
    customerName: row.customer_name ? String(row.customer_name) : undefined,
    itemsSummary: row.items_summary ? String(row.items_summary) : undefined,
    totalAmount: typeof row.total_amount === 'number' ? row.total_amount : undefined,
    title: String(row.title || 'Home Food Corner Update'),
    body: String(row.body || ''),
    isRead: Boolean(row.is_read),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

/**
 * Subscribes strictly to `orders` and `notifications` tables via Supabase Realtime.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToRealtimeOrdersAndNotifications(
  opts: RealtimeSubscriptionOptions
): () => void {
  const client = getSupabaseBrowserClient(opts.supabaseUrl, opts.supabaseAnonKey);
  if (!client) return () => {};

  opts.onStatusChange?.('connecting');

  const channel: RealtimeChannel = client
    .channel(`hfc-realtime-${opts.role}-${opts.userId || 'guest'}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      },
      (payload) => {
        const row = (payload.new || {}) as Record<string, unknown>;
        const mapped = mapSupabaseNotification(row);

        // Enforce client-side scope matching RLS / recipient rules
        if (mapped.recipientRole === 'admin' && opts.role !== 'admin') return;
        if (
          mapped.recipientRole === 'customer' &&
          mapped.recipientUserId &&
          mapped.recipientUserId !== opts.userId
        ) {
          return;
        }
        opts.onNotification(mapped);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        const row = (payload.new || {}) as Record<string, unknown>;
        if (!row.id) return;
        const rowUserId = row.user_id ? String(row.user_id) : null;
        if (opts.role !== 'admin' && rowUserId && rowUserId !== opts.userId) {
          return;
        }
        opts.onOrderEvent({
          id: String(row.id),
          orderNumber: row.order_number ? String(row.order_number) : undefined,
          status: row.status ? (String(row.status) as OrderStatus) : undefined,
          updatedAt: row.updated_at ? String(row.updated_at) : undefined,
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        opts.onStatusChange?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        opts.onStatusChange?.('error');
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
