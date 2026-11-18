import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Boxes,
  Check,
  Clock,
  Edit3,
  ExternalLink,
  FolderKanban,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  Printer,
  Receipt,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { BrandLogo, Button, Field, inputClassName, Surface } from '../components/ui';
import { useStore } from '../context/StoreContext';
import { PushNotificationToggle } from '../hooks/usePWA';
import { formatPKR } from '../lib/storeHours';
import type {
  AccentTone,
  AdminLog,
  Category,
  Order,
  OrderStatus,
  PolicyItem,
  Product,
  PromoOffer,
  Review,
  RewardOffer,
  RewardTransaction,
  SocialLink,
  SpicyLevel,
  StockHistoryEntry,
  TimingMode,
  UserProfile,
} from '../types';

export interface AdminOverviewData {
  stats: {
    totalOrders: number;
    todayOrders: number;
    pendingOrders: number;
    completedOrders: number;
    revenue: number;
    customerCount: number;
  };
  popularProducts: { productId: string; nameEn: string; qtySold: number; revenue: number }[];
  lowStockProducts: Product[];
  orders: Order[];
  categories: Category[];
  products: Product[];
  stockHistory: StockHistoryEntry[];
  offers: PromoOffer[];
  reviews: Review[];
  rewards: RewardOffer[];
  rewardTransactions: RewardTransaction[];
  policies: PolicyItem[];
  socialLinks: SocialLink[];
  adminLogs: AdminLog[];
}

export const AdminLoginPage: React.FC = () => {
  const { user, settings, setAuthSession, apiFetch } = useStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ email, password, twoFactorCode }),
      });
      setAuthSession(res.token, res.user);
      navigate('/admin');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Admin login failed';
      if (msg.includes('2FA')) setNeeds2FA(true);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Surface className="w-full max-w-md p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <BrandLogo size={42} customUrl={settings.logoUrl} />
          <div>
            <h1 className="text-xl font-bold text-foreground">Stall Owner Console</h1>
            <p className="text-xs text-muted">Role-protected Admin Authentication · {settings.brandName}</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Field label="Admin Email" htmlFor="adm-email">
            <input
              id="adm-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@yourdomain.com"
              className={inputClassName}
            />
          </Field>

          <Field label="Password" htmlFor="adm-pass" error={!needs2FA ? error : undefined}>
            <input
              id="adm-pass"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className={inputClassName}
            />
          </Field>

          {needs2FA ? (
            <Field label="6-Digit Security 2FA PIN" htmlFor="adm-2fa" error={error}>
              <input
                id="adm-2fa"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="••••••"
                className={`${inputClassName} font-mono`}
              />
            </Field>
          ) : null}

          <Button type="submit" tone="gold" disabled={busy} className="w-full">
            <ShieldCheck className="h-4 w-4" />
            <span>{busy ? 'Verifying…' : 'Enter Admin Panel'}</span>
          </Button>
        </form>

        <div className="flex items-center justify-between border-t border-border/50 pt-4 text-xs">
          <span className="text-muted">Private Owner Access Only</span>
          <Link to="/" className="text-muted hover:text-foreground">
            ← Back to Storefront
          </Link>
        </div>
      </Surface>
    </div>
  );
};

const adminNavItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/orders', label: 'Live Orders', icon: Receipt },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/categories', label: 'Categories', icon: FolderKanban },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/offers', label: 'Offers & Deals', icon: Tag },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
  { to: '/admin/rewards', label: 'Rewards', icon: Gift },
  { to: '/admin/policies', label: 'Policies', icon: ShieldCheck },
  { to: '/admin/social-links', label: 'Social Links', icon: Share2 },
  { to: '/admin/ai-settings', label: 'AI Assistant', icon: Sparkles },
  { to: '/admin/settings', label: 'Brand & Hours', icon: Settings },
];

