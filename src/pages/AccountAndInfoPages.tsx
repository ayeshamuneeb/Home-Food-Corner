import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Clock, LogOut, MapPin, Phone, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Field,
  inputClassName,
  KarachiLocatorMap,
  Surface,
} from '../components/ui';
import { useStore } from '../context/StoreContext';
import { PushNotificationToggle, PWAInstallButton } from '../hooks/usePWA';
import { formatPKR, formatTime12h } from '../lib/storeHours';
import type { Order, RewardTransaction, SavedAddress, UserProfile } from '../types';

export const AuthPage: React.FC<{ mode: 'login' | 'signup' }> = ({ mode }) => {
  const { setAuthSession, apiFetch } = useStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const body =
        mode === 'signup' ? { email, password, fullName, phone } : { email, password };
      const res = await apiFetch<{ token: string; user: UserProfile }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAuthSession(res.token, res.user);
      navigate('/profile');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          email: 'ayesha.foodie@gmail.com',
          fullName: 'Ayesha Nawaz',
        }),
      });
      setAuthSession(res.token, res.user);
      navigate('/profile');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Surface className="p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {mode === 'signup' ? 'Create Customer Account' : 'Welcome Back'}
          </h1>
          <p className="font-urdu mt-1 text-sm text-gold">
            {mode === 'signup'
              ? 'اکاؤنٹ بنائیں اور 50 ویلکم انعامی پوائنٹس حاصل کریں'
              : 'آرڈر ہسٹری اور انعامی پوائنٹس دیکھنے کے لیے لاگ ان کریں'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' ? (
            <>
              <Field label="Full Name · آپ کا نام" htmlFor="auth-name">
                <input
                  id="auth-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Bilal Ahmed"
                  className={inputClassName}
                />
              </Field>
              <Field label="Phone Number (Optional) · فون نمبر" htmlFor="auth-phone">
                <input
                  id="auth-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0300-XXXXXXX"
                  className={inputClassName}
                />
              </Field>
            </>
          ) : null}

          <Field label="Email Address · ای میل" htmlFor="auth-email">
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClassName}
            />
          </Field>

          <Field label="Password · پاس ورڈ" htmlFor="auth-pass" error={error}>
            <input
              id="auth-pass"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className={inputClassName}
            />
          </Field>

          <Button type="submit" tone="primary" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="space-y-3 border-t border-border/50 pt-5">
          <Button tone="quiet" onClick={() => void handleGoogleSignIn()} disabled={busy} className="w-full">
            Continue with Google
          </Button>

          {mode === 'login' ? (
            <button
              type="button"
              onClick={() => {
                setEmail('bilal@example.com');
                setPassword('Customer123!');
              }}
              className="w-full text-center text-xs text-muted hover:text-gold"
            >
              Fill regular customer account (bilal@example.com · 265 pts)
            </button>
          ) : null}
        </div>

        <p className="text-center text-sm text-muted">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-gold hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to Home Food Corner?{' '}
              <Link to="/signup" className="font-semibold text-gold hover:underline">
                Create account
              </Link>
            </>
          )}
        </p>
      </Surface>
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const { user, token, logout, updateUserProfileState, apiFetch } = useStore();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [addresses, setAddresses] = useState<SavedAddress[]>(user?.savedAddresses || []);
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddress, setNewAddress] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone);
      setAddresses(user.savedAddresses);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Surface className="p-8 space-y-4">
          <h1 className="text-xl font-semibold">Sign in to view your profile</h1>
          <p className="font-urdu text-sm text-muted">
            اپنے پوائنٹس، محفوظ پتے اور آرڈر ہسٹری دیکھنے کے لیے لاگ ان کریں۔
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/login"><Button tone="primary">Sign In</Button></Link>
            <Link to="/signup"><Button tone="quiet">Create Account</Button></Link>
          </div>
        </Surface>
      </div>
    );
  }

  const saveProfile = async (nextAddresses = addresses) => {
    setSavedMsg('');
    const res = await apiFetch<{ user: UserProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ fullName, phone, savedAddresses: nextAddresses }),
    });
    updateUserProfileState(res.user);
    setSavedMsg('Profile saved · معلومات محفوظ ہو گئیں');
  };

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.trim()) return;
    const updated = [
      ...addresses,
      { id: `addr-${Date.now()}`, label: newLabel || 'Home', address: newAddress.trim() },
    ];
    setAddresses(updated);
    setNewAddress('');
    await saveProfile(updated);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{user.fullName}</h1>
          <p className="text-sm text-muted">
            {user.email} · <strong className="text-gold">{user.pointsBalance} Reward Points</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <PushNotificationToggle token={token} />
          <PWAInstallButton />
          <Link to="/rewards">
            <Button tone="quiet">
              <Award className="h-4 w-4 text-gold" />
              <span>Rewards ({user.pointsBalance} pts)</span>
            </Button>
          </Link>
          {user.role === 'admin' ? (
            <Link to="/admin">
              <Button tone="gold">Open Admin Console</Button>
            </Link>
          ) : null}
          <Button
            tone="quiet"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Surface className="p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Personal Details</h2>
          <Field label="Full Name">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClassName}
            />
          </Field>
          <Field label="Phone Number">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0300-XXXXXXX"
              className={inputClassName}
            />
          </Field>
          {savedMsg ? <p className="text-xs font-medium text-primary">{savedMsg}</p> : null}
          <Button tone="primary" onClick={() => void saveProfile()}>
            Save Changes
          </Button>
        </Surface>

        <Surface className="p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            Saved Delivery Addresses · محفوظ پتے
          </h2>
          <div className="divide-y divide-border/50">
            {addresses.length === 0 ? (
              <p className="py-3 text-xs text-muted">No saved addresses yet.</p>
            ) : (
              addresses.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 py-3">
                  <div>
                    <p className="text-xs font-semibold text-gold">{a.label}</p>
                    <p className="text-sm text-foreground">{a.address}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = addresses.filter((x) => x.id !== a.id);
                      setAddresses(next);
                      void saveProfile(next);
                    }}
                    aria-label="Remove address"
                    className="p-1 text-muted hover:text-spicy"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addAddress} className="space-y-3 border-t border-border/50 pt-4">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label"
                aria-label="Address label"
                className={inputClassName}
              />
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="House, Street, Area…"
                aria-label="New address"
                className={`${inputClassName} col-span-2`}
              />
            </div>
            <Button type="submit" tone="quiet">
              <Plus className="h-4 w-4" />
              <span>Add Address</span>
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
};

