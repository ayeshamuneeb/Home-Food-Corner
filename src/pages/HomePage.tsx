import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Award, Clock, Flame, Search, Utensils } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { Button, Surface } from '../components/ui';
import { useStore } from '../context/StoreContext';
import { HERO_IMAGE_URL } from '../lib/seedData';
import { formatPKR } from '../lib/storeHours';

export const HomePage: React.FC = () => {
  const {
    settings,
    storeStatus,
    categories,
    products,
    offers,
    reviews,
    rewards,
    socialLinks,
  } = useStore();
  const navigate = useNavigate();
  const [heroSearch, setHeroSearch] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const featuredProducts = useMemo(
    () => products.filter((p) => p.isFeatured).slice(0, 4),
    [products]
  );

  const dailyDeals = useMemo(
    () => products.filter((p) => p.isDailyDeal).slice(0, 4),
    [products]
  );

  const overallRating = useMemo(() => {
    if (reviews.length === 0) return { avg: 5.0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return { avg: sum / reviews.length, count: reviews.length };
  }, [reviews]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = heroSearch.trim();
    navigate(q ? `/menu?q=${encodeURIComponent(q)}` : '/menu');
  };

  return (
    <div>
      {/* First Frame: Full-bleed Hero on desktop, 4:3 crop + copy on mobile (1_ecommerce_retail.md Section 4) */}
      <section className="relative w-full border-b border-border/70 bg-background">
        <div className="mx-auto max-w-[90rem] lg:relative">
          <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/9] lg:max-h-[560px]">
            {!heroImgFailed ? (
              <img
                src={HERO_IMAGE_URL}
                alt="Sizzling coal-grilled chicken skewers, crispy golden samosas, and fresh mint chutney at Home Food Corner"
                fetchPriority="high"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-[#1d1210]" />
            )}
            {/* Local 4.5:1 gradient scrim on calm left side for desktop text */}
            <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#0B0B0B] via-[#0B0B0B]/88 to-transparent" />
          </div>

          <div className="px-4 py-7 sm:px-6 lg:absolute lg:inset-y-0 lg:left-0 lg:flex lg:max-w-2xl lg:flex-col lg:justify-center lg:px-10 lg:py-12">
            <p className="text-xs font-medium text-gold">
              {storeStatus.isOpen ? (
                <span>● {storeStatus.statusLabelEn}</span>
              ) : (
                <span className="font-urdu text-spicy">{storeStatus.closedBannerUr}</span>
              )}
            </p>

            <h1 className="mt-2 text-[length:var(--text-display)] leading-[var(--text-display--line-height)] font-bold text-foreground">
              Hot coal BBQ, crispy spicy drums & matka chai
            </h1>

            <p className="font-urdu mt-2.5 text-base sm:text-lg text-gold">
              {settings.taglineUr}
            </p>

            <p className="mt-2 max-w-[34em] text-sm text-muted">
              Cooked fresh to order in Gulshan-e-Iqbal. Free delivery from {formatPKR(settings.freeDeliveryThreshold)} and {settings.pointsPer100Pkr} reward points on every Rs. 100.
            </p>

            <form onSubmit={onSearch} className="mt-5 flex max-w-lg flex-wrap gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                  placeholder="Search tikka, pasta, chai…"
                  aria-label="Search Home Food Corner menu"
                  className="min-h-11 w-full rounded-control border border-border bg-surface/95 pl-10 pr-3.5 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary"
                />
              </div>
              <Button type="submit" tone="primary">
                <span>Explore Menu</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-14 px-4 py-10 sm:px-6">
        {/* 1. Categories: Food, Drinks, Dinner */}
        <section aria-labelledby="categories-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="categories-heading" className="text-[length:var(--text-title)] font-semibold text-foreground">
                Browse by category · کیٹیگریز
              </h2>
              <p className="mt-1 text-sm text-muted">
                Street snacks, chilled drinks & hot chai, and complete family dinners.
              </p>
            </div>
            <Link to="/menu" className="text-sm font-medium text-gold hover:underline">
              View all {products.length} items →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id).length;
              return (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
                  className="group block focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Surface className="flex h-full flex-col justify-between p-5 transition-colors duration-150 hover:border-gold/60">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                          <Utensils className="h-3.5 w-3.5" />
                          <span>{count} dishes</span>
                        </span>
                        <span className="font-urdu text-gold">{cat.nameUr}</span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-foreground group-hover:text-gold">
                        {cat.nameEn}
                      </h3>
                      <p className="mt-1 text-sm text-muted">{cat.descriptionEn}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs font-medium text-foreground">
                      <span className="font-urdu">{cat.descriptionUr}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-gold" />
                    </div>
                  </Surface>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 2. Featured Items */}
        <section aria-labelledby="featured-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="featured-heading" className="text-[length:var(--text-title)] font-semibold text-foreground">
                Stall favourites · مشہور کھانے
              </h2>
              <p className="mt-1 text-sm text-muted">
                Fresh off the coal grill, fryer, and tawa tonight.
              </p>
            </div>
            <Link to="/menu" className="text-sm font-medium text-gold hover:underline">
              Full catalogue →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        {/* 3. Daily Deals & Offer Banner */}
        <section aria-labelledby="deals-heading" className="space-y-6">
          {offers.length > 0 ? (
            <Surface className="bg-[#1f1312] p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                <div className="space-y-2 max-w-2xl">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold">
                    <Flame className="h-4 w-4 text-spicy" />
                    <span>Evening Special Offer · خصوصی آفر</span>
                  </p>
                  <h2 id="deals-heading" className="text-xl sm:text-2xl font-bold text-foreground">
                    {offers[0].titleEn}
                  </h2>
                  <p className="font-urdu text-base text-gold">{offers[0].titleUr}</p>
                  <p className="text-sm text-muted">{offers[0].subtitleEn}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link to="/category/dinner">
                    <Button tone="gold">Order Family Deals</Button>
                  </Link>
                  <Link to="/rewards">
                    <Button tone="quiet">
                      <Award className="h-4 w-4 text-primary" />
                      <span>View Loyalty Rewards</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </Surface>
          ) : null}

          {dailyDeals.length > 0 ? (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Today’s discounted deals · آج کی بچت ڈیلز
                  </h3>
                  <p className="text-sm text-muted">Special stall prices applied automatically in your cart.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {dailyDeals.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* 4. Loyalty Rewards Strip & Store Hours */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Surface className="p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-border/50">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Earn points on every order · انعامی پوائنٹس سسٹم
                </h2>
                <p className="text-xs text-muted">
                  Earn {settings.pointsPer100Pkr} points per Rs. 100 spent and redeem at checkout.
                </p>
              </div>
              <Link to="/rewards" className="text-xs font-semibold text-gold hover:underline">
                My Rewards →
              </Link>
            </div>
            <div className="divide-y divide-border/50">
              {rewards.slice(0, 3).map((rew) => (
                <div key={rew.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {rew.titleEn} · <span className="font-urdu text-gold">{rew.titleUr}</span>
                    </p>
                    <p className="text-xs text-muted">{rew.descriptionEn}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-primary whitespace-nowrap">
                    {rew.pointsRequired} pts ({formatPKR(rew.discountValue)} off)
                  </span>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="p-6 lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Clock className="h-4 w-4" />
                <span>Asia/Karachi Live Stall Status</span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-foreground">
                {storeStatus.isOpen ? 'Kitchen is Open Now' : 'Kitchen is Currently Closed'}
              </h2>
              <p className="font-urdu mt-1 text-base text-gold">
                {storeStatus.statusLabelUr}
              </p>
              <p className="mt-2 text-sm text-muted">
                {settings.addressEn}
              </p>
              <p className="font-urdu text-sm text-muted">{settings.addressUr}</p>
            </div>

            <div className="mt-5 border-t border-border/50 pt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {socialLinks.slice(0, 4).map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-control border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-gold"
                  >
                    {link.platform === 'whatsapp' ? 'WhatsApp' : link.label}
                  </a>
                ))}
              </div>
              <p className="text-xs text-muted">
                Direct Order Helpline: <strong className="text-foreground">{settings.contactPhone}</strong>
              </p>
            </div>
          </Surface>
        </section>

        {/* 5. Customer Reviews Section */}
        <section aria-labelledby="reviews-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="reviews-heading" className="text-[length:var(--text-title)] font-semibold text-foreground">
                Neighbourhood reviews · صارفین کی آراء
              </h2>
              <p className="mt-1 text-sm text-muted tabular-nums">
                ★ {overallRating.avg.toFixed(1)} average from {overallRating.count} verified customer reviews
              </p>
            </div>
            <Link to="/reviews" className="text-sm font-medium text-gold hover:underline">
              Read & write reviews →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {reviews.slice(0, 4).map((rev) => (
              <Surface key={rev.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-foreground">{rev.customerName}</span>
                    <span className="text-gold tabular-nums">{'★'.repeat(rev.rating)}</span>
                  </div>
                  {rev.productNameEn ? (
                    <p className="mt-1 text-xs text-primary">{rev.productNameEn}</p>
                  ) : null}
                  <p className="mt-2.5 text-sm leading-relaxed text-foreground">{rev.comment}</p>
                </div>

                {rev.adminReply ? (
                  <div className="mt-3 border-t border-border/50 pt-2.5 text-xs text-muted">
                    <span className="font-semibold text-gold">HFC Reply: </span>
                    <span className="font-urdu">{rev.adminReply}</span>
                  </div>
                ) : null}
              </Surface>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