export const AdminLayout: React.FC<{
  children: (ctx: { data: AdminOverviewData; reload: () => Promise<void> }) => React.ReactNode;
}> = ({ children }) => {
  const { user, token, logout, settings, storeStatus, unreadCount, liveAlert, dismissLiveAlert, apiFetch } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    try {
      const res = await apiFetch<AdminOverviewData>('/api/admin/overview');
      setData(res);
      setLoadError('');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load admin console');
    }
  }, [apiFetch]);

  useEffect(() => {
    if (user?.role === 'admin') {
      void reload();
    }
  }, [user, reload, unreadCount]);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Desktop Sidebar ONLY (no top bar alongside side nav per frontend-design Rule 6) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-150 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={34} customUrl={settings.logoUrl} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate" title={settings.brandName}>
                {settings.brandName}
              </p>
              <p className="text-[11px] text-gold">Admin Console · PKT</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="rounded p-1 text-muted md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Admin sections" className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between rounded-control px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted hover:bg-background hover:text-foreground'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.to === '/admin/notifications' && unreadCount > 0 ? (
                  <span className="text-xs font-bold tabular-nums text-gold">{unreadCount}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/60 p-3 space-y-2.5 text-xs">
          <div className="px-2 py-1 text-muted">
            <span className={storeStatus.isOpen ? 'text-primary font-semibold' : 'text-spicy font-semibold'}>
              ● {storeStatus.isOpen ? 'Store Open' : 'Store Closed'}
            </span>
            <span> · {storeStatus.karachiTimeLabel}</span>
          </div>
          <div className="px-1">
            <PushNotificationToggle token={token} compact />
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex flex-1 min-h-9 items-center justify-center gap-1.5 rounded-control border border-border bg-background px-2.5 font-medium text-foreground hover:border-gold"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Storefront</span>
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/admin/login');
              }}
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-control border border-border bg-background px-2.5 font-medium text-muted hover:text-spicy"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only sidebar trigger */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <Menu className="h-5 w-5" />
            <span>Admin Menu</span>
          </button>
          <span className="text-xs text-gold">{storeStatus.karachiTimeLabel} PKT</span>
        </div>

        {/* WhatsApp-Style Instant Order Notification Popup */}
        {liveAlert ? (
          <div className="fixed top-4 right-4 z-50 w-[calc(100%-2rem)] max-w-md">
            <Surface className="border-primary p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-semibold text-primary">
                    WhatsApp-Style Live Kitchen Alert · نیا آرڈر
                  </p>
                  <p className="text-sm font-bold text-foreground">
                    {liveAlert.orderNumber ? `Order ${liveAlert.orderNumber}` : liveAlert.title}
                    {liveAlert.customerName ? ` · ${liveAlert.customerName}` : ''}
                  </p>
                  <p className="text-xs text-foreground">
                    {liveAlert.itemsSummary || liveAlert.body}
                  </p>
                  <p className="text-xs font-mono text-gold">
                    {liveAlert.totalAmount !== undefined ? `Total: ${formatPKR(liveAlert.totalAmount)} · ` : ''}
                    Time: {new Date(liveAlert.createdAt).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi' })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissLiveAlert}
                  aria-label="Dismiss alert"
                  className="rounded p-1 text-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </Surface>
          </div>
        ) : null}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full">
          {loadError ? (
            <p role="alert" className="mb-4 text-sm text-spicy">{loadError}</p>
          ) : null}
          {!data ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Surface className="h-32 animate-pulse p-6" />
              <Surface className="h-32 animate-pulse p-6" />
              <Surface className="h-32 animate-pulse p-6" />
            </div>
          ) : (
            children({ data, reload })
          )}
        </main>
      </div>
    </div>
  );
};

