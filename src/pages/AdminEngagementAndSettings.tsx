import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Check, Edit3, Plus, Send, Trash2, Volume2, X } from 'lucide-react';
import { BrandAssetStudio } from '../components/BrandAssetStudio';
import { Button, Field, inputClassName, Surface } from '../components/ui';
import { useStore } from '../context/StoreContext';
import { playOrderNotificationSound, PushNotificationToggle } from '../hooks/usePWA';
import { formatPKR } from '../lib/storeHours';
import type {
  OpeningHour,
  PolicyItem,
  Product,
  PromoOffer,
  RewardOffer,
  SocialLink,
  StoreSettings,
  UserProfile,
} from '../types';
import type { AdminOverviewData } from './AdminShellAndCore';

function toDateInputValue(iso: string | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}

// ==================== 6. ADMIN NOTIFICATIONS ====================
interface PushStatusPayload {
  vapidConfigured: boolean;
  supabaseEnabled: boolean;
  supabaseAdminActive: boolean;
  totalSubscribers: number;
  adminSubscribers?: number;
  customerSubscribers?: number;
  guestSubscribers?: number;
}

export const AdminNotificationsSection: React.FC<{
  reload: () => Promise<void>;
}> = ({ reload }) => {
  const {
    token,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    apiFetch,
    refreshNotifications,
    supabaseStatus,
    realtimeConfig,
  } = useStore();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sentMsg, setSentMsg] = useState('');
  const [pushSummary, setPushSummary] = useState<PushStatusPayload | null>(null);
  const [testResult, setTestResult] = useState('');
  const [testingPush, setTestingPush] = useState(false);

  const loadPushStatus = async () => {
    try {
      const status = await apiFetch<PushStatusPayload>('/api/push/status');
      setPushSummary(status);
    } catch {
      // Ignore temporary fetch issue
    }
  };

  useEffect(() => {
    void loadPushStatus();
  }, []);

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSentMsg('');
    const res = await apiFetch<{
      pushStats?: { delivered: number; failed: number; pruned: number };
    }>('/api/admin/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });
    setTitle('');
    setBody('');
    const delivered = res.pushStats?.delivered ?? 0;
    setSentMsg(
      delivered > 0
        ? `Broadcast created server-side & sent via Web Push to ${delivered} subscribed device(s)!`
        : 'Broadcast created server-side and pushed live to all open customer sessions!'
    );
    await refreshNotifications();
    await loadPushStatus();
    await reload();
  };

  const triggerTestPush = async () => {
    setTestingPush(true);
    setTestResult('');
    try {
      const res = await apiFetch<{
        pushStats: { delivered: number; failed: number; pruned: number };
      }>('/api/admin/notifications/test-push', { method: 'POST' });
      playOrderNotificationSound();
      if (res.pushStats.delivered > 0) {
        setTestResult(`Web Push delivered to ${res.pushStats.delivered} admin device(s).`);
      } else {
        setTestResult(
          'Alert sent via live channel. Enable "Web Push Alerts" on this device to receive OS background notifications.'
        );
      }
      await refreshNotifications();
      await loadPushStatus();
    } catch (err: unknown) {
      setTestResult(err instanceof Error ? err.message : 'Test push failed');
    } finally {
      setTestingPush(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Live Notifications & Web Push Alerts
          </h1>
          <p className="text-sm text-muted">
            Server-generated order alerts via WebSocket{realtimeConfig.supabaseEnabled ? ' + Supabase Realtime' : ''} and VAPID Web Push.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button tone="quiet" onClick={() => playOrderNotificationSound()}>
            <Volume2 className="h-4 w-4 text-gold" />
            <span>Test Chime</span>
          </Button>
          <Button tone="quiet" disabled={testingPush} onClick={() => void triggerTestPush()}>
            <BellRing className="h-4 w-4 text-primary" />
            <span>{testingPush ? 'Sending…' : 'Send Test Push'}</span>
          </Button>
          <PushNotificationToggle token={token} onStatusChange={() => void loadPushStatus()} />
        </div>
      </div>

      {testResult ? (
        <Surface className="border-primary/40 p-4 text-sm text-foreground">{testResult}</Surface>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Surface className="p-4">
          <p className="text-xs text-muted">Admin Push Devices</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gold">
            {pushSummary?.adminSubscribers ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-muted">Receive new order & low-stock alerts</p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs text-muted">Customer & Guest Push Devices</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
            {(pushSummary?.customerSubscribers ?? 0) + (pushSummary?.guestSubscribers ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted">Receive live order status & deal broadcasts</p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs text-muted">Realtime Channel Mode</p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {realtimeConfig.supabaseEnabled
              ? `Supabase Realtime (${supabaseStatus}) + WS`
              : 'Local WebSocket + VAPID Push'}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            VAPID Keys: {pushSummary?.vapidConfigured ? 'Configured Server-Side' : 'Pending'}
          </p>
        </Surface>
      </div>

      <Surface className="p-6">
        <h2 className="text-base font-semibold text-foreground">
          Send Broadcast Notification to All Customers · تمام صارفین کو اطلاع بھیجیں
        </h2>
        <form onSubmit={sendBroadcast} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Headline" htmlFor="broadcast-title">
              <input
                id="broadcast-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fresh Coal BBQ Batch Ready!"
                className={inputClassName}
              />
            </Field>
            <Field label="Message (Urdu / English)" htmlFor="broadcast-body">
              <input
                id="broadcast-body"
                type="text"
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="آج رات فیملی کومبو پر فری ڈیلیوری جاری ہے!"
                className={inputClassName}
              />
            </Field>
          </div>
          {sentMsg ? <p className="text-xs font-medium text-primary">{sentMsg}</p> : null}
          <Button type="submit" tone="gold">
            <Send className="h-4 w-4" />
            <span>Broadcast Now</span>
          </Button>
        </form>
      </Surface>

      <Surface className="p-6">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <h2 className="text-base font-semibold text-foreground">Notification Feed</h2>
          <button
            type="button"
            onClick={() => void markAllNotificationsRead()}
            className="text-xs font-medium text-gold hover:underline"
          >
            Mark all as read
          </button>
        </div>

        <div className="divide-y divide-border/50">
          {notifications.length === 0 ? (
            <p className="py-6 text-sm text-muted">No notifications logged yet.</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="space-y-1">
                  <p className={`text-sm font-semibold ${n.isRead ? 'text-muted' : 'text-foreground'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted">{n.body}</p>
                  <p className="text-[11px] font-mono text-gold">
                    {new Date(n.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                  </p>
                </div>
                {!n.isRead ? (
                  <Button tone="quiet" onClick={() => void markNotificationRead(n.id)}>
                    Mark Read
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Surface>
    </div>
  );
};

// ==================== 7. ADMIN OFFERS & DEALS ====================
export const AdminOffersSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { apiFetch, refreshBootstrap } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleEn, setTitleEn] = useState('');
  const [titleUr, setTitleUr] = useState('');
  const [subtitleEn, setSubtitleEn] = useState('');
  const [subtitleUr, setSubtitleUr] = useState('');
  const [discountPercent, setDiscountPercent] = useState(15);
  const [code, setCode] = useState('HFCSPECIAL');
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState('2027-12-31');
  const [imageUrl, setImageUrl] = useState('');
  const [err, setErr] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Daily Deals inline discount controls
  const [dealSearch, setDealSearch] = useState('');
  const [dealDrafts, setDealDrafts] = useState<Record<string, { discountPrice: string; isDailyDeal: boolean }>>({});

  const resetOfferForm = () => {
    setEditingId(null);
    setTitleEn('');
    setTitleUr('');
    setSubtitleEn('');
    setSubtitleUr('');
    setDiscountPercent(15);
    setCode('HFCSPECIAL');
    setStartsAt(new Date().toISOString().slice(0, 10));
    setEndsAt('2027-12-31');
    setImageUrl('');
    setErr('');
  };

  const startEditOffer = (o: PromoOffer) => {
    setEditingId(o.id);
    setTitleEn(o.titleEn);
    setTitleUr(o.titleUr);
    setSubtitleEn(o.subtitleEn);
    setSubtitleUr(o.subtitleUr || '');
    setDiscountPercent(o.discountPercent);
    setCode(o.code);
    setStartsAt(toDateInputValue(o.startsAt, new Date().toISOString().slice(0, 10)));
    setEndsAt(toDateInputValue(o.endsAt, '2027-12-31'));
    setImageUrl(o.imageUrl || '');
    setErr('');
  };

  const handleOfferImage = (file: File | undefined) => {
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

  const saveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const payload = {
        titleEn,
        titleUr,
        subtitleEn,
        subtitleUr,
        discountPercent,
        code,
        startsAt: startsAt ? `${startsAt}T00:00:00Z` : new Date().toISOString(),
        endsAt: endsAt ? `${endsAt}T23:59:59Z` : '2027-12-31T23:59:59Z',
        imageUrl: imageUrl || null,
        isActive: true,
      };
      if (editingId) {
        await apiFetch(`/api/admin/offers/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/offers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetOfferForm();
      await refreshBootstrap();
      await reload();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Failed to save offer');
    }
  };

  const filteredDealProducts = useMemo(() => {
    const q = dealSearch.trim().toLowerCase();
    const list = data.products.filter((p) =>
      q ? `${p.nameEn} ${p.nameUr} ${p.categorySlug}`.toLowerCase().includes(q) : true
    );
    return [...list].sort((a, b) => Number(b.isDailyDeal) - Number(a.isDailyDeal));
  }, [data.products, dealSearch]);

  const saveProductDeal = async (prod: Product) => {
    const draft = dealDrafts[prod.id];
    const nextDaily = draft ? draft.isDailyDeal : prod.isDailyDeal;
    const rawDiscount = draft ? draft.discountPrice.trim() : prod.discountPrice !== null ? String(prod.discountPrice) : '';
    const nextDiscount = rawDiscount === '' ? null : Math.max(0, Math.round(Number(rawDiscount) || 0));

    await apiFetch(`/api/admin/products/${prod.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isDailyDeal: nextDaily, discountPrice: nextDiscount }),
    });
    setDealDrafts((prev) => {
      const copy = { ...prev };
      delete copy[prod.id];
      return copy;
    });
    await refreshBootstrap();
    await reload();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Offers, Promo Banners & Daily Deals</h1>
        <p className="text-sm text-muted">
          Create or edit promotional campaign banners and manage Daily Deal discounts on menu items.
        </p>
      </div>

      <Surface className="p-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
          <h2 className="text-base font-semibold text-foreground">
            {editingId ? `Editing Offer: ${titleEn}` : 'Create Promotional Banner'}
          </h2>
          {editingId ? (
            <button type="button" onClick={resetOfferForm} className="text-xs text-muted hover:text-foreground">
              Cancel Edit
            </button>
          ) : null}
        </div>

        <form onSubmit={saveOffer} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Banner Headline (English)" htmlFor="offer-title-en">
              <input
                id="offer-title-en"
                type="text"
                required
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="Weekend BBQ Feast — 15% Off"
                className={inputClassName}
              />
            </Field>
            <Field label="Banner Headline (Urdu)" htmlFor="offer-title-ur">
              <input
                id="offer-title-ur"
                type="text"
                value={titleUr}
                onChange={(e) => setTitleUr(e.target.value)}
                placeholder="ویک اینڈ باربی کیو آفر — 15 فیصد رعایت"
                className={`${inputClassName} font-urdu`}
              />
            </Field>
            <Field label="Subtitle (English)" htmlFor="offer-sub-en">
              <input
                id="offer-sub-en"
                type="text"
                value={subtitleEn}
                onChange={(e) => setSubtitleEn(e.target.value)}
                placeholder="Valid tonight 7 PM – 12 AM"
                className={inputClassName}
              />
            </Field>
            <Field label="Subtitle (Urdu)" htmlFor="offer-sub-ur">
              <input
                id="offer-sub-ur"
                type="text"
                value={subtitleUr}
                onChange={(e) => setSubtitleUr(e.target.value)}
                placeholder="آج رات 7 سے 12 بجے تک دستیاب"
                className={`${inputClassName} font-urdu`}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount %" htmlFor="offer-pct">
                <input
                  id="offer-pct"
                  type="number"
                  min={1}
                  max={90}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className={inputClassName}
                />
              </Field>
              <Field label="Promo Code" htmlFor="offer-code">
                <input
                  id="offer-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${inputClassName} font-mono`}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts On" htmlFor="offer-start">
                <input
                  id="offer-start"
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Ends On" htmlFor="offer-end">
                <input
                  id="offer-end"
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className={inputClassName}
                />
              </Field>
            </div>
            <Field label="Banner Image (Optional)" htmlFor="offer-img">
              <div className="flex items-center gap-2">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={titleEn || 'Banner'}
                    referrerPolicy="no-referrer"
                    className="h-11 w-16 shrink-0 rounded-control border border-border object-cover"
                  />
                ) : null}
                <input
                  id="offer-img"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleOfferImage(e.target.files?.[0])}
                  className={inputClassName}
                />
              </div>
            </Field>
          </div>
          {err ? <p role="alert" className="text-xs text-spicy">{err}</p> : null}
          <div className="flex items-center gap-3">
            <Button type="submit" tone="primary">
              {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{editingId ? 'Save Offer Changes' : 'Create Offer Banner'}</span>
            </Button>
            {editingId ? (
              <Button tone="quiet" onClick={resetOfferForm}>Cancel</Button>
            ) : null}
          </div>
        </form>
      </Surface>

      <Surface className="divide-y divide-border/50 px-6">
        {data.offers.length === 0 ? (
          <p className="py-6 text-sm text-muted">No promotional banners created yet.</p>
        ) : (
          data.offers.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3 min-w-0">
                {o.imageUrl ? (
                  <img
                    src={o.imageUrl}
                    alt={o.titleEn}
                    referrerPolicy="no-referrer"
                    className="h-12 w-16 shrink-0 rounded-control border border-border/50 object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {o.titleEn}{' '}
                    <span className="text-gold">({o.discountPercent}% · {o.code})</span>
                  </p>
                  <p className="font-urdu text-sm text-muted">{o.titleUr}</p>
                  <p className="text-xs text-muted">
                    {toDateInputValue(o.startsAt, '—')} → {toDateInputValue(o.endsAt, '—')}
                    {o.subtitleEn ? ` · ${o.subtitleEn}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button tone="quiet" onClick={() => startEditOffer(o)}>
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Button>
                <Button
                  tone="quiet"
                  onClick={async () => {
                    await apiFetch(`/api/admin/offers/${o.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ isActive: !o.isActive }),
                    });
                    await refreshBootstrap();
                    await reload();
                  }}
                >
                  {o.isActive ? 'Active (Hide)' : 'Inactive (Show)'}
                </Button>
                {confirmDeleteId === o.id ? (
                  <span className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/offers/${o.id}`, { method: 'DELETE' });
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
                    onClick={() => setConfirmDeleteId(o.id)}
                    className="text-xs text-spicy hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </Surface>

      {/* Daily Deals Manager */}
      <Surface className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Daily Deals & Discount Price Manager
            </h2>
            <p className="text-xs text-muted">
              Toggle which dishes appear in the Home Page Daily Deals strip and set discounted PKR prices.
            </p>
          </div>
          <input
            type="search"
            value={dealSearch}
            onChange={(e) => setDealSearch(e.target.value)}
            placeholder="Filter dishes…"
            aria-label="Filter dishes for daily deals"
            className={`${inputClassName} w-52`}
          />
        </div>

        <div className="divide-y divide-border/40 text-sm">
          {filteredDealProducts.slice(0, 16).map((p) => {
            const draft = dealDrafts[p.id];
            const isDaily = draft ? draft.isDailyDeal : p.isDailyDeal;
            const discountVal = draft
              ? draft.discountPrice
              : p.discountPrice !== null
                ? String(p.discountPrice)
                : '';
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {p.nameEn}{' '}
                    <span className="text-xs text-muted tabular-nums">
                      (Regular: {formatPKR(p.price)})
                    </span>
                  </p>
                  <p className="text-xs text-muted capitalize">{p.categorySlug}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={isDaily}
                      onChange={(e) =>
                        setDealDrafts((prev) => ({
                          ...prev,
                          [p.id]: {
                            isDailyDeal: e.target.checked,
                            discountPrice: discountVal,
                          },
                        }))
                      }
                    />
                    <span className={isDaily ? 'text-gold' : 'text-muted'}>Daily Deal</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={discountVal}
                    onChange={(e) =>
                      setDealDrafts((prev) => ({
                        ...prev,
                        [p.id]: {
                          isDailyDeal: isDaily,
                          discountPrice: e.target.value,
                        },
                      }))
                    }
                    placeholder="Deal PKR"
                    aria-label={`Discount price for ${p.nameEn}`}
                    className={`${inputClassName} w-28 tabular-nums`}
                  />
                  <Button tone="primary" onClick={() => void saveProductDeal(p)}>
                    Save Deal
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Surface>
    </div>
  );
};

// ==================== 8. ADMIN REVIEWS ====================
export const AdminReviewsSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { apiFetch, refreshBootstrap } = useStore();
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const [filterMode, setFilterMode] = useState<'ALL' | 'VISIBLE' | 'HIDDEN'>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const avg =
    data.reviews.length > 0
      ? (data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length).toFixed(2)
      : '5.00';

  const visibleList = useMemo(() => {
    if (filterMode === 'VISIBLE') return data.reviews.filter((r) => r.isVisible);
    if (filterMode === 'HIDDEN') return data.reviews.filter((r) => !r.isVisible);
    return data.reviews;
  }, [data.reviews, filterMode]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Reviews Moderation</h1>
          <p className="text-sm text-muted">
            Storewide Average: <strong className="text-gold">★ {avg}</strong> across {data.reviews.length} total reviews.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-control border border-border bg-surface p-1">
          {(
            [
              { key: 'ALL', label: `All (${data.reviews.length})` },
              { key: 'VISIBLE', label: 'Visible' },
              { key: 'HIDDEN', label: 'Hidden' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterMode(tab.key)}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                filterMode === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visibleList.length === 0 ? (
          <Surface className="p-8 text-center text-sm text-muted">
            No customer reviews in this view.
          </Surface>
        ) : (
          visibleList.map((r) => (
            <Surface key={r.id} className="p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-foreground">{r.customerName}</span>
                  {r.productNameEn ? <span className="text-xs text-primary"> · {r.productNameEn}</span> : null}
                  <span className="ml-2 text-gold">{'★'.repeat(r.rating)}</span>
                  {!r.isVisible ? <span className="ml-2 text-xs text-spicy">(Hidden from public)</span> : null}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    tone="quiet"
                    onClick={async () => {
                      await apiFetch(`/api/admin/reviews/${r.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ isVisible: !r.isVisible }),
                      });
                      await refreshBootstrap();
                      await reload();
                    }}
                  >
                    {r.isVisible ? 'Hide Review' : 'Approve / Show'}
                  </Button>
                  {confirmDeleteId === r.id ? (
                    <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/reviews/${r.id}`, { method: 'DELETE' });
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
                      onClick={() => setConfirmDeleteId(r.id)}
                      className="text-xs text-spicy hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-foreground">{r.comment}</p>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                <input
                  type="text"
                  value={replyMap[r.id] ?? r.adminReply ?? ''}
                  onChange={(e) => setReplyMap((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Write official stall reply…"
                  aria-label="Reply to review"
                  className={`${inputClassName} flex-1`}
                />
                <Button
                  tone="primary"
                  onClick={async () => {
                    await apiFetch(`/api/admin/reviews/${r.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ adminReply: replyMap[r.id] ?? r.adminReply ?? '' }),
                    });
                    await refreshBootstrap();
                    await reload();
                  }}
                >
                  Save Reply
                </Button>
              </div>
            </Surface>
          ))
        )}
      </div>
    </div>
  );
};

