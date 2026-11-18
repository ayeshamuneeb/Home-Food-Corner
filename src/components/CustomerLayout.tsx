import React, { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Clock,
  Home,
  Menu as MenuIcon,
  ReceiptText,
  Search,
  ShoppingBag,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  MobilePWAInstallBanner,
  OfflineIndicator,
  PushNotificationToggle,
  PWAInstallButton,
} from '../hooks/usePWA';
import { formatPKR } from '../lib/storeHours';
import { AIAssistantDrawer } from './AIAssistantDrawer';
import { BrandLogo, Button, Surface } from './ui';

const ADMIN_UNLOCK_CLICKS = 10;
const ADMIN_TAP_TIMEOUT_MS = 3500;
let logoTapCount = 0;
let logoLastTapAt = 0;
let logoTapResetTimer: number | null = null;

export const CustomerLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    settings,
    storeStatus,
    offers,
    cartCount,
    user,
    token,
    notifications,
    unreadCount,
    liveAlert,
    dismissLiveAlert,
    markNotificationRead,
    markAllNotificationsRead,
    socialLinks,
  } = useStore();

  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(false);

  const activeOffer = offers[0];

  const handleSecretLogoTap = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - logoLastTapAt > ADMIN_TAP_TIMEOUT_MS) {
      logoTapCount = 0;
    }
    logoLastTapAt = now;
    logoTapCount += 1;

    if (logoTapResetTimer !== null) {
      window.clearTimeout(logoTapResetTimer);
      logoTapResetTimer = null;
    }

    if (logoTapCount >= ADMIN_UNLOCK_CLICKS) {
      e.preventDefault();
      logoTapCount = 0;
      logoLastTapAt = 0;
      navigate(user?.role === 'admin' ? '/admin' : '/admin/login');
      return;
    }

    // Once user taps more than once rapidly, keep them on the same page so 10-click unlock doesn't cause extra route jumps
    if (logoTapCount >= 2 && location.pathname !== '/') {
      e.preventDefault();
    }

    logoTapResetTimer = window.setTimeout(() => {
      logoTapCount = 0;
      logoLastTapAt = 0;
      logoTapResetTimer = null;
    }, ADMIN_TAP_TIMEOUT_MS);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    navigate(q ? `/menu?q=${encodeURIComponent(q)}` : '/menu');
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { to: '/menu', label: 'Full Menu' },
    { to: '/category/food', label: 'Food' },
    { to: '/category/drinks', label: 'Drinks' },
    { to: '/category/dinner', label: 'Dinner' },
    { to: '/rewards', label: 'Rewards' },
  ];

  const bottomTabs = [
    { to: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
    {
      to: '/menu',
      label: 'Menu',
      icon: UtensilsCrossed,
      match: (p: string) => p.startsWith('/menu') || p.startsWith('/category') || p.startsWith('/product'),
    },
    { to: '/cart', label: 'Cart', icon: ShoppingBag, badge: cartCount, match: (p: string) => p === '/cart' || p === '/checkout' },
    { to: '/orders', label: 'Orders', icon: ReceiptText, match: (p: string) => p.startsWith('/orders') || p === '/order-success' },
    { to: user ? '/profile' : '/login', label: 'Profile', icon: User, match: (p: string) => p === '/profile' || p === '/login' || p === '/signup' },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground pb-16 md:pb-0">
      <OfflineIndicator />
      <MobilePWAInstallBanner />

      {/* Slim dismissible promotion bar (1_ecommerce_retail.md Section 2) */}
      {activeOffer && !promoDismissed ? (
        <div className="border-b border-border/60 bg-[#152018] px-4 py-2 text-xs text-foreground">
          <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3">
            <p className="min-w-0">
              <span className="font-semibold text-gold">{activeOffer.titleEn}</span>
              <span className="hidden sm:inline text-muted"> · {activeOffer.subtitleEn}</span>
            </p>
            <button
              type="button"
              onClick={() => setPromoDismissed(true)}
              aria-label="Dismiss promotional banner"
              className="shrink-0 rounded p-1 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Closed Store Warning Banner in Urdu & English */}
      {!storeStatus.isOpen ? (
        <div role="status" className="border-b border-spicy/40 bg-[#2b1111] px-4 py-2.5 text-center text-sm">
          <span className="font-urdu font-semibold text-gold">{storeStatus.closedBannerUr}</span>
          <span className="ml-2 text-xs text-muted">({storeStatus.statusLabelEn})</span>
        </div>
      ) : null}

      {/* Quiet Top Bar: Brand, at most 5 links, Search, Install, Bell, Account, Bag */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              onClick={handleSecretLogoTap}
              className="flex shrink-0 select-none items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <BrandLogo size={38} customUrl={settings.logoUrl} />
              <span className="text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                {settings.brandName}
              </span>
            </Link>

            <nav aria-label="Store categories" className="hidden lg:flex items-center gap-5">
              {navLinks.map((link) => {
                const active = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`whitespace-nowrap text-sm font-medium transition-colors duration-150 ${
                      active ? 'text-gold' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search dishes"
                  aria-label="Search dishes"
                  className="min-h-10 w-44 rounded-control border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary xl:w-56"
                />
              </div>
            </form>

            <div className="hidden sm:block">
              <PWAInstallButton compact />
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Notifications"
                className="relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-control border border-border bg-surface text-foreground hover:border-gold/50 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 ? (
                  <span className="ml-1 text-xs font-semibold tabular-nums text-gold">
                    {unreadCount}
                  </span>
                ) : null}
              </button>

              {notifOpen ? (
                <Surface className="absolute right-0 mt-2 w-80 sm:w-96 z-50 p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/50">
                    <span className="text-sm font-semibold">Live Updates · اطلاعات</span>
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsRead()}
                        className="text-xs text-gold hover:underline"
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  <div className="divide-y divide-border/50">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted">
                        No updates yet. Order status notifications will appear here live.
                      </p>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div key={n.id} className="py-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs font-semibold ${n.isRead ? 'text-muted' : 'text-foreground'}`}>
                              {n.title}
                            </p>
                            {!n.isRead ? (
                              <button
                                type="button"
                                onClick={() => void markNotificationRead(n.id)}
                                className="shrink-0 text-[11px] text-primary hover:underline"
                              >
                                Read
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted">{n.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-2 border-t border-border/50 pt-3">
                    <PushNotificationToggle token={token} compact />
                  </div>
                </Surface>
              ) : null}
            </div>

            {/* Account / Login */}
            {user ? (
              <Link
                to={user.role === 'admin' ? '/admin' : '/profile'}
                className="hidden sm:inline-flex min-h-10 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-sm font-medium text-foreground hover:border-gold/50 whitespace-nowrap"
              >
                <User className="h-4 w-4 text-primary" />
                <span>{user.role === 'admin' ? 'Admin' : `${user.pointsBalance} pts`}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex min-h-10 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-sm font-medium text-foreground hover:border-gold/50 whitespace-nowrap"
              >
                <User className="h-4 w-4" />
                <span>Login</span>
              </Link>
            )}

            {/* Cart Bag */}
            <Link
              to="/cart"
              aria-label={`Shopping cart with ${cartCount} items`}
              className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary px-3.5 text-sm font-semibold text-primary-foreground whitespace-nowrap hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="tabular-nums">{cartCount}</span>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-control border border-border bg-surface text-foreground lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Menu Drawer */}
        {mobileMenuOpen ? (
          <div className="border-t border-border/60 bg-surface px-4 py-4 lg:hidden">
            <form onSubmit={handleSearchSubmit} className="mb-3 flex gap-2">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search dishes…"
                aria-label="Search dishes"
                className="min-h-11 flex-1 rounded-control border border-border bg-background px-3.5 text-sm text-foreground"
              />
              <Button type="submit" tone="primary">
                Search
              </Button>
            </form>

            <div className="flex flex-wrap gap-2 py-2">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-control border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                to="/reviews"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-control border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground"
              >
                Reviews
              </Link>
              <Link
                to="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-control border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground"
              >
                Contact
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
              <PWAInstallButton />
            </div>
          </div>
        ) : null}
      </header>

      {/* WhatsApp-Style Live Realtime Order/Broadcast Banner */}
      {liveAlert ? (
        <div className="fixed top-18 right-4 z-50 w-[calc(100%-2rem)] max-w-sm">
          <Surface className="border-primary p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">
                  Live Update · Home Food Corner
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{liveAlert.title}</p>
                <p className="mt-1 text-xs text-muted">{liveAlert.body}</p>
                {liveAlert.totalAmount !== undefined ? (
                  <p className="mt-1 text-xs font-mono text-gold">
                    Total: {formatPKR(liveAlert.totalAmount)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={dismissLiveAlert}
                aria-label="Dismiss live alert"
                className="rounded p-1 text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Surface>
        </div>
      ) : null}

      <main className="flex-1">{children}</main>

      {/* Footer with Store Status, Policies, Contact & Social Links */}
      <footer className="mt-16 border-t border-border/70 bg-surface">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-3">
              <div
                onClick={handleSecretLogoTap}
                className="inline-flex cursor-pointer select-none items-center gap-2.5"
              >
                <BrandLogo size={36} customUrl={settings.logoUrl} />
                <span className="text-lg font-bold text-foreground">{settings.brandName}</span>
              </div>
              <p className="text-sm text-muted">{settings.taglineEn}</p>
              <p className="font-urdu text-sm text-gold">{settings.taglineUr}</p>
              <div className="flex items-center gap-2 pt-1 text-xs text-muted">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>
                  {storeStatus.statusLabelEn} ({storeStatus.karachiTimeLabel} PKT)
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <h2 className="text-sm font-semibold text-foreground">Explore Menu</h2>
              <ul className="space-y-2 text-sm text-muted">
                <li><Link to="/menu" className="hover:text-foreground">All Menu Items</Link></li>
                <li><Link to="/category/food" className="hover:text-foreground">Street Food & BBQ</Link></li>
                <li><Link to="/category/drinks" className="hover:text-foreground">Karak Chai & Drinks</Link></li>
                <li><Link to="/category/dinner" className="hover:text-foreground">Dinner & Family Deals</Link></li>
                <li><Link to="/rewards" className="hover:text-foreground">Loyalty Points & Rewards</Link></li>
                <li><Link to="/reviews" className="hover:text-foreground">Customer Reviews</Link></li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h2 className="text-sm font-semibold text-foreground">Policies & Support</h2>
              <ul className="space-y-2 text-sm text-muted">
                <li><Link to="/policies" className="hover:text-foreground">Order & Delivery Policy</Link></li>
                <li><Link to="/policies#refund-policy" className="hover:text-foreground">Refund & Late Delivery Policy</Link></li>
                <li><Link to="/policies#privacy-policy" className="hover:text-foreground">Privacy & Terms</Link></li>
                <li><Link to="/contact" className="hover:text-foreground">Location & Contact</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Contact & Social</h2>
              <p className="text-sm text-muted">{settings.addressEn}</p>
              <p className="font-urdu text-sm text-muted">{settings.addressUr}</p>
              <p className="text-sm font-medium text-foreground">{settings.contactPhone}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {socialLinks.map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-control border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-gold"
                  >
                    {s.platform === 'whatsapp' ? 'WhatsApp' : s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-6 text-xs text-muted">
            <p>© {new Date().getFullYear()} {settings.brandName}. Prepared fresh daily · Asia/Karachi.</p>
            <p>Cash on Delivery & Instant WhatsApp Confirmation</p>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation: Home, Menu, Cart, Orders, Profile */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed right-0 bottom-0 left-0 z-30 border-t border-border bg-surface md:hidden"
      >
        <div className="grid grid-cols-5">
          {bottomTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(location.pathname);
            return (
              <Link
                key={tab.label}
                to={tab.to}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium ${
                  active ? 'text-gold' : 'text-muted hover:text-foreground'
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-3 rounded-full bg-primary px-1.5 text-[10px] font-bold tabular-nums text-primary-foreground">
                      {tab.badge}
                    </span>
                  ) : null}
                </div>
                <span className="whitespace-nowrap">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AIAssistantDrawer />
    </div>
  );
};
