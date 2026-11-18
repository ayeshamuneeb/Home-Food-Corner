import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import {
  Button,
  Field,
  inputClassName,
  ProductVisual,
  SpicyLabel,
  StarRatingText,
  Surface,
} from '../components/ui';
import { useStore } from '../context/StoreContext';
import { formatPKR } from '../lib/storeHours';

export const ProductPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const {
    products,
    reviews,
    user,
    addToCart,
    storeStatus,
    apiFetch,
    refreshBootstrap,
  } = useStore();

  const product = useMemo(
    () => products.find((p) => p.slug === slug),
    [products, slug]
  );

  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const productReviews = useMemo(
    () => (product ? reviews.filter((r) => r.productId === product.id) : []),
    [reviews, product]
  );

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
      .slice(0, 4);
  }, [products, product]);

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Surface className="p-8">
          <h1 className="text-xl font-semibold">Dish not found · یہ آئٹم موجود نہیں</h1>
          <p className="mt-2 text-sm text-muted">
            This item may have been moved or removed from today’s stall menu.
          </p>
          <div className="mt-5">
            <Link to="/menu">
              <Button tone="primary">Browse Full Menu</Button>
            </Link>
          </div>
        </Surface>
      </div>
    );
  }

  const soldOut = !product.isAvailable || product.stockQty <= 0;
  const effectivePrice = product.discountPrice !== null ? product.discountPrice : product.price;

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setReviewError('');
    setReviewBusy(true);
    try {
      if (editingId) {
        await apiFetch(`/api/reviews/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ rating, comment }),
        });
      } else {
        await apiFetch('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({ productId: product.id, rating, comment }),
        });
      }
      setComment('');
      setRating(5);
      setEditingId(null);
      await refreshBootstrap();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Could not save review');
    } finally {
      setReviewBusy(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    setReviewBusy(true);
    try {
      await apiFetch(`/api/reviews/${id}`, { method: 'DELETE' });
      await refreshBootstrap();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Could not delete review');
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[90rem] space-y-14 px-4 py-8 sm:px-6 pb-28 md:pb-12">
      <div>
        <Link
          to={`/category/${product.categorySlug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to {product.categorySlug}</span>
        </Link>
      </div>

      {/* Product Detail + Sticky Purchase Module (1_ecommerce_retail.md Section 1) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Surface className="overflow-hidden">
            <ProductVisual product={product} aspectClass="aspect-[4/3]" />
          </Surface>
        </div>

        <div className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
          <Surface className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span className="uppercase tracking-wider">{product.categorySlug}</span>
              <StarRatingText rating={product.averageRating} count={product.reviewCount} />
            </div>

            <div>
              <h1 className="text-[length:var(--text-title)] font-bold text-foreground">
                {product.nameEn}
              </h1>
              <p className="font-urdu mt-1 text-xl text-gold">{product.nameUr}</p>
            </div>

            <div className="flex flex-wrap items-baseline gap-3 border-t border-b border-border/50 py-4 tabular-nums">
              <span className="text-2xl font-bold text-foreground">{formatPKR(effectivePrice)}</span>
              {product.discountPrice !== null ? (
                <>
                  <span className="text-sm text-muted line-through">{formatPKR(product.price)}</span>
                  <span className="text-xs font-semibold text-primary">
                    Save {formatPKR(product.price - product.discountPrice)}
                  </span>
                </>
              ) : null}
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-foreground leading-relaxed">{product.descriptionEn}</p>
              <p className="font-urdu text-base text-muted">{product.descriptionUr}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-border/50 pt-4">
              <SpicyLabel level={product.spicyLevel} />
              {soldOut ? (
                <span className="font-semibold text-spicy">Out of stock · ختم شد</span>
              ) : (
                <span className="font-medium text-primary tabular-nums">
                  Available · {product.stockQty} portions ready
                </span>
              )}
            </div>

            {/* Desktop & Tablet Buy Controls */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center rounded-control border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={soldOut || qty <= 1}
                    aria-label="Decrease quantity"
                    className="min-h-11 px-3.5 text-foreground disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-10 text-center text-sm font-semibold tabular-nums">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(product.stockQty, q + 1))}
                    disabled={soldOut || qty >= product.stockQty}
                    aria-label="Increase quantity"
                    className="min-h-11 px-3.5 text-foreground disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <Button
                  tone="primary"
                  disabled={soldOut || !storeStatus.isOpen}
                  onClick={() => addToCart(product.id, qty)}
                  className="flex-1"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>
                    {soldOut
                      ? 'Sold out · ختم شد'
                      : !storeStatus.isOpen
                        ? 'Store Closed'
                        : `Add ${qty} · ${formatPKR(effectivePrice * qty)}`}
                  </span>
                </Button>
              </div>

              {!storeStatus.isOpen ? (
                <p className="font-urdu text-xs text-spicy">{storeStatus.closedBannerUr}</p>
              ) : null}
            </div>
          </Surface>
        </div>
      </div>

      {/* Sticky Buy Bar on Phones (1_ecommerce_retail.md Section 1) */}
      <div className="fixed right-0 bottom-14 left-0 z-20 border-t border-border bg-surface px-4 py-2.5 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted truncate" title={product.nameEn}>{product.nameEn}</p>
            <p className="text-sm font-bold tabular-nums text-foreground">
              {formatPKR(effectivePrice * qty)}
            </p>
          </div>
          <Button
            tone="primary"
            disabled={soldOut || !storeStatus.isOpen}
            onClick={() => addToCart(product.id, qty)}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>{soldOut ? 'Sold out' : !storeStatus.isOpen ? 'Closed' : 'Add to Cart'}</span>
          </Button>
        </div>
      </div>

      {/* Reviews & Ratings for this Product */}
      <section aria-labelledby="dish-reviews-heading" className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <h2 id="dish-reviews-heading" className="text-xl font-semibold text-foreground">
            Customer reviews ({productReviews.length}) · صارفین کے تبصرے
          </h2>

          {productReviews.length === 0 ? (
            <Surface className="p-6">
              <p className="text-sm text-muted">
                No written reviews for {product.nameEn} yet. Sign in after tasting it to share the first review!
              </p>
            </Surface>
          ) : (
            <Surface className="divide-y divide-border/50 px-5">
              {productReviews.map((rev) => {
                const isOwn = user?.id === rev.userId;
                return (
                  <div key={rev.id} className="py-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-foreground">{rev.customerName}</span>
                        <span className="text-gold tabular-nums">{'★'.repeat(rev.rating)}</span>
                      </div>
                      {isOwn ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(rev.id);
                              setRating(rev.rating);
                              setComment(rev.comment);
                            }}
                            className="text-xs font-medium text-gold hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteReview(rev.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-spicy hover:underline"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <p className="text-sm text-foreground">{rev.comment}</p>
                    {rev.adminReply ? (
                      <p className="text-xs text-muted">
                        <strong className="text-gold">Stall Reply:</strong> {rev.adminReply}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </Surface>
          )}
        </div>

        <div className="lg:col-span-5">
          <Surface className="p-6">
            <h3 className="text-base font-semibold text-foreground">
              {editingId ? 'Edit your review' : 'Rate this dish · ریویو دیں'}
            </h3>
            {!user ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted">
                  Only signed-in customers can post a rating and review.
                </p>
                <p className="font-urdu text-sm text-muted">
                  ریویو دینے کے لیے براہ کرم اپنے اکاؤنٹ میں لاگ ان کریں۔
                </p>
                <Link to="/login">
                  <Button tone="quiet">Sign in to Review</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={submitReview} className="mt-4 space-y-4">
                <Field label="Star Rating (1–5)">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`min-h-10 min-w-10 rounded-control border text-sm font-semibold ${
                          rating >= star
                            ? 'border-gold bg-gold/15 text-gold'
                            : 'border-border bg-background text-muted'
                        }`}
                      >
                        {star}★
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Your Review (English or Urdu)" error={reviewError}>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="How was the taste, spice level, and portion?"
                    required
                    className={inputClassName}
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" tone="primary" disabled={reviewBusy}>
                    {editingId ? 'Update Review' : 'Submit Review'}
                  </Button>
                  {editingId ? (
                    <Button
                      tone="quiet"
                      onClick={() => {
                        setEditingId(null);
                        setComment('');
                        setRating(5);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </form>
            )}
          </Surface>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 ? (
        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl font-semibold text-foreground">
            Pair it with · متعلقہ کھانے
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};