// ==================== 9. ADMIN REWARDS ====================
export const AdminRewardsSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { settings, apiFetch, refreshBootstrap } = useStore();
  const [ptsRule, setPtsRule] = useState(settings.pointsPer100Pkr);
  const [ruleSaved, setRuleSaved] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleEn, setTitleEn] = useState('');
  const [titleUr, setTitleUr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionUr, setDescriptionUr] = useState('');
  const [pointsRequired, setPointsRequired] = useState(150);
  const [discountValue, setDiscountValue] = useState(150);
  const [rewardType, setRewardType] = useState<'free_item' | 'flat_discount'>('flat_discount');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setPtsRule(settings.pointsPer100Pkr);
  }, [settings.pointsPer100Pkr]);

  const resetRewardForm = () => {
    setEditingId(null);
    setTitleEn('');
    setTitleUr('');
    setDescriptionEn('');
    setDescriptionUr('');
    setPointsRequired(150);
    setDiscountValue(150);
    setRewardType('flat_discount');
  };

  const startEditReward = (rew: RewardOffer) => {
    setEditingId(rew.id);
    setTitleEn(rew.titleEn);
    setTitleUr(rew.titleUr);
    setDescriptionEn(rew.descriptionEn);
    setDescriptionUr(rew.descriptionUr);
    setPointsRequired(rew.pointsRequired);
    setDiscountValue(rew.discountValue);
    setRewardType(rew.rewardType);
  };

  const saveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      titleEn,
      titleUr,
      descriptionEn: descriptionEn || `Redeem ${pointsRequired} points for Rs. ${discountValue} off`,
      descriptionUr: descriptionUr || `${pointsRequired} پوائنٹس پر ${discountValue} روپے رعایت`,
      pointsRequired,
      discountValue,
      rewardType,
    };
    if (editingId) {
      await apiFetch(`/api/admin/rewards/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/admin/rewards', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    resetRewardForm();
    await refreshBootstrap();
    await reload();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Loyalty Points & Rewards</h1>
        <p className="text-sm text-muted">Configure points earning rate and customer redemption tiers.</p>
      </div>

      <Surface className="p-6 flex flex-wrap items-end gap-4">
        <Field label="Points Earned per Rs. 100 Spent" htmlFor="pts-rule">
          <input
            id="pts-rule"
            type="number"
            min={0}
            max={100}
            value={ptsRule}
            onChange={(e) => {
              setRuleSaved(false);
              setPtsRule(Number(e.target.value));
            }}
            className={`${inputClassName} w-40 tabular-nums`}
          />
        </Field>
        <Button
          tone="primary"
          onClick={async () => {
            await apiFetch('/api/admin/settings', {
              method: 'PUT',
              body: JSON.stringify({ pointsPer100Pkr: ptsRule }),
            });
            await refreshBootstrap();
            await reload();
            setRuleSaved(true);
          }}
        >
          Save Points Rule
        </Button>
        {ruleSaved ? <span className="text-xs font-medium text-primary">Points rule updated!</span> : null}
      </Surface>

      <Surface className="p-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
          <h2 className="text-base font-semibold">
            {editingId ? `Editing Reward Tier: ${titleEn}` : 'Add Reward Tier'}
          </h2>
          {editingId ? (
            <button type="button" onClick={resetRewardForm} className="text-xs text-muted hover:text-foreground">
              Cancel Edit
            </button>
          ) : null}
        </div>
        <form onSubmit={saveReward} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Reward Title (EN)" htmlFor="rew-title-en">
              <input
                id="rew-title-en"
                type="text"
                required
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="Free Samosa Plate"
                className={inputClassName}
              />
            </Field>
            <Field label="Reward Title (UR)" htmlFor="rew-title-ur">
              <input
                id="rew-title-ur"
                type="text"
                value={titleUr}
                onChange={(e) => setTitleUr(e.target.value)}
                placeholder="مفت سموسہ پلیٹ"
                className={`${inputClassName} font-urdu`}
              />
            </Field>
            <Field label="Reward Type" htmlFor="rew-type">
              <select
                id="rew-type"
                value={rewardType}
                onChange={(e) => setRewardType(e.target.value as RewardOffer['rewardType'])}
                className={inputClassName}
              >
                <option value="free_item">Free Item / Treat</option>
                <option value="flat_discount">Flat PKR Discount</option>
              </select>
            </Field>
            <Field label="Description (EN)" htmlFor="rew-desc-en">
              <input
                id="rew-desc-en"
                type="text"
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                placeholder="Optional short English description"
                className={inputClassName}
              />
            </Field>
            <Field label="Description (UR)" htmlFor="rew-desc-ur">
              <input
                id="rew-desc-ur"
                type="text"
                value={descriptionUr}
                onChange={(e) => setDescriptionUr(e.target.value)}
                placeholder="مختصر اردو تفصیل"
                className={`${inputClassName} font-urdu`}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Points Required" htmlFor="rew-pts">
                <input
                  id="rew-pts"
                  type="number"
                  min={10}
                  value={pointsRequired}
                  onChange={(e) => setPointsRequired(Number(e.target.value))}
                  className={`${inputClassName} tabular-nums`}
                />
              </Field>
              <Field label="PKR Value" htmlFor="rew-val">
                <input
                  id="rew-val"
                  type="number"
                  min={10}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className={`${inputClassName} tabular-nums`}
                />
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" tone="primary">
              {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{editingId ? 'Save Reward Changes' : 'Add Reward Tier'}</span>
            </Button>
            {editingId ? (
              <Button tone="quiet" onClick={resetRewardForm}>Cancel</Button>
            ) : null}
          </div>
        </form>
      </Surface>

      <Surface className="divide-y divide-border/50 px-6">
        {data.rewards.map((rew) => (
          <div key={rew.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-semibold text-foreground">
                {rew.titleEn} · <span className="text-gold tabular-nums">{rew.pointsRequired} pts = {formatPKR(rew.discountValue)} off</span>
              </p>
              <p className="font-urdu text-xs text-muted">{rew.titleUr}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button tone="quiet" onClick={() => startEditReward(rew)}>
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </Button>
              <Button
                tone="quiet"
                onClick={async () => {
                  await apiFetch(`/api/admin/rewards/${rew.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ isActive: !rew.isActive }),
                  });
                  await refreshBootstrap();
                  await reload();
                }}
              >
                {rew.isActive ? 'Active (Pause)' : 'Paused (Enable)'}
              </Button>
              {confirmDeleteId === rew.id ? (
                <span className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/rewards/${rew.id}`, { method: 'DELETE' });
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
                  onClick={() => setConfirmDeleteId(rew.id)}
                  className="text-xs text-spicy hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </Surface>

      <Surface className="p-6">
        <h2 className="text-base font-semibold pb-3 border-b border-border/50">
          Recent Customer Points Ledger
        </h2>
        <div className="divide-y divide-border/50 text-sm">
          {data.rewardTransactions.length === 0 ? (
            <p className="py-4 text-muted">No loyalty transactions recorded yet.</p>
          ) : (
            data.rewardTransactions.slice(0, 12).map((tx) => (
              <div key={tx.id} className="flex justify-between py-2.5">
                <span>{tx.description}</span>
                <span className={tx.pointsDelta >= 0 ? 'text-primary tabular-nums font-semibold' : 'text-spicy tabular-nums font-semibold'}>
                  {tx.pointsDelta >= 0 ? `+${tx.pointsDelta}` : tx.pointsDelta} pts
                </span>
              </div>
            ))
          )}
        </div>
      </Surface>
    </div>
  );
};

// ==================== 10. ADMIN POLICIES ====================
export const AdminPoliciesSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { apiFetch, refreshBootstrap } = useStore();
  const [drafts, setDrafts] = useState<Record<string, PolicyItem>>(() =>
    Object.fromEntries(data.policies.map((p) => [p.slug, p]))
  );
  const [savedSlug, setSavedSlug] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newTitleUr, setNewTitleUr] = useState('');
  const [newContentEn, setNewContentEn] = useState('');
  const [newContentUr, setNewContentUr] = useState('');
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(data.policies.map((p) => [p.slug, p])));
  }, [data.policies]);

  const savePolicy = async (slug: string) => {
    const item = drafts[slug];
    if (!item) return;
    await apiFetch(`/api/admin/policies/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
    setSavedSlug(slug);
    await refreshBootstrap();
    await reload();
  };

  const createPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitleEn.trim()) return;
    await apiFetch('/api/admin/policies', {
      method: 'POST',
      body: JSON.stringify({
        titleEn: newTitleEn,
        titleUr: newTitleUr,
        contentEn: newContentEn,
        contentUr: newContentUr,
      }),
    });
    setNewTitleEn('');
    setNewTitleUr('');
    setNewContentEn('');
    setNewContentUr('');
    setAddingNew(false);
    await refreshBootstrap();
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Store Policies Editor</h1>
          <p className="text-sm text-muted">
            Edit Order, Delivery, Late Delivery, Refund, Privacy, Terms & Conditions, or add custom policies.
          </p>
        </div>
        <Button tone="primary" onClick={() => setAddingNew((v) => !v)}>
          {addingNew ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{addingNew ? 'Close' : 'Add Custom Policy'}</span>
        </Button>
      </div>

      {addingNew ? (
        <Surface className="p-6">
          <h2 className="text-base font-semibold mb-4">Create New Store Policy</h2>
          <form onSubmit={createPolicy} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Policy Title (English)" htmlFor="pol-new-title-en">
                <input
                  id="pol-new-title-en"
                  type="text"
                  required
                  value={newTitleEn}
                  onChange={(e) => setNewTitleEn(e.target.value)}
                  placeholder="e.g. Halal & Hygiene Guarantee"
                  className={inputClassName}
                />
              </Field>
              <Field label="Policy Title (Urdu)" htmlFor="pol-new-title-ur">
                <input
                  id="pol-new-title-ur"
                  type="text"
                  value={newTitleUr}
                  onChange={(e) => setNewTitleUr(e.target.value)}
                  placeholder="حلال اور صفائی کی ضمانت"
                  className={`${inputClassName} font-urdu`}
                />
              </Field>
              <Field label="English Policy Content" htmlFor="pol-new-body-en">
                <textarea
                  id="pol-new-body-en"
                  rows={3}
                  value={newContentEn}
                  onChange={(e) => setNewContentEn(e.target.value)}
                  className={inputClassName}
                />
              </Field>
              <Field label="Urdu Policy Content" htmlFor="pol-new-body-ur">
                <textarea
                  id="pol-new-body-ur"
                  rows={3}
                  value={newContentUr}
                  onChange={(e) => setNewContentUr(e.target.value)}
                  className={`${inputClassName} font-urdu`}
                />
              </Field>
            </div>
            <Button type="submit" tone="primary">Save New Policy</Button>
          </form>
        </Surface>
      ) : null}

      {data.policies.map((p) => {
        const cur = drafts[p.slug] || p;
        return (
          <Surface key={p.slug} className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {cur.titleEn} · <span className="font-urdu text-gold">{cur.titleUr}</span>
              </h2>
              <div className="flex items-center gap-3">
                {savedSlug === p.slug ? <span className="text-xs font-medium text-primary">Saved!</span> : null}
                {confirmDeleteSlug === p.slug ? (
                  <span className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/policies/${p.slug}`, { method: 'DELETE' });
                        setConfirmDeleteSlug(null);
                        await refreshBootstrap();
                        await reload();
                      }}
                      className="text-xs font-semibold text-spicy hover:underline"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSlug(null)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteSlug(p.slug)}
                    className="text-xs text-spicy hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Title (English)" htmlFor={`pol-ten-${p.slug}`}>
                <input
                  id={`pol-ten-${p.slug}`}
                  type="text"
                  value={cur.titleEn}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [p.slug]: { ...cur, titleEn: e.target.value },
                    }))
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Title (Urdu)" htmlFor={`pol-tur-${p.slug}`}>
                <input
                  id={`pol-tur-${p.slug}`}
                  type="text"
                  value={cur.titleUr}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [p.slug]: { ...cur, titleUr: e.target.value },
                    }))
                  }
                  className={`${inputClassName} font-urdu`}
                />
              </Field>
              <Field label="English Policy Text" htmlFor={`pol-cen-${p.slug}`}>
                <textarea
                  id={`pol-cen-${p.slug}`}
                  rows={3}
                  value={cur.contentEn}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [p.slug]: { ...cur, contentEn: e.target.value },
                    }))
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Urdu Policy Text" htmlFor={`pol-cur-${p.slug}`}>
                <textarea
                  id={`pol-cur-${p.slug}`}
                  rows={3}
                  value={cur.contentUr}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [p.slug]: { ...cur, contentUr: e.target.value },
                    }))
                  }
                  className={`${inputClassName} font-urdu`}
                />
              </Field>
            </div>
            <Button tone="primary" onClick={() => void savePolicy(p.slug)}>
              <Check className="h-4 w-4" />
              <span>Save {cur.titleEn}</span>
            </Button>
          </Surface>
        );
      })}
    </div>
  );
};

// ==================== 11. ADMIN SOCIAL LINKS ====================
export const AdminSocialLinksSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { apiFetch, refreshBootstrap } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<SocialLink['platform']>('instagram');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [sortOrder, setSortOrder] = useState(data.socialLinks.length + 1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resetSocialForm = () => {
    setEditingId(null);
    setPlatform('instagram');
    setLabel('');
    setUrl('');
    setSortOrder(data.socialLinks.length + 1);
  };

  const startEditSocial = (s: SocialLink) => {
    setEditingId(s.id);
    setPlatform(s.platform);
    setLabel(s.label);
    setUrl(s.url);
    setSortOrder(s.sortOrder);
  };

  const saveSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { platform, label, url, sortOrder, isActive: true };
    if (editingId) {
      await apiFetch(`/api/admin/social-links/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/admin/social-links', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    resetSocialForm();
    await refreshBootstrap();
    await reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Social Media & Direct Channels</h1>
        <p className="text-sm text-muted">
          Manage Instagram, Facebook, YouTube, LinkedIn, WhatsApp, TikTok, Twitter/X, and custom links.
        </p>
      </div>

      <Surface className="p-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
          <h2 className="text-base font-semibold">
            {editingId ? `Editing Link: ${label}` : 'Add Social Media Link'}
          </h2>
          {editingId ? (
            <button type="button" onClick={resetSocialForm} className="text-xs text-muted hover:text-foreground">
              Cancel Edit
            </button>
          ) : null}
        </div>
        <form onSubmit={saveSocial} className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:items-end">
          <Field label="Platform" htmlFor="soc-platform">
            <select
              id="soc-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialLink['platform'])}
              className={inputClassName}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="twitter">Twitter / X</option>
              <option value="linkedin">LinkedIn</option>
              <option value="custom">Custom Website</option>
            </select>
          </Field>
          <Field label="Display Label" htmlFor="soc-label">
            <input
              id="soc-label"
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="@homefoodcorner"
              className={inputClassName}
            />
          </Field>
          <Field label="Direct URL" htmlFor="soc-url">
            <input
              id="soc-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://instagram.com/..."
              className={inputClassName}
            />
          </Field>
          <Field label="Order" htmlFor="soc-order">
            <input
              id="soc-order"
              type="number"
              min={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className={`${inputClassName} tabular-nums`}
            />
          </Field>
          <Button type="submit" tone="primary">
            {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{editingId ? 'Save Link' : 'Add Link'}</span>
          </Button>
        </form>
      </Surface>

      <Surface className="divide-y divide-border/50 px-6">
        {data.socialLinks.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="font-semibold text-foreground capitalize">
                #{s.sortOrder} · {s.platform}: {s.label}
              </p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gold hover:underline break-all"
              >
                {s.url}
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button tone="quiet" onClick={() => startEditSocial(s)}>
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </Button>
              <Button
                tone="quiet"
                onClick={async () => {
                  await apiFetch(`/api/admin/social-links/${s.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ isActive: !s.isActive }),
                  });
                  await refreshBootstrap();
                  await reload();
                }}
              >
                {s.isActive ? 'Visible (Hide)' : 'Hidden (Show)'}
              </Button>
              {confirmDeleteId === s.id ? (
                <span className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/social-links/${s.id}`, { method: 'DELETE' });
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
                  onClick={() => setConfirmDeleteId(s.id)}
                  className="inline-flex items-center gap-1 text-xs text-spicy hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </Surface>
    </div>
  );
};

// ==================== 12. ADMIN AI SETTINGS ====================
export const AdminAISettingsSection: React.FC = () => {
  const { settings, apiFetch, refreshBootstrap } = useStore();
  const [draft, setDraft] = useState<StoreSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const saveAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    await apiFetch('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        aiEnabled: draft.aiEnabled,
        aiPersonality: draft.aiPersonality,
        aiInstructions: draft.aiInstructions,
        aiKnowledgeNote: draft.aiKnowledgeNote,
        aiLanguage: draft.aiLanguage,
      }),
    });
    await refreshBootstrap();
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Menu Assistant Configuration</h1>
        <p className="text-sm text-muted">
          Control assistant availability, Urdu/English response mode, and live store knowledge notes.
        </p>
      </div>

      <Surface className="p-6">
        <form onSubmit={saveAI} className="space-y-4">
          <label className="flex items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.aiEnabled}
              onChange={(e) => setDraft({ ...draft, aiEnabled: e.target.checked })}
            />
            <span>Enable Floating AI Menu Assistant on Storefront</span>
          </label>

          <Field label="Response Language Mode" htmlFor="ai-lang">
            <select
              id="ai-lang"
              value={draft.aiLanguage}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  aiLanguage: e.target.value as StoreSettings['aiLanguage'],
                })
              }
              className={inputClassName}
            >
              <option value="bilingual">Bilingual Auto-Match (Urdu + English)</option>
              <option value="urdu">Primary Urdu</option>
              <option value="english">Primary English</option>
            </select>
          </Field>

          <Field label="Assistant Personality" htmlFor="ai-pers">
            <input
              id="ai-pers"
              type="text"
              value={draft.aiPersonality}
              onChange={(e) => setDraft({ ...draft, aiPersonality: e.target.value })}
              className={inputClassName}
            />
          </Field>

          <Field label="Strict Guardrail Instructions" htmlFor="ai-inst">
            <textarea
              id="ai-inst"
              rows={3}
              value={draft.aiInstructions}
              onChange={(e) => setDraft({ ...draft, aiInstructions: e.target.value })}
              className={inputClassName}
            />
          </Field>

          <Field label="Extra Kitchen Knowledge Base Notes" htmlFor="ai-notes">
            <textarea
              id="ai-notes"
              rows={3}
              value={draft.aiKnowledgeNote}
              onChange={(e) => setDraft({ ...draft, aiKnowledgeNote: e.target.value })}
              placeholder="e.g. Halal meat info, special catering phone, Ramadan timings…"
              className={inputClassName}
            />
          </Field>

          {saved ? <p className="text-xs font-medium text-primary">AI settings updated live!</p> : null}

          <Button type="submit" tone="primary">Save AI Assistant Settings</Button>
        </form>
      </Surface>
    </div>
  );
};

// ==================== 13. ADMIN BRAND, STORE TIMING & SECURITY SETTINGS ====================
export const AdminSettingsSection: React.FC<{
  data: AdminOverviewData;
  reload: () => Promise<void>;
}> = ({ data, reload }) => {
  const { settings, openingHours, user, setAuthSession, updateUserProfileState, apiFetch, refreshBootstrap } = useStore();
  const [form, setForm] = useState<StoreSettings>(settings);
  const [hours, setHours] = useState<OpeningHour[]>(openingHours);
  const [twoFA, setTwoFA] = useState(Boolean(user?.twoFactorEnabled));
  const [savedMsg, setSavedMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  // Private Owner Lock fields
  const [secEmail, setSecEmail] = useState(user?.email || '');
  const [secCurrentPass, setSecCurrentPass] = useState('');
  const [secNewPass, setSecNewPass] = useState('');
  const [secPin, setSecPin] = useState('');
  const [secBusy, setSecBusy] = useState(false);
  const [secMsg, setSecMsg] = useState('');
  const [secErr, setSecErr] = useState('');

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    setHours(openingHours);
  }, [openingHours]);

  useEffect(() => {
    setTwoFA(Boolean(user?.twoFactorEnabled));
  }, [user?.twoFactorEnabled]);

  const handleBrandImageUpload = (field: 'logoUrl' | 'faviconUrl', file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrMsg('Image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, [field]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const applyHoursPreset = (openTime: string, closeTime: string) => {
    setHours((prev) => prev.map((h) => ({ ...h, openTime, closeTime, isClosed: false })));
  };

  const saveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('');
    setErrMsg('');
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      await apiFetch('/api/admin/opening-hours', {
        method: 'PUT',
        body: JSON.stringify({ openingHours: hours }),
      });
      if (user) {
        const pRes = await apiFetch<{ user: UserProfile }>('/api/profile', {
          method: 'PUT',
          body: JSON.stringify({ fullName: user.fullName, phone: user.phone, twoFactorEnabled: twoFA }),
        });
        updateUserProfileState(pRes.user);
      }
      await refreshBootstrap();
      await reload();
      setSavedMsg('Brand settings, theme colors & Asia/Karachi hours saved!');
    } catch (err: unknown) {
      setErrMsg(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Brand, Theme Colors, Timing &amp; Security</h1>
        <p className="text-sm text-muted">
          Configure stall identity, official transparent logo assets, brand colors, Asia/Karachi operating hours, and security audit trail.
        </p>
      </div>

      <BrandAssetStudio
        brandName={form.brandName}
        primaryGreen={form.primaryGreen}
        primaryYellow={form.primaryYellow}
        accentRed={form.accentRed}
        apiFetch={apiFetch}
        onApplied={async () => {
          await refreshBootstrap();
          await reload();
        }}
      />

      <form onSubmit={saveAll} className="space-y-6">
        <Surface className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">1. Brand, Logo, Colors & Contact</h2>
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  primaryGreen: '#16A34A',
                  primaryYellow: '#FACC15',
                  accentRed: '#DC2626',
                }))
              }
              className="text-xs text-gold hover:underline"
            >
              Reset Default Brand Colors
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Stall Name" htmlFor="set-brand">
              <input
                id="set-brand"
                type="text"
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                className={inputClassName}
              />
            </Field>
            <Field label="Upload Custom Logo (PNG/SVG)" htmlFor="set-logo">
              <div className="flex items-center gap-2">
                {form.logoUrl && form.logoUrl !== '/icon.svg' ? (
                  <img
                    src={form.logoUrl}
                    alt="Current logo"
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 shrink-0 rounded border border-border object-cover"
                  />
                ) : null}
                <input
                  id="set-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => handleBrandImageUpload('logoUrl', e.target.files?.[0])}
                  className={inputClassName}
                />
                {form.logoUrl && form.logoUrl !== '/icon.svg' ? (
                  <Button tone="quiet" onClick={() => setForm({ ...form, logoUrl: '/icon.svg' })}>
                    Reset
                  </Button>
                ) : null}
              </div>
            </Field>
            <Field label="Upload Custom Favicon (Optional)" htmlFor="set-favicon">
              <div className="flex items-center gap-2">
                <input
                  id="set-favicon"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => handleBrandImageUpload('faviconUrl', e.target.files?.[0])}
                  className={inputClassName}
                />
              </div>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Primary Green" htmlFor="set-green">
                <input
                  id="set-green"
                  type="color"
                  value={form.primaryGreen}
                  onChange={(e) => setForm({ ...form, primaryGreen: e.target.value })}
                  className="h-11 w-full cursor-pointer rounded-control border border-border bg-background p-1"
                />
              </Field>
              <Field label="Primary Yellow" htmlFor="set-yellow">
                <input
                  id="set-yellow"
                  type="color"
                  value={form.primaryYellow}
                  onChange={(e) => setForm({ ...form, primaryYellow: e.target.value })}
                  className="h-11 w-full cursor-pointer rounded-control border border-border bg-background p-1"
                />
              </Field>
              <Field label="Spicy Red" htmlFor="set-red">
                <input
                  id="set-red"
                  type="color"
                  value={form.accentRed}
                  onChange={(e) => setForm({ ...form, accentRed: e.target.value })}
                  className="h-11 w-full cursor-pointer rounded-control border border-border bg-background p-1"
                />
              </Field>
            </div>
            <Field label="Tagline (English)" htmlFor="set-tag-en">
              <input
                id="set-tag-en"
                type="text"
                value={form.taglineEn}
                onChange={(e) => setForm({ ...form, taglineEn: e.target.value })}
                className={inputClassName}
              />
            </Field>
            <Field label="Tagline (Urdu)" htmlFor="set-tag-ur">
              <input
                id="set-tag-ur"
                type="text"
                value={form.taglineUr}
                onChange={(e) => setForm({ ...form, taglineUr: e.target.value })}
                className={`${inputClassName} font-urdu`}
              />
            </Field>
            <Field label="Contact Phone" htmlFor="set-phone">
              <input
                id="set-phone"
                type="text"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                className={inputClassName}
              />
            </Field>
            <Field label="WhatsApp Order Number (Digits only, e.g. 92300...)" htmlFor="set-wa">
              <input
                id="set-wa"
                type="text"
                value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                className={`${inputClassName} font-mono`}
              />
            </Field>
            <Field label="Address (English)" htmlFor="set-addr-en">
              <input
                id="set-addr-en"
                type="text"
                value={form.addressEn}
                onChange={(e) => setForm({ ...form, addressEn: e.target.value })}
                className={inputClassName}
              />
            </Field>
            <Field label="Address (Urdu)" htmlFor="set-addr-ur">
              <input
                id="set-addr-ur"
                type="text"
                value={form.addressUr}
                onChange={(e) => setForm({ ...form, addressUr: e.target.value })}
                className={`${inputClassName} font-urdu`}
              />
            </Field>
            <Field label="Google Maps Link" htmlFor="set-maps">
              <input
                id="set-maps"
                type="url"
                value={form.mapsUrl}
                onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
                className={inputClassName}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Delivery Fee (PKR)" htmlFor="set-fee">
                <input
                  id="set-fee"
                  type="number"
                  min={0}
                  value={form.deliveryFee}
                  onChange={(e) => setForm({ ...form, deliveryFee: Number(e.target.value) })}
                  className={`${inputClassName} tabular-nums`}
                />
              </Field>
              <Field label="Free Delivery Threshold" htmlFor="set-thresh">
                <input
                  id="set-thresh"
                  type="number"
                  min={0}
                  value={form.freeDeliveryThreshold}
                  onChange={(e) => setForm({ ...form, freeDeliveryThreshold: Number(e.target.value) })}
                  className={`${inputClassName} tabular-nums`}
                />
              </Field>
            </div>
          </div>
        </Surface>

        <Surface className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                2. Store Timing System (Timezone: Asia/Karachi)
              </h2>
              <p className="text-xs text-muted">
                When closed, customers cannot submit orders and see the Urdu opening time banner.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button tone="quiet" onClick={() => applyHoursPreset('19:00', '00:00')}>
                Preset: 7 PM – 12 AM
              </Button>
              <Button tone="quiet" onClick={() => applyHoursPreset('12:00', '03:00')}>
                Preset: 12 PM – 3 AM
              </Button>
            </div>
          </div>

          <Field label="Operating Mode" htmlFor="set-mode">
            <select
              id="set-mode"
              value={form.timingMode}
              onChange={(e) =>
                setForm({ ...form, timingMode: e.target.value as StoreSettings['timingMode'] })
              }
              className={inputClassName}
            >
              <option value="scheduled">Follow Weekly Schedule Below</option>
              <option value="one_hour_window">Open Special 1-Hour Flash Window Now</option>
              <option value="force_open_24h">Open 24 Hours (24/7 Orders)</option>
              <option value="force_closed">Temporarily Closed (Block New Orders)</option>
            </select>
          </Field>

          <div className="divide-y divide-border/50 pt-2">
            {hours.map((h, idx) => (
              <div key={h.dayOfWeek} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span className="w-36 font-medium">
                  {h.dayNameEn} · <span className="font-urdu text-muted">{h.dayNameUr}</span>
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="time"
                    value={h.openTime}
                    disabled={h.isClosed}
                    aria-label={`${h.dayNameEn} opening time`}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, openTime: e.target.value } : item))
                      )
                    }
                    className={`${inputClassName} w-36`}
                  />
                  <span className="text-muted">to</span>
                  <input
                    type="time"
                    value={h.closeTime}
                    disabled={h.isClosed}
                    aria-label={`${h.dayNameEn} closing time`}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, closeTime: e.target.value } : item))
                      )
                    }
                    className={`${inputClassName} w-36`}
                  />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={h.isClosed}
                      onChange={(e) =>
                        setHours((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, isClosed: e.target.checked } : item))
                        )
                      }
                    />
                    <span>Closed</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border/50 pt-4">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={twoFA}
                onChange={(e) => setTwoFA(e.target.checked)}
              />
              <span>Require 6-Digit 2FA Security PIN on Admin Login</span>
            </label>
          </div>

          {errMsg ? <p role="alert" className="text-sm font-medium text-spicy">{errMsg}</p> : null}
          {savedMsg ? <p className="text-sm font-medium text-primary">{savedMsg}</p> : null}

          <Button type="submit" tone="primary">Save Brand &amp; Store Hours</Button>
        </Surface>
      </form>

      {/* Owner Security Lock: Change Email, Password & Secret 2FA PIN */}
      <Surface className="p-6 space-y-4 border-gold/30">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            3. Private Owner Security Lock · ایڈمن اکاؤنٹ لاک کریں
          </h2>
          <p className="text-xs text-muted">
            Change your login email, set a private strong password, and enable your secret 6-digit 2FA PIN so nobody else can access the admin panel.
          </p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSecMsg('');
            setSecErr('');
            setSecBusy(true);
            try {
              const res = await apiFetch<{ ok: boolean; token: string; user: UserProfile }>('/api/admin/security', {
                method: 'POST',
                body: JSON.stringify({
                  currentPassword: secCurrentPass,
                  newEmail: secEmail,
                  newPassword: secNewPass,
                  twoFactorEnabled: twoFA,
                  newTwoFactorPin: secPin,
                }),
              });
              setAuthSession(res.token, res.user);
              setSecCurrentPass('');
              setSecNewPass('');
              setSecPin('');
              setSecMsg('Owner credentials & security lock updated! Previous sessions signed out.');
              await reload();
            } catch (err: unknown) {
              setSecErr(err instanceof Error ? err.message : 'Failed to update security settings');
            } finally {
              setSecBusy(false);
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Private Admin Email" htmlFor="sec-email">
              <input
                id="sec-email"
                type="email"
                required
                value={secEmail}
                onChange={(e) => setSecEmail(e.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Current Password (Required)" htmlFor="sec-cur-pass">
              <input
                id="sec-cur-pass"
                type="password"
                required
                value={secCurrentPass}
                onChange={(e) => setSecCurrentPass(e.target.value)}
                placeholder="Enter current password"
                className={inputClassName}
              />
            </Field>
            <Field label="New Private Password (Min 8 chars, optional)" htmlFor="sec-new-pass">
              <input
                id="sec-new-pass"
                type="password"
                minLength={8}
                value={secNewPass}
                onChange={(e) => setSecNewPass(e.target.value)}
                placeholder="Leave blank to keep current password"
                className={inputClassName}
              />
            </Field>
            <Field label="Custom 6-Digit 2FA PIN (Optional)" htmlFor="sec-pin">
              <input
                id="sec-pin"
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={secPin}
                onChange={(e) => setSecPin(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                placeholder="Enter new 6-digit PIN"
                className={`${inputClassName} font-mono`}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={twoFA}
              onChange={(e) => setTwoFA(e.target.checked)}
            />
            <span>Enforce 2FA 6-Digit PIN on every Admin Login (Recommended)</span>
          </label>

          {secErr ? <p role="alert" className="text-xs font-medium text-spicy">{secErr}</p> : null}
          {secMsg ? <p className="text-xs font-medium text-primary">{secMsg}</p> : null}

          <Button type="submit" tone="gold" disabled={secBusy}>
            {secBusy ? 'Updating Security…' : 'Save Private Admin Security'}
          </Button>
        </form>
      </Surface>

      {/* Admin Security Audit Logs */}
      <Surface className="p-6">
        <h2 className="text-base font-semibold pb-3 border-b border-border/50">
          Security Audit Log (Admin Actions)
        </h2>
        <div className="divide-y divide-border/50 text-xs">
          {data.adminLogs.length === 0 ? (
            <p className="py-4 text-muted">No admin audit events logged yet.</p>
          ) : (
            data.adminLogs.slice(0, 15).map((log) => (
              <div key={log.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span>
                  <strong className="font-mono text-gold">{log.action}</strong> on {log.entity} — {log.details}
                </span>
                <span className="text-muted">
                  {log.adminEmail} · {new Date(log.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                </span>
              </div>
            ))
          )}
        </div>
      </Surface>
    </div>
  );
};