export const OrdersPage: React.FC = () => {
  const { user, lastPlacedOrder, notifications, apiFetch } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupOrder, setLookupOrder] = useState<Order | null>(null);
  const [lookupErr, setLookupErr] = useState('');

  useEffect(() => {
    if (!user) return;
    apiFetch<{ orders: Order[] }>('/api/my/orders')
      .then((res) => setOrders(res.orders))
      .catch(() => {});
  }, [user, apiFetch, notifications.length]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupCode.trim()) return;
    setLookupErr('');
    try {
      const res = await apiFetch<{ order: Order }>(
        `/api/orders/lookup/${encodeURIComponent(lookupCode.trim())}`
      );
      setLookupOrder(res.order);
    } catch (err: unknown) {
      setLookupOrder(null);
      setLookupErr(err instanceof Error ? err.message : 'Order not found');
    }
  };

  const displayOrders = user
    ? orders
    : lookupOrder
      ? [lookupOrder]
      : lastPlacedOrder
        ? [lastPlacedOrder]
        : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders & Live Tracking · آرڈرز</h1>
          <p className="text-sm text-muted">
            Real-time kitchen status updates from Home Food Corner.
          </p>
        </div>

        <form onSubmit={handleLookup} className="flex gap-2">
          <input
            type="text"
            value={lookupCode}
            onChange={(e) => setLookupCode(e.target.value)}
            placeholder="Track ID (e.g. HFC-1042)"
            aria-label="Order ID lookup"
            className={`${inputClassName} w-48 font-mono`}
          />
          <Button type="submit" tone="quiet">Track</Button>
        </form>
      </div>

      {lookupErr ? <p role="alert" className="text-sm text-spicy">{lookupErr}</p> : null}

      {displayOrders.length === 0 ? (
        <Surface className="p-8 text-center space-y-3">
          <p className="text-base font-semibold">No orders to display yet</p>
          <p className="text-sm text-muted">
            Place an order or sign in to view your full Home Food Corner order history.
          </p>
          <Link to="/menu"><Button tone="primary">Order Fresh Food</Button></Link>
        </Surface>
      ) : (
        <div className="space-y-4">
          {displayOrders.map((ord) => (
            <Surface key={ord.id} className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div>
                  <span className="font-mono text-base font-semibold text-gold">
                    {ord.orderNumber}
                  </span>
                  <span className="text-xs text-muted">
                    {' '}· {new Date(ord.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}
                  </span>
                </div>
                <span className="text-sm font-semibold text-primary">
                  Status: {ord.status}
                </span>
              </div>

              <div className="divide-y divide-border/40 text-sm">
                {ord.items.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 tabular-nums">
                    <span>
                      {item.quantity} × {item.productNameEn}
                    </span>
                    <span>{formatPKR(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-sm tabular-nums">
                <span className="text-muted">
                  {ord.fulfillmentType.toUpperCase()} · {ord.customerAddress}
                </span>
                <span className="text-base font-bold text-foreground">
                  Total: {formatPKR(ord.totalAmount)}
                </span>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
};

export const RewardsPage: React.FC = () => {
  const { user, rewards, settings, apiFetch } = useStore();
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ transactions: RewardTransaction[] }>('/api/my/rewards')
      .then((res) => setTransactions(res.transactions))
      .catch(() => {});
  }, [user, apiFetch]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <Surface className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
              <Award className="h-4 w-4" />
              <span>Home Food Corner Loyalty Club</span>
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              Rewards & Points · انعامی پوائنٹس
            </h1>
            <p className="mt-1 text-sm text-muted">
              Earn {settings.pointsPer100Pkr} points on every Rs. 100 spent. Redeem directly during checkout!
            </p>
          </div>

          <div className="text-left sm:text-right">
            {user ? (
              <>
                <p className="text-xs text-muted">Your Current Balance</p>
                <p className="text-3xl font-bold tabular-nums text-gold">
                  {user.pointsBalance} pts
                </p>
              </>
            ) : (
              <Link to="/signup">
                <Button tone="primary">Join Free (+50 Bonus Pts)</Button>
              </Link>
            )}
          </div>
        </div>
      </Surface>

      {user && rewards.length > 0 ? (() => {
        const sortedRewards = [...rewards].sort((a, b) => a.pointsRequired - b.pointsRequired);
        const nextLocked = sortedRewards.find((r) => user.pointsBalance < r.pointsRequired);
        const topGoal = sortedRewards[sortedRewards.length - 1];
        const target = nextLocked || topGoal;
        const pct = Math.min(100, Math.round((user.pointsBalance / target.pointsRequired) * 100));
        return (
          <Surface className="p-5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-foreground">
                {nextLocked
                  ? `Next Reward: ${nextLocked.titleEn} (${nextLocked.pointsRequired} pts)`
                  : `All ${sortedRewards.length} Loyalty Tiers Unlocked!`}
              </span>
              <span className="font-mono text-gold tabular-nums">
                {user.pointsBalance} / {target.pointsRequired} pts ({pct}%)
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-background border border-border/60">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </Surface>
        );
      })() : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {rewards.map((rew) => {
          const unlocked = user ? user.pointsBalance >= rew.pointsRequired : false;
          return (
            <Surface key={rew.id} className="flex flex-col justify-between p-5">
              <div>
                <p className="text-xs font-semibold tabular-nums text-primary">
                  {rew.pointsRequired} Points · Save {formatPKR(rew.discountValue)}
                </p>
                <h2 className="mt-1.5 text-lg font-semibold text-foreground">{rew.titleEn}</h2>
                <p className="font-urdu text-base text-gold">{rew.titleUr}</p>
                <p className="mt-2 text-xs text-muted">{rew.descriptionEn}</p>
                {rew.descriptionUr ? (
                  <p className="font-urdu mt-1 text-xs text-muted">{rew.descriptionUr}</p>
                ) : null}
              </div>
              <div className="mt-4 border-t border-border/50 pt-3 text-xs font-medium">
                {!user ? (
                  <span className="text-muted">Sign in to unlock</span>
                ) : unlocked ? (
                  <Link to="/checkout" className="text-primary hover:underline">
                    Unlocked — Redeem in Checkout →
                  </Link>
                ) : (
                  <span className="text-muted tabular-nums">
                    {rew.pointsRequired - user.pointsBalance} more points needed
                  </span>
                )}
              </div>
            </Surface>
          );
        })}
      </div>

      {user ? (
        <Surface className="p-6">
          <h2 className="text-base font-semibold text-foreground pb-3 border-b border-border/50">
            Points History · پوائنٹس کا ریکارڈ
          </h2>
          <div className="divide-y divide-border/50">
            {transactions.length === 0 ? (
              <p className="py-4 text-sm text-muted">No point transactions recorded yet.</p>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{t.description}</p>
                    <p className="text-xs text-muted">
                      {new Date(t.createdAt).toLocaleDateString('en-PK')}
                    </p>
                  </div>
                  <span
                    className={`font-semibold tabular-nums ${
                      t.pointsDelta >= 0 ? 'text-primary' : 'text-spicy'
                    }`}
                  >
                    {t.pointsDelta >= 0 ? `+${t.pointsDelta}` : t.pointsDelta} pts
                  </span>
                </div>
              ))
            )}
          </div>
        </Surface>
      ) : null}
    </div>
  );
};

export const ReviewsPage: React.FC = () => {
  const { reviews, products, user, apiFetch, refreshBootstrap } = useStore();
  const [rating, setRating] = useState(5);
  const [productId, setProductId] = useState('');
  const [comment, setComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErr('');
    setBusy(true);
    try {
      if (editingId) {
        await apiFetch(`/api/reviews/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ rating, comment }),
        });
      } else {
        await apiFetch('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({ productId: productId || null, rating, comment }),
        });
      }
      setComment('');
      setEditingId(null);
      await refreshBootstrap();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Failed to post review');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-2xl font-bold text-foreground">
          Customer Reviews & Ratings · صارفین کے تبصرے
        </h1>
        <p className="mt-1 text-sm text-muted">
          Honest feedback from neighbours across Karachi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          {reviews.map((rev) => (
            <Surface key={rev.id} className="p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-foreground">{rev.customerName}</span>
                  {rev.productNameEn ? (
                    <span className="text-xs text-primary"> · {rev.productNameEn}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gold">{'★'.repeat(rev.rating)}</span>
                  {user?.id === rev.userId ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(rev.id);
                          setRating(rev.rating);
                          setComment(rev.comment);
                        }}
                        className="text-xs text-gold hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/reviews/${rev.id}`, { method: 'DELETE' });
                          await refreshBootstrap();
                        }}
                        className="text-xs text-spicy hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-foreground">{rev.comment}</p>
              {rev.adminReply ? (
                <p className="border-t border-border/50 pt-2 text-xs text-muted">
                  <strong className="text-gold">Home Food Corner:</strong> {rev.adminReply}
                </p>
              ) : null}
            </Surface>
          ))}
        </div>

        <div className="lg:col-span-5">
          <Surface className="p-6">
            <h2 className="text-base font-semibold text-foreground">
              {editingId ? 'Update Your Review' : 'Write a Review · اپنی رائے دیں'}
            </h2>
            {!user ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted">Please log in to leave a verified review.</p>
                <Link to="/login"><Button tone="primary">Sign In</Button></Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                {!editingId ? (
                  <Field label="Dish (Optional)">
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className={inputClassName}
                    >
                      <option value="">General Store Experience</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.nameEn}</option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                <Field label="Stars">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className={`min-h-10 min-w-10 rounded-control border text-sm font-semibold ${
                          rating >= s
                            ? 'border-gold bg-gold/15 text-gold'
                            : 'border-border bg-background text-muted'
                        }`}
                      >
                        {s}★
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Comment" error={err}>
                  <textarea
                    rows={3}
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your feedback in Urdu or English…"
                    className={inputClassName}
                  />
                </Field>

                <Button type="submit" tone="primary" disabled={busy}>
                  {editingId ? 'Save Changes' : 'Publish Review'}
                </Button>
              </form>
            )}
          </Surface>
        </div>
      </div>
    </div>
  );
};

export const PoliciesPage: React.FC = () => {
  const { policies } = useStore();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-2xl font-bold text-foreground">
          Store Policies & Terms · اسٹور پالیسیز
        </h1>
        <p className="mt-1 text-sm text-muted">
          Transparent kitchen, delivery, refund, and privacy commitments.
        </p>
      </div>

      <div className="space-y-4">
        {policies.map((pol) => (
          <Surface key={pol.slug} id={pol.slug} className="p-6 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">{pol.titleEn}</h2>
              <span className="font-urdu text-base text-gold">{pol.titleUr}</span>
            </div>
            <p className="text-sm leading-relaxed text-muted">{pol.contentEn}</p>
            <p className="font-urdu text-sm text-foreground pt-1">{pol.contentUr}</p>
          </Surface>
        ))}
      </div>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const { settings, openingHours, storeStatus, socialLinks } = useStore();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-2xl font-bold text-foreground">
          Visit or Contact Home Food Corner · رابطہ اور پتہ
        </h1>
        <p className="mt-1 text-sm text-muted">
          {storeStatus.statusLabelEn} · Current Karachi Time: {storeStatus.karachiTimeLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <KarachiLocatorMap addressEn={settings.addressEn} />

          <Surface className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-gold mt-0.5" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Stall Location</h2>
                <p className="text-sm text-muted">{settings.addressEn}</p>
                <p className="font-urdu text-sm text-gold mt-0.5">{settings.addressUr}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-t border-border/50 pt-4">
              <Phone className="h-5 w-5 shrink-0 text-primary mt-0.5" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Phone & WhatsApp Desk</h2>
                <p className="text-sm text-muted">{settings.contactPhone}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={`https://wa.me/${settings.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Chat on WhatsApp
              </a>
              <a
                href={settings.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-background px-4 text-sm font-medium text-foreground hover:border-gold"
              >
                Open in Google Maps
              </a>
            </div>
          </Surface>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Surface className="p-6">
            <div className="flex items-center gap-2 pb-3 border-b border-border/50">
              <Clock className="h-4 w-4 text-gold" />
              <h2 className="text-base font-semibold text-foreground">
                Opening Hours (Asia/Karachi)
              </h2>
            </div>
            <div className="divide-y divide-border/50 text-sm">
              {openingHours.map((h) => (
                <div key={h.dayOfWeek} className="flex items-center justify-between py-2.5">
                  <span>
                    {h.dayNameEn} · <span className="font-urdu text-muted">{h.dayNameUr}</span>
                  </span>
                  <span className="tabular-nums font-medium text-foreground">
                    {h.isClosed ? (
                      <span className="text-spicy">Closed</span>
                    ) : (
                      `${formatTime12h(h.openTime)} – ${formatTime12h(h.closeTime)}`
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="p-6 space-y-3">
            <h2 className="text-base font-semibold text-foreground">Follow Us Direct</h2>
            <div className="flex flex-wrap gap-2">
              {socialLinks.map((s) => (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-control border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:border-gold"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
};
