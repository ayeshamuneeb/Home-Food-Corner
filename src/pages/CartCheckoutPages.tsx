import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button, Field, inputClassName, ProductVisual, Surface } from '../components/ui';
import { useStore } from '../context/StoreContext';
import { calculateOrderPricing, formatPKR } from '../lib/storeHours';
import type { Order } from '../types';

export const CartPage: React.FC = () => {
  const {
    cart,
    products,
    settings,
    storeStatus,
    cartSubtotal,
    updateCartQty,
    removeFromCart,
    clearCart,
  } = useStore();

  const detailedItems = useMemo(() => {
    return cart
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return product ? { product, quantity: item.quantity } : null;
      })
      .filter((v): v is { product: NonNullable<typeof v>['product']; quantity: number } => v !== null);
  }, [cart, products]);

  const remainingForFreeDelivery = Math.max(0, settings.freeDeliveryThreshold - cartSubtotal);

  if (detailedItems.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Surface className="p-8 space-y-4">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted" />
          <h1 className="text-xl font-semibold text-foreground">
            Your cart is empty · آپ کی کارٹ خالی ہے
          </h1>
          <p className="text-sm text-muted">
            Add hot coal Chicken Tikka, Loaded Drum, Creamy Pasta, or Karak Chai from the menu to start your order.
          </p>
          <div>
            <Link to="/menu">
              <Button tone="primary">Explore Menu</Button>
            </Link>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-[length:var(--text-title)] font-bold text-foreground">
            Your Order Bag · آرڈر کارٹ
          </h1>
          <p className="text-sm text-muted">
            {remainingForFreeDelivery === 0
              ? 'You unlocked FREE neighbourhood delivery!'
              : `Add ${formatPKR(remainingForFreeDelivery)} more to unlock FREE delivery.`}
          </p>
        </div>
        <Button tone="quiet" onClick={clearCart}>
          Clear Cart
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Surface className="divide-y divide-border/50 px-5">
            {detailedItems.map(({ product, quantity }) => {
              const unit = product.discountPrice ?? product.price;
              return (
                <div key={product.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-20 shrink-0 overflow-hidden rounded-lg border border-border/60">
                      <ProductVisual product={product} aspectClass="aspect-square" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/product/${product.slug}`}
                        className="text-base font-semibold text-foreground hover:text-gold"
                      >
                        {product.nameEn}
                      </Link>
                      <p className="font-urdu text-sm text-muted">{product.nameUr}</p>
                      <p className="mt-1 text-xs tabular-nums text-muted">
                        {formatPKR(unit)} each
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="inline-flex items-center rounded-control border border-border bg-background">
                      <button
                        type="button"
                        onClick={() => updateCartQty(product.id, quantity - 1)}
                        aria-label={`Decrease ${product.nameEn}`}
                        className="min-h-10 px-3 text-foreground"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(product.id, quantity + 1)}
                        disabled={quantity >= product.stockQty}
                        aria-label={`Increase ${product.nameEn}`}
                        className="min-h-10 px-3 text-foreground disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <span className="min-w-20 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatPKR(unit * quantity)}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeFromCart(product.id)}
                      aria-label={`Remove ${product.nameEn}`}
                      className="rounded-control p-2 text-muted hover:text-spicy focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </Surface>
        </div>

        <div className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
          <Surface className="p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Order Summary · بل کی تفصیل</h2>

            <div className="space-y-2.5 border-t border-b border-border/50 py-4 text-sm tabular-nums">
              <div className="flex justify-between">
                <span className="text-muted">Items Subtotal</span>
                <span className="font-medium text-foreground">{formatPKR(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Est. Delivery Fee</span>
                <span className="font-medium text-foreground">
                  {cartSubtotal >= settings.freeDeliveryThreshold ? 'FREE' : formatPKR(settings.deliveryFee)}
                </span>
              </div>
            </div>

            <div className="flex justify-between text-base font-bold tabular-nums">
              <span>Estimated Total</span>
              <span className="text-gold">
                {formatPKR(
                  cartSubtotal +
                    (cartSubtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee)
                )}
              </span>
            </div>

            {!storeStatus.isOpen ? (
              <div className="space-y-2">
                <p className="font-urdu text-sm text-spicy">{storeStatus.closedBannerUr}</p>
                <Button tone="quiet" disabled className="w-full">
                  Store Currently Closed
                </Button>
              </div>
            ) : (
              <Link to="/checkout" className="block">
                <Button tone="primary" className="w-full">
                  Proceed to Checkout · چیک آؤٹ
                </Button>
              </Link>
            )}
          </Surface>
        </div>
      </div>
    </div>
  );
};

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    products,
    settings,
    storeStatus,
    user,
    rewards,
    clearCart,
    setLastPlacedOrder,
    updateUserProfileState,
    apiFetch,
  } = useStore();
  const navigate = useNavigate();

  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerAddress, setCustomerAddress] = useState(
    user?.savedAddresses?.[0]?.address || ''
  );
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'whatsapp_cod'>('cod');
  const [selectedRewardId, setSelectedRewardId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const lineItems = useMemo(() => {
    return cart
      .map((c) => {
        const prod = products.find((p) => p.id === c.productId);
        if (!prod) return null;
        const unitPrice = prod.discountPrice ?? prod.price;
        return {
          productId: prod.id,
          nameEn: prod.nameEn,
          nameUr: prod.nameUr,
          unitPrice,
          quantity: c.quantity,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [cart, products]);

  const chosenReward = useMemo(
    () => rewards.find((r) => r.id === selectedRewardId),
    [rewards, selectedRewardId]
  );

  const pricing = useMemo(
    () =>
      calculateOrderPricing({
        items: lineItems,
        fulfillmentType,
        deliveryFee: settings.deliveryFee,
        freeDeliveryThreshold: settings.freeDeliveryThreshold,
        rewardDiscount: chosenReward ? chosenReward.discountValue : 0,
        pointsPer100Pkr: settings.pointsPer100Pkr,
      }),
    [lineItems, fulfillmentType, settings, chosenReward]
  );

  if (lineItems.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Surface className="p-8 space-y-4">
          <h1 className="text-xl font-semibold">No items in checkout</h1>
          <p className="text-sm text-muted">Add dishes to your bag before placing an order.</p>
          <Link to="/menu">
            <Button tone="primary">Return to Menu</Button>
          </Link>
        </Surface>
      </div>
    );
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const response = await apiFetch<{
        order: Order;
        updatedPointsBalance: number | null;
      }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerAddress,
          fulfillmentType,
          paymentMethod,
          notes,
          rewardId: selectedRewardId || undefined,
          items: lineItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });

      if (user && response.updatedPointsBalance !== null) {
        updateUserProfileState({
          ...user,
          pointsBalance: response.updatedPointsBalance,
        });
      }

      setLastPlacedOrder(response.order);
      clearCart();
      navigate('/order-success');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to place order right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-[length:var(--text-title)] font-bold text-foreground">
          Checkout · آرڈر کی تکمیل
        </h1>
        <p className="mt-1 text-sm text-muted">
          Single-step confirmation · Cash on Delivery & WhatsApp receipt.
        </p>
      </div>

      {!storeStatus.isOpen ? (
        <Surface className="mt-6 border-spicy p-5">
          <p className="font-urdu text-base font-semibold text-gold">{storeStatus.closedBannerUr}</p>
          <p className="mt-1 text-xs text-muted">{storeStatus.statusLabelEn}</p>
        </Surface>
      ) : null}

      {/* One-column checkout per 1_ecommerce_retail.md Section 2 */}
      <form onSubmit={handlePlaceOrder} className="mt-6 space-y-6">
        <Surface className="p-6 space-y-5">
          <div>
            <span className="text-sm font-semibold text-foreground">
              1. Fulfillment Option · ڈیلیوری یا پک اپ
            </span>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFulfillmentType('delivery')}
                className={`min-h-11 rounded-control border px-4 py-2.5 text-sm font-medium ${
                  fulfillmentType === 'delivery'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground'
                }`}
              >
                Home Delivery · ہوم ڈیلیوری
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentType('pickup')}
                className={`min-h-11 rounded-control border px-4 py-2.5 text-sm font-medium ${
                  fulfillmentType === 'pickup'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground'
                }`}
              >
                Stall Pickup · خود لیں
              </button>
            </div>
          </div>

          <div className="space-y-4 border-t border-border/50 pt-5">
            <Field label="Full Name · آپ کا نام" htmlFor="chk-name">
              <input
                id="chk-name"
                type="text"
                autoComplete="name"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Bilal Ahmed"
                className={inputClassName}
              />
            </Field>

            <Field label="Mobile / WhatsApp Number · فون نمبر" htmlFor="chk-phone" hint="Used for delivery call">
              <input
                id="chk-phone"
                type="tel"
                autoComplete="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="03XX-XXXXXXX"
                className={inputClassName}
              />
            </Field>

            {fulfillmentType === 'delivery' ? (
              <div className="space-y-2">
                {user && user.savedAddresses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => setCustomerAddress(addr.address)}
                        className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground hover:border-gold"
                      >
                        Use {addr.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <Field label="Complete Delivery Address · مکمل پتہ" htmlFor="chk-address">
                  <textarea
                    id="chk-address"
                    rows={2}
                    autoComplete="street-address"
                    required
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="House / Flat #, Street, Block, Nearby Landmark"
                    className={inputClassName}
                  />
                </Field>
              </div>
            ) : (
              <p className="text-xs text-muted">
                Pickup Address: <strong className="text-foreground">{settings.addressEn}</strong>
              </p>
            )}

            <Field label="Kitchen / Spice Notes (Optional) · خصوصی ہدایت" htmlFor="chk-notes">
              <input
                id="chk-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Extra green raita, less chili on pasta…"
                className={inputClassName}
              />
            </Field>
          </div>

          {/* Loyalty Points Redemption */}
          {user ? (
            <div className="border-t border-border/50 pt-5 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">Redeem Loyalty Points</span>
                <span className="tabular-nums text-gold font-medium">
                  Available: {user.pointsBalance} pts
                </span>
              </div>
              <select
                value={selectedRewardId}
                onChange={(e) => setSelectedRewardId(e.target.value)}
                aria-label="Select loyalty reward to redeem"
                className={inputClassName}
              >
                <option value="">Keep saving points (No reward applied)</option>
                {rewards.map((rew) => {
                  const eligible = user.pointsBalance >= rew.pointsRequired;
                  return (
                    <option key={rew.id} value={rew.id} disabled={!eligible}>
                      {rew.titleEn} — {rew.pointsRequired} pts (-{formatPKR(rew.discountValue)})
                      {!eligible ? ' [Need more points]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : null}

          {/* Payment Method */}
          <div className="border-t border-border/50 pt-5 space-y-3">
            <span className="text-sm font-semibold text-foreground">
              Payment Method · ادائیگی کا طریقہ
            </span>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center justify-between rounded-control border border-border bg-background px-4 py-3 text-sm">
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                  />
                  <span>Cash on Delivery (COD) · نقد ادائیگی</span>
                </span>
                <span className="text-xs text-primary font-medium">Active</span>
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-control border border-border bg-background px-4 py-3 text-sm">
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'whatsapp_cod'}
                    onChange={() => setPaymentMethod('whatsapp_cod')}
                  />
                  <span>COD + Instant WhatsApp Receipt · واٹس ایپ تصدیق</span>
                </span>
                <span className="text-xs text-gold font-medium">Recommended</span>
              </label>

              <p className="text-xs text-muted pt-1">
                Online gateway slots ready for JazzCash, Easypaisa & Stripe/Razorpay integration in Store Settings.
              </p>
            </div>
          </div>
        </Surface>

        {/* Order Summary & Submit */}
        <Surface className="p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Final Bill Summary</h2>

          <div className="divide-y divide-border/50 text-sm">
            {lineItems.map((i) => (
              <div key={i.productId} className="flex justify-between py-2 tabular-nums">
                <span className="text-muted">
                  {i.quantity} × {i.nameEn}
                </span>
                <span className="text-foreground">{formatPKR(i.unitPrice * i.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-border/50 pt-3 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatPKR(pricing.subtotal)}</span>
            </div>
            {pricing.discountAmount > 0 ? (
              <div className="flex justify-between text-primary">
                <span>Loyalty Reward Discount</span>
                <span>-{formatPKR(pricing.discountAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted">
                {fulfillmentType === 'pickup' ? 'Pickup Fee' : 'Delivery Fee'}
              </span>
              <span>{pricing.deliveryFee === 0 ? 'FREE' : formatPKR(pricing.deliveryFee)}</span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-3 text-base font-bold">
              <span>Total Payable</span>
              <span className="text-gold">{formatPKR(pricing.totalAmount)}</span>
            </div>
            {user && pricing.pointsEarned > 0 ? (
              <p className="text-xs text-primary">
                You will earn +{pricing.pointsEarned} loyalty points on this order.
              </p>
            ) : null}
          </div>

          {errorMsg ? (
            <p role="alert" className="text-sm font-medium text-spicy">
              {errorMsg}
            </p>
          ) : null}

          <Button
            type="submit"
            tone="primary"
            disabled={submitting || !storeStatus.isOpen}
            className="w-full"
          >
            {submitting
              ? 'Confirming with kitchen…'
              : `Place Order · ${formatPKR(pricing.totalAmount)}`}
          </Button>
        </Surface>
      </form>
    </div>
  );
};

export const OrderSuccessPage: React.FC = () => {
  const { lastPlacedOrder, settings } = useStore();

  if (!lastPlacedOrder) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Surface className="p-8 space-y-4">
          <h1 className="text-xl font-semibold">No recent order on this device</h1>
          <Link to="/orders">
            <Button tone="primary">View Order History</Button>
          </Link>
        </Surface>
      </div>
    );
  }

  const waLines = [
    `Assalam-o-Alaikum *${settings.brandName}*!`,
    `Order ID: *${lastPlacedOrder.orderNumber}*`,
    `Name: ${lastPlacedOrder.customerName}`,
    `Phone: ${lastPlacedOrder.customerPhone}`,
    `Type: ${lastPlacedOrder.fulfillmentType.toUpperCase()}`,
    `Address: ${lastPlacedOrder.customerAddress}`,
    `Items:`,
    ...lastPlacedOrder.items.map(
      (i) => `- ${i.quantity}x ${i.productNameEn} (${formatPKR(i.lineTotal)})`
    ),
    `Total Payable: *${formatPKR(lastPlacedOrder.totalAmount)}* (Cash on Delivery)`,
  ].join('\n');

  const whatsappUrl = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(waLines)}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Surface className="p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3.5">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold text-primary">Order Confirmed · آرڈر موصول ہو گیا</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              Thank you, {lastPlacedOrder.customerName}!
            </h1>
            <p className="mt-1 text-sm text-muted">
              Order ID:{' '}
              <strong className="font-mono text-base text-gold">
                {lastPlacedOrder.orderNumber}
              </strong>{' '}
              · Live Status: <strong className="text-foreground">{lastPlacedOrder.status}</strong>
            </p>
          </div>
        </div>

        <div className="divide-y divide-border/50 border-t border-b border-border/50 py-3 text-sm">
          {lastPlacedOrder.items.map((item) => (
            <div key={item.id} className="flex justify-between py-2.5 tabular-nums">
              <span>
                {item.quantity} × {item.productNameEn}{' '}
                <span className="font-urdu text-muted">({item.productNameUr})</span>
              </span>
              <span className="font-medium">{formatPKR(item.lineTotal)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-3 text-base font-bold tabular-nums">
            <span>Total ({lastPlacedOrder.fulfillmentType})</span>
            <span className="text-gold">{formatPKR(lastPlacedOrder.totalAmount)}</span>
          </div>
        </div>

        {lastPlacedOrder.pointsEarned > 0 ? (
          <p className="text-xs font-medium text-primary">
            +{lastPlacedOrder.pointsEarned} loyalty reward points credited to your profile!
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-95"
          >
            Send Order Confirmation on WhatsApp
          </a>
          <Link to="/orders">
            <Button tone="quiet">Track Order Status</Button>
          </Link>
        </div>
      </Surface>
    </div>
  );
};