// ==================== 1. ADMIN DASHBOARD ====================
export const AdminDashboardSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { settings, storeStatus, apiFetch, refreshBootstrap } = useStore();
  const [timingBusy, setTimingBusy] = useState(false);

  const quickSetTiming = async (mode: TimingMode) => {
    setTimingBusy(true);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ timingMode: mode }),
      });
      await refreshBootstrap();
      await reload();
    } finally {
      setTimingBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kitchen & Sales Dashboard</h1>
          <p className="text-sm text-muted">
            Live metrics scoped to {settings.timezone} ({storeStatus.karachiTimeLabel} PKT) · {storeStatus.statusLabelEn}
          </p>
        </div>

        {/* Instant Store Open/Close Controls */}
        <div className="flex flex-wrap gap-2">
          <Button
            tone={settings.timingMode === 'scheduled' ? 'primary' : 'quiet'}
            disabled={timingBusy}
            onClick={() => void quickSetTiming('scheduled')}
          >
            <Clock className="h-4 w-4" />
            <span>Scheduled Hours</span>
          </Button>
          <Button
            tone={settings.timingMode === 'one_hour_window' ? 'gold' : 'quiet'}
            disabled={timingBusy}
            onClick={() => void quickSetTiming('one_hour_window')}
          >
            Open 1 Hour Only
          </Button>
          <Button
            tone={settings.timingMode === 'force_open_24h' ? 'primary' : 'quiet'}
            disabled={timingBusy}
            onClick={() => void quickSetTiming('force_open_24h')}
          >
            Open 24/7
          </Button>
          <Button
            tone={settings.timingMode === 'force_closed' ? 'spicy' : 'quiet'}
            disabled={timingBusy}
            onClick={() => void quickSetTiming('force_closed')}
          >
            Close Store Now
          </Button>
        </div>
      </div>

      {/* Single-border KPI band with 1px rules (frontend-design Rule 4) */}
      <Surface className="grid grid-cols-2 divide-x divide-y divide-border/50 lg:grid-cols-6 lg:divide-y-0">
        <div className="p-5">
          <p className="text-xs text-muted">Net Revenue (PKR)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gold">{formatPKR(data.stats.revenue)}</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-muted">Total Orders</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{data.stats.totalOrders}</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-muted">Today’s Orders (PKT)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-primary">{data.stats.todayOrders}</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-muted">Pending / Active</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gold">{data.stats.pendingOrders}</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-muted">Completed Orders</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{data.stats.completedOrders}</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-muted">Registered Customers</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{data.stats.customerCount}</p>
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Popular Products */}
        <Surface className="p-6 lg:col-span-6">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <h2 className="text-base font-semibold text-foreground">Top Selling Dishes (Units Sold)</h2>
            <Link to="/admin/products" className="text-xs text-gold hover:underline">Manage menu →</Link>
          </div>
          <div className="divide-y divide-border/50 text-sm">
            {data.popularProducts.length === 0 ? (
              <p className="py-4 text-muted">No completed sales recorded yet.</p>
            ) : (
              data.popularProducts.map((item) => (
                <div key={item.productId} className="flex items-center justify-between py-3 tabular-nums">
                  <span className="font-medium text-foreground">{item.nameEn}</span>
                  <span className="text-muted">
                    {item.qtySold} sold · <strong className="text-foreground">{formatPKR(item.revenue)}</strong>
                  </span>
                </div>
              ))
            )}
          </div>
        </Surface>

        {/* Low Stock Alerts */}
        <Surface className="p-6 lg:col-span-6">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <h2 className="text-base font-semibold text-foreground">
              Low Stock & Out-of-Stock Alerts ({data.lowStockProducts.length})
            </h2>
            <Link to="/admin/inventory" className="text-xs text-gold hover:underline">Restock →</Link>
          </div>
          <div className="divide-y divide-border/50 text-sm">
            {data.lowStockProducts.length === 0 ? (
              <p className="py-4 text-primary">All kitchen items are well-stocked above threshold.</p>
            ) : (
              data.lowStockProducts.map((prod) => (
                <div key={prod.id} className="flex items-center justify-between py-3 tabular-nums">
                  <div>
                    <p className="font-medium text-foreground">{prod.nameEn}</p>
                    <p className="text-xs text-muted">Alert at ≤ {prod.lowStockThreshold} portions</p>
                  </div>
                  <span className={prod.stockQty === 0 ? 'font-bold text-spicy' : 'font-semibold text-gold'}>
                    {prod.stockQty === 0 ? '0 (Auto-disabled)' : `${prod.stockQty} left`}
                  </span>
                </div>
              ))
            )}
          </div>
        </Surface>
      </div>

      {/* Recent Orders & Recent Reviews */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Surface className="p-6 lg:col-span-7">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <h2 className="text-base font-semibold text-foreground">Recent Live Orders</h2>
            <Link to="/admin/orders" className="text-xs text-gold hover:underline">All orders →</Link>
          </div>
          <div className="divide-y divide-border/50 text-sm">
            {data.orders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <span className="font-mono font-semibold text-gold">{o.orderNumber}</span>
                  <span className="text-foreground"> · {o.customerName}</span>
                  <p className="text-xs text-muted">
                    {o.items.map((i) => `${i.quantity}× ${i.productNameEn}`).join(', ')}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold text-foreground">{formatPKR(o.totalAmount)}</p>
                  <p className="text-xs text-primary">{o.status}</p>
                </div>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="p-6 lg:col-span-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <h2 className="text-base font-semibold text-foreground">Recent Customer Reviews</h2>
            <Link to="/admin/reviews" className="text-xs text-gold hover:underline">Moderate →</Link>
          </div>
          <div className="divide-y divide-border/50 text-sm">
            {data.reviews.slice(0, 4).map((r) => (
              <div key={r.id} className="py-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-foreground">{r.customerName}</span>
                  <span className="text-gold">{'★'.repeat(r.rating)}</span>
                </div>
                <p className="text-xs text-muted line-clamp-2">{r.comment}</p>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
};

// ==================== 2. ADMIN ORDERS ====================
export const AdminOrdersSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { apiFetch, settings } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation');

  const statuses: OrderStatus[] = [
    'New',
    'Accepted',
    'Preparing',
    'Ready',
    'Out for delivery',
    'Completed',
    'Cancelled',
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.orders.filter((o) => {
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (q) {
        const hay = `${o.orderNumber} ${o.customerName} ${o.customerPhone} ${o.customerAddress}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.orders, search, statusFilter]);

  const updateStatus = async (orderId: string, status: OrderStatus, reason?: string) => {
    await apiFetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, cancelReason: reason }),
    });
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Live Orders Management</h1>
          <p className="text-sm text-muted">
            Instant status updates notify customers automatically via real-time push.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name, phone…"
            aria-label="Search orders"
            className={`${inputClassName} w-56`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter order status"
            className={`${inputClassName} w-44`}
          >
            <option value="ALL">All Statuses ({data.orders.length})</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Surface className="p-8 text-center text-sm text-muted">
            No orders match the current filter.
          </Surface>
        ) : (
          filtered.map((ord) => (
            <Surface key={ord.id} className="p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-bold text-gold">{ord.orderNumber}</span>
                    <span className="text-sm font-semibold text-foreground">· {ord.customerName}</span>
                    <span className="text-xs text-muted">({ord.customerPhone})</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {ord.fulfillmentType.toUpperCase()} · {ord.customerAddress} · Placed{' '}
                    {new Date(ord.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                  </p>
                  {ord.notes ? (
                    <p className="mt-1 text-xs text-gold">Note: {ord.notes}</p>
                  ) : null}
                  {ord.cancelReason ? (
                    <p className="mt-1 text-xs text-spicy">Cancelled Reason: {ord.cancelReason}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={ord.status}
                    onChange={(e) => {
                      const next = e.target.value as OrderStatus;
                      if (next === 'Cancelled') {
                        setCancellingOrder(ord);
                      } else {
                        void updateStatus(ord.id, next);
                      }
                    }}
                    aria-label={`Change status for ${ord.orderNumber}`}
                    className={`${inputClassName} w-44 font-semibold`}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <Button tone="quiet" onClick={() => setInvoiceOrder(ord)}>
                    <Printer className="h-4 w-4" />
                    <span>Invoice</span>
                  </Button>
                </div>
              </div>

              <div className="divide-y divide-border/40 text-sm">
                {ord.items.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 tabular-nums">
                    <span>
                      {item.quantity} × {item.productNameEn} ({formatPKR(item.unitPrice)})
                    </span>
                    <span className="font-medium">{formatPKR(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-sm tabular-nums">
                <span className="text-xs text-muted">
                  Payment: {ord.paymentMethod.toUpperCase()}
                  {ord.discountAmount > 0 ? ` · Reward Discount: -${formatPKR(ord.discountAmount)}` : ''}
                  {` · Delivery: ${formatPKR(ord.deliveryFee)}`}
                </span>
                <span className="text-base font-bold text-gold">
                  Total: {formatPKR(ord.totalAmount)}
                </span>
              </div>
            </Surface>
          ))
        )}
      </div>

      {/* Cancel Order Modal */}
      {cancellingOrder ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Surface className="w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Cancel Order {cancellingOrder.orderNumber}
            </h2>
            <Field label="Cancellation Reason (Sent to customer)">
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className={inputClassName}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button tone="quiet" onClick={() => setCancellingOrder(null)}>Keep Order</Button>
              <Button
                tone="spicy"
                onClick={async () => {
                  await updateStatus(cancellingOrder.id, 'Cancelled', cancelReason);
                  setCancellingOrder(null);
                }}
              >
                Confirm Cancellation
              </Button>
            </div>
          </Surface>
        </div>
      ) : null}

      {/* Printable Receipt / Invoice Modal */}
      {invoiceOrder ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Surface className="w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-border/50 pb-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">{settings.brandName}</h2>
                <p className="text-xs text-muted">{settings.addressEn}</p>
                <p className="text-xs font-mono text-gold mt-1">
                  Receipt #{invoiceOrder.orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceOrder(null)}
                aria-label="Close invoice"
                className="p-1 text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs space-y-1 text-muted">
              <p><strong className="text-foreground">Customer:</strong> {invoiceOrder.customerName} ({invoiceOrder.customerPhone})</p>
              <p><strong className="text-foreground">Address:</strong> {invoiceOrder.customerAddress}</p>
              <p><strong className="text-foreground">Date:</strong> {new Date(invoiceOrder.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</p>
            </div>

            <div className="divide-y divide-border/50 border-t border-b border-border/50 py-2 text-sm tabular-nums">
              {invoiceOrder.items.map((i) => (
                <div key={i.id} className="flex justify-between py-1.5">
                  <span>{i.quantity}× {i.productNameEn}</span>
                  <span>{formatPKR(i.lineTotal)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-sm tabular-nums">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatPKR(invoiceOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Delivery</span>
                <span>{formatPKR(invoiceOrder.deliveryFee)}</span>
              </div>
              {invoiceOrder.discountAmount > 0 ? (
                <div className="flex justify-between text-primary">
                  <span>Discount</span>
                  <span>-{formatPKR(invoiceOrder.discountAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border/50">
                <span>Grand Total</span>
                <span className="text-gold">{formatPKR(invoiceOrder.totalAmount)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button tone="quiet" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </Button>
              <Button tone="primary" onClick={() => setInvoiceOrder(null)}>Done</Button>
            </div>
          </Surface>
        </div>
      ) : null}
    </div>
  );
};

// ==================== 3. ADMIN PRODUCTS ====================
export const AdminProductsSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { apiFetch, refreshBootstrap } = useStore();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [availFilter, setAvailFilter] = useState<'ALL' | 'AVAILABLE' | 'OUT' | 'DEAL'>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.products.filter((p) => {
      if (catFilter !== 'ALL' && p.categoryId !== catFilter) return false;
      if (availFilter === 'AVAILABLE' && (!p.isAvailable || p.stockQty <= 0)) return false;
      if (availFilter === 'OUT' && p.isAvailable && p.stockQty > 0) return false;
      if (availFilter === 'DEAL' && !p.isDailyDeal) return false;
      if (q) {
        const hay = `${p.nameEn} ${p.nameUr} ${p.categorySlug} ${p.slug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.products, search, catFilter, availFilter]);

  const blankProduct = (): Partial<Product> => ({
    categoryId: data.categories[0]?.id || 'cat-food',
    nameEn: '',
    nameUr: '',
    descriptionEn: '',
    descriptionUr: '',
    price: 350,
    discountPrice: null,
    spicyLevel: 'medium',
    accentTone: 'golden',
    imageUrl: null,
    stockQty: 30,
    lowStockThreshold: 6,
    autoDisableOnZero: true,
    isAvailable: true,
    isFeatured: false,
    isDailyDeal: false,
    seoTitle: '',
    seoDescription: '',
  });

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setErr('Only PNG, JPEG, WebP, or SVG images are allowed.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErr('Image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditing((prev) => (prev ? { ...prev, imageUrl: reader.result as string } : prev));
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setErr('');
    setBusy(true);
    try {
      if (editing.id) {
        await apiFetch(`/api/admin/products/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(editing),
        });
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(editing),
        });
      }
      setEditing(null);
      await refreshBootstrap();
      await reload();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Failed to save product');
    } finally {
      setBusy(false);
    }
  };

  const toggleQuickAvailability = async (prod: Product) => {
    await apiFetch(`/api/admin/products/${prod.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isAvailable: !prod.isAvailable }),
    });
    await refreshBootstrap();
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu Products ({data.products.length})</h1>
          <p className="text-sm text-muted">
            Add, edit, or delete unlimited Food, Drinks, and Dinner items with Urdu/English copy.
          </p>
        </div>
        <Button tone="primary" onClick={() => setEditing(blankProduct())}>
          <Plus className="h-4 w-4" />
          <span>Add New Product</span>
        </Button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dish name (EN/UR)…"
            aria-label="Search menu products"
            className={`${inputClassName} w-60`}
          />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            aria-label="Filter by category"
            className={`${inputClassName} w-44`}
          >
            <option value="ALL">All Categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-control border border-border bg-surface p-1">
          {(
            [
              { key: 'ALL', label: `All (${data.products.length})` },
              { key: 'AVAILABLE', label: 'Available' },
              { key: 'OUT', label: 'Out of Stock' },
              { key: 'DEAL', label: 'Daily Deals' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setAvailFilter(tab.key)}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                availFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {editing ? (
        <Surface className="p-6">
          <form onSubmit={saveProduct} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="text-lg font-semibold">
                {editing.id ? `Edit ${editing.nameEn}` : 'Add New Menu Dish'}
              </h2>
              <button
                type="button"
                aria-label="Close product editor"
                onClick={() => setEditing(null)}
                className="text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Product Name (English)" htmlFor="prod-name-en">
                <input
                  id="prod-name-en"
                  type="text"
                  required
                  value={editing.nameEn || ''}
                  onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })}
                  className={inputClassName}
                />
              </Field>
              <Field label="Product Name (Urdu)" htmlFor="prod-name-ur">
                <input
                  id="prod-name-ur"
                  type="text"
                  value={editing.nameUr || ''}
                  onChange={(e) => setEditing({ ...editing, nameUr: e.target.value })}
                  placeholder="مثلاً چکن تکہ"
                  className={`${inputClassName} font-urdu`}
                />
              </Field>

              <Field label="Category" htmlFor="prod-category">
                <select
                  id="prod-category"
                  value={editing.categoryId || ''}
                  onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                  className={inputClassName}
                >
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nameEn} ({c.nameUr})</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (PKR)" htmlFor="prod-price">
                  <input
                    id="prod-price"
                    type="number"
                    min={0}
                    step={10}
                    required
                    value={editing.price ?? 0}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Discount Price (Optional)" htmlFor="prod-discount">
                  <input
                    id="prod-discount"
                    type="number"
                    min={0}
                    step={10}
                    value={editing.discountPrice ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        discountPrice: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="None"
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field label="Spicy Level" htmlFor="prod-spice">
                <select
                  id="prod-spice"
                  value={editing.spicyLevel || 'medium'}
                  onChange={(e) => setEditing({ ...editing, spicyLevel: e.target.value as SpicyLevel })}
                  className={inputClassName}
                >
                  <option value="none">Non-Spicy / Cool</option>
                  <option value="mild">Mild</option>
                  <option value="medium">Medium</option>
                  <option value="hot">Hot Spicy</option>
                  <option value="extra_hot">Extra Fiery</option>
                </select>
              </Field>

              <Field label="Visual Accent Tone" htmlFor="prod-tone">
                <select
                  id="prod-tone"
                  value={editing.accentTone || 'golden'}
                  onChange={(e) => setEditing({ ...editing, accentTone: e.target.value as AccentTone })}
                  className={inputClassName}
                >
                  <option value="golden">Golden Stall Classic (Tikka / Snacks)</option>
                  <option value="spicy_red">Fiery Chili Red (Chicken Drum / Spicy)</option>
                  <option value="cream">Warm Cream / White Tone (Pasta / Club)</option>
                  <option value="cool_fresh">Cool Fresh Green (Drinks / Shakes)</option>
                  <option value="ember">Coal Ember (Qeema / Dinner Platters)</option>
                </select>
              </Field>

              <Field label="Description (English)" htmlFor="prod-desc-en">
                <textarea
                  id="prod-desc-en"
                  rows={2}
                  value={editing.descriptionEn || ''}
                  onChange={(e) => setEditing({ ...editing, descriptionEn: e.target.value })}
                  className={inputClassName}
                />
              </Field>

              <Field label="Description (Urdu)" htmlFor="prod-desc-ur">
                <textarea
                  id="prod-desc-ur"
                  rows={2}
                  value={editing.descriptionUr || ''}
                  onChange={(e) => setEditing({ ...editing, descriptionUr: e.target.value })}
                  className={`${inputClassName} font-urdu`}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Stock Quantity" htmlFor="prod-stock">
                  <input
                    id="prod-stock"
                    type="number"
                    min={0}
                    value={editing.stockQty ?? 25}
                    onChange={(e) => setEditing({ ...editing, stockQty: Number(e.target.value) })}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Low Stock Alert Threshold" htmlFor="prod-threshold">
                  <input
                    id="prod-threshold"
                    type="number"
                    min={1}
                    value={editing.lowStockThreshold ?? 6}
                    onChange={(e) => setEditing({ ...editing, lowStockThreshold: Number(e.target.value) })}
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field label="Product Photo (PNG/JPG/WebP, max 2MB)" htmlFor="prod-photo">
                <div className="flex items-center gap-3">
                  {editing.imageUrl ? (
                    <img
                      src={editing.imageUrl}
                      alt={editing.nameEn || 'Preview'}
                      referrerPolicy="no-referrer"
                      className="h-11 w-14 shrink-0 rounded-control border border-border object-cover"
                    />
                  ) : null}
                  <input
                    id="prod-photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleImageFile(e.target.files?.[0])}
                    className={inputClassName}
                  />
                  {editing.imageUrl ? (
                    <Button
                      tone="quiet"
                      onClick={() => setEditing({ ...editing, imageUrl: null })}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </Field>

              <Field label="SEO Title" htmlFor="prod-seo-title">
                <input
                  id="prod-seo-title"
                  type="text"
                  value={editing.seoTitle || ''}
                  onChange={(e) => setEditing({ ...editing, seoTitle: e.target.value })}
                  className={inputClassName}
                />
              </Field>
              <Field label="SEO Meta Description" htmlFor="prod-seo-desc">
                <input
                  id="prod-seo-desc"
                  type="text"
                  value={editing.seoDescription || ''}
                  onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })}
                  className={inputClassName}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-5 pt-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.isAvailable !== false}
                  onChange={(e) => setEditing({ ...editing, isAvailable: e.target.checked })}
                />
                <span>Available for Order</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.autoDisableOnZero !== false}
                  onChange={(e) => setEditing({ ...editing, autoDisableOnZero: e.target.checked })}
                />
                <span>Auto-Disable when Stock is 0</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isFeatured)}
                  onChange={(e) => setEditing({ ...editing, isFeatured: e.target.checked })}
                />
                <span>Featured on Home</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isDailyDeal)}
                  onChange={(e) => setEditing({ ...editing, isDailyDeal: e.target.checked })}
                />
                <span>Daily Deal Highlight</span>
              </label>
            </div>

            {err ? <p role="alert" className="text-xs text-spicy">{err}</p> : null}

            <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
              <Button tone="quiet" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" tone="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save Product'}
              </Button>
            </div>
          </form>
        </Surface>
      ) : null}

      <Surface className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/60 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3.5">Dish</th>
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5">Price</th>
              <th className="px-4 py-3.5">Stock</th>
              <th className="px-4 py-3.5">Availability</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  No menu dishes match your search or filter.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-background/40">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.nameEn}
                          referrerPolicy="no-referrer"
                          className="h-9 w-11 shrink-0 rounded object-cover border border-border/50"
                        />
                      ) : null}
                      <div>
                        <p className="font-semibold text-foreground">
                          {p.nameEn}
                          {p.isDailyDeal ? <span className="ml-1.5 text-xs text-gold">· Deal</span> : null}
                          {p.isFeatured ? <span className="ml-1.5 text-xs text-primary">· Featured</span> : null}
                        </p>
                        <p className="font-urdu text-xs text-muted">{p.nameUr}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-muted capitalize">{p.categorySlug}</td>
                  <td className="px-4 py-3.5 tabular-nums">
                    {p.discountPrice !== null ? (
                      <>
                        <span className="font-semibold text-gold">{formatPKR(p.discountPrice)}</span>
                        <span className="ml-1.5 text-xs text-muted line-through">{formatPKR(p.price)}</span>
                      </>
                    ) : (
                      <span>{formatPKR(p.price)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums">
                    <span className={p.stockQty <= p.lowStockThreshold ? 'font-semibold text-spicy' : ''}>
                      {p.stockQty}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs">
                    <button
                      type="button"
                      onClick={() => void toggleQuickAvailability(p)}
                      className={`font-medium hover:underline whitespace-nowrap ${
                        p.isAvailable && p.stockQty > 0 ? 'text-primary' : 'text-spicy'
                      }`}
                    >
                      {p.isAvailable && p.stockQty > 0 ? 'Available (Disable)' : 'Unavailable (Enable)'}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(null);
                        setEditing(p);
                      }}
                      className="mr-3 inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    {confirmDeleteId === p.id ? (
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/products/${p.id}`, { method: 'DELETE' });
                            setConfirmDeleteId(null);
                            await refreshBootstrap();
                            await reload();
                          }}
                          className="text-xs font-semibold text-spicy hover:underline"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-muted hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-spicy hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Surface>
    </div>
  );
};

// ==================== 4. ADMIN CATEGORIES ====================
export const AdminCategoriesSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { apiFetch, refreshBootstrap } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameEn, setNameEn] = useState('');
  const [nameUr, setNameUr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionUr, setDescriptionUr] = useState('');
  const [sortOrder, setSortOrder] = useState(data.categories.length + 1);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setNameEn('');
    setNameUr('');
    setDescriptionEn('');
    setDescriptionUr('');
    setSortOrder(data.categories.length + 1);
    setImageUrl('');
    setErr('');
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setNameEn(cat.nameEn);
    setNameUr(cat.nameUr);
    setDescriptionEn(cat.descriptionEn);
    setDescriptionUr(cat.descriptionUr);
    setSortOrder(cat.sortOrder);
    setImageUrl(cat.imageUrl || '');
    setErr('');
  };

  const handleCatImage = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setErr('Only PNG, JPEG, WebP, or SVG images are allowed.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErr('Image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim()) return;
    setErr('');
    try {
      const payload = {
        nameEn,
        nameUr,
        descriptionEn,
        descriptionUr,
        sortOrder,
        imageUrl: imageUrl || null,
        isActive: true,
      };
      if (editingId) {
        await apiFetch(`/api/admin/categories/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await refreshBootstrap();
      await reload();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Failed to save category');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Menu Categories ({data.categories.length})</h1>
        <p className="text-sm text-muted">
          Create, edit, reorder, hide, or remove Food, Drinks, Dinner, and seasonal categories.
        </p>
      </div>

      <Surface className="p-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
          <h2 className="text-base font-semibold text-foreground">
            {editingId ? `Editing Category: ${nameEn}` : 'Add New Category'}
          </h2>
          {editingId ? (
            <button type="button" onClick={resetForm} className="text-xs text-muted hover:text-foreground">
              Cancel Edit
            </button>
          ) : null}
        </div>

        <form onSubmit={saveCategory} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Category Name (EN)" htmlFor="cat-name-en">
              <input
                id="cat-name-en"
                type="text"
                required
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Late Night Rolls"
                className={inputClassName}
              />
            </Field>
            <Field label="Category Name (Urdu)" htmlFor="cat-name-ur">
              <input
                id="cat-name-ur"
                type="text"
                value={nameUr}
                onChange={(e) => setNameUr(e.target.value)}
                placeholder="رات کے خاص رولز"
                className={`${inputClassName} font-urdu`}
              />
            </Field>
            <Field label="Display Order" htmlFor="cat-order">
              <input
                id="cat-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className={inputClassName}
              />
            </Field>
            <Field label="Description (EN)" htmlFor="cat-desc-en">
              <input
                id="cat-desc-en"
                type="text"
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                placeholder="Short category subtitle"
                className={inputClassName}
              />
            </Field>
            <Field label="Description (Urdu)" htmlFor="cat-desc-ur">
              <input
                id="cat-desc-ur"
                type="text"
                value={descriptionUr}
                onChange={(e) => setDescriptionUr(e.target.value)}
                placeholder="مختصر اردو تفصیل"
                className={`${inputClassName} font-urdu`}
              />
            </Field>
            <Field label="Category Cover Image (Optional)" htmlFor="cat-img">
              <div className="flex items-center gap-2">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={nameEn || 'Category'}
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 shrink-0 rounded-control border border-border object-cover"
                  />
                ) : null}
                <input
                  id="cat-img"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleCatImage(e.target.files?.[0])}
                  className={inputClassName}
                />
              </div>
            </Field>
          </div>
          {err ? <p role="alert" className="text-xs text-spicy">{err}</p> : null}
          <div className="flex items-center gap-3">
            <Button type="submit" tone="primary">
              {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{editingId ? 'Save Category Changes' : 'Add Category'}</span>
            </Button>
            {editingId ? (
              <Button tone="quiet" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </Surface>

      <Surface className="divide-y divide-border/50 px-6">
        {data.categories.map((cat) => {
          const itemCount = data.products.filter((p) => p.categoryId === cat.id).length;
          return (
            <div key={cat.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3 min-w-0">
                {cat.imageUrl ? (
                  <img
                    src={cat.imageUrl}
                    alt={cat.nameEn}
                    referrerPolicy="no-referrer"
                    className="h-11 w-14 shrink-0 rounded-control border border-border/50 object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    #{cat.sortOrder} · {cat.nameEn}{' '}
                    <span className="font-urdu text-gold">({cat.nameUr})</span>
                    <span className="ml-2 text-xs font-normal tabular-nums text-muted">
                      · {itemCount} dishes
                    </span>
                  </p>
                  <p className="text-xs text-muted truncate">
                    /category/{cat.slug}
                    {cat.descriptionEn ? ` · ${cat.descriptionEn}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button tone="quiet" onClick={() => startEdit(cat)}>
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Button>
                <Button
                  tone="quiet"
                  onClick={async () => {
                    await apiFetch(`/api/admin/categories/${cat.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ isActive: !cat.isActive }),
                    });
                    await refreshBootstrap();
                    await reload();
                  }}
                >
                  {cat.isActive ? 'Active (Hide)' : 'Hidden (Activate)'}
                </Button>
                {confirmDeleteId === cat.id ? (
                  <span className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
                        setConfirmDeleteId(null);
                        await refreshBootstrap();
                        await reload();
                      }}
                      className="text-xs font-semibold text-spicy hover:underline"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(cat.id)}
                    className="text-xs font-medium text-spicy hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </Surface>
    </div>
  );
};

// ==================== 5. ADMIN INVENTORY ====================
export const AdminInventorySection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { apiFetch, refreshBootstrap } = useStore();
  const [draftQty, setDraftQty] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  const lowCount = data.products.filter((p) => p.stockQty > 0 && p.stockQty <= p.lowStockThreshold).length;
  const outCount = data.products.filter((p) => p.stockQty === 0 || !p.isAvailable).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.products.filter((p) => {
      if (stockFilter === 'LOW' && !(p.stockQty > 0 && p.stockQty <= p.lowStockThreshold)) return false;
      if (stockFilter === 'OUT' && p.stockQty > 0 && p.isAvailable) return false;
      if (q) {
        const hay = `${p.nameEn} ${p.nameUr} ${p.categorySlug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.products, search, stockFilter]);

  const adjustStock = async (
    prod: Product,
    nextQty: number,
    reason: string,
    extra?: { isAvailable?: boolean; autoDisableOnZero?: boolean }
  ) => {
    await apiFetch(`/api/admin/inventory/${prod.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stockQty: nextQty, reason, ...extra }),
    });
    setDraftQty((prev) => {
      const next = { ...prev };
      delete next[prod.id];
      return next;
    });
    await refreshBootstrap();
    await reload();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kitchen Inventory & Stock Log</h1>
          <p className="text-sm text-muted">
            Items reaching 0 portions automatically switch to Out of Stock when Auto-Disable is enabled.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dish…"
            aria-label="Search inventory items"
            className={`${inputClassName} w-52`}
          />
          <div className="flex items-center gap-1 rounded-control border border-border bg-surface p-1">
            {(
              [
                { key: 'ALL', label: `All (${data.products.length})` },
                { key: 'LOW', label: `Low (${lowCount})` },
                { key: 'OUT', label: `Out / Off (${outCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStockFilter(tab.key)}
                className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  stockFilter === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Surface className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/60 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3.5">Dish</th>
              <th className="px-4 py-3.5">Stock</th>
              <th className="px-4 py-3.5">Threshold</th>
              <th className="px-4 py-3.5">Storefront Status</th>
              <th className="px-4 py-3.5">Quick Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  No inventory items match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const val = draftQty[p.id] ?? p.stockQty;
                const isOut = p.stockQty === 0 || !p.isAvailable;
                const isLow = p.stockQty > 0 && p.stockQty <= p.lowStockThreshold;
                return (
                  <tr key={p.id} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.nameEn}</p>
                      <p className="text-xs text-muted capitalize">{p.categorySlug}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">
                      <span className={isOut ? 'text-spicy' : isLow ? 'text-gold' : 'text-foreground'}>
                        {p.stockQty}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted">≤ {p.lowStockThreshold}</td>
                    <td className="px-4 py-3 text-xs space-y-1">
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            void adjustStock(p, p.stockQty, 'Manual availability toggle', {
                              isAvailable: !p.isAvailable,
                            })
                          }
                          className={`font-semibold hover:underline ${
                            p.isAvailable && p.stockQty > 0 ? 'text-primary' : 'text-spicy'
                          }`}
                        >
                          {p.isAvailable && p.stockQty > 0 ? 'In Stock · Active' : 'Out of Stock · Hidden'}
                        </button>
                      </div>
                      <label className="flex items-center gap-1.5 text-muted">
                        <input
                          type="checkbox"
                          checked={p.autoDisableOnZero}
                          onChange={(e) =>
                            void adjustStock(p, p.stockQty, 'Auto-disable setting updated', {
                              autoDisableOnZero: e.target.checked,
                            })
                          }
                        />
                        <span>Auto-off at 0</span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={val}
                          onChange={(e) =>
                            setDraftQty((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))
                          }
                          aria-label={`Stock quantity for ${p.nameEn}`}
                          className={`${inputClassName} w-24 tabular-nums`}
                        />
                        <Button
                          tone="primary"
                          onClick={() => void adjustStock(p, val, 'Kitchen batch restock')}
                        >
                          <Check className="h-4 w-4" />
                          <span>Save</span>
                        </Button>
                        <Button
                          tone="quiet"
                          onClick={() => void adjustStock(p, p.stockQty + 20, '+20 fresh batch')}
                        >
                          +20 Batch
                        </Button>
                        <Button
                          tone="quiet"
                          onClick={() => void adjustStock(p, 0, 'Marked sold out')}
                        >
                          Set 0
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Surface>

      <Surface className="p-6">
        <h2 className="text-base font-semibold text-foreground pb-3 border-b border-border/50">
          Stock Update History
        </h2>
        <div className="divide-y divide-border/50 text-sm">
          {data.stockHistory.length === 0 ? (
            <p className="py-4 text-muted">No stock adjustments logged yet.</p>
          ) : (
            data.stockHistory.slice(0, 20).map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <span className="font-medium text-foreground">{h.productName}</span>
                  <span className="text-xs text-muted"> · {h.reason}</span>
                </div>
                <span className="font-mono text-xs text-gold tabular-nums">
                  {h.previousQty} → {h.newQty} ({new Date(h.createdAt).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi' })})
                </span>
              </div>
            ))
          )}
        </div>
      </Surface>
    </div>
  );
};
