import React from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatPKR } from '../lib/storeHours';
import type { Product } from '../types';
import { Button, ProductVisual, SpicyLabel, StarRatingText, Surface } from './ui';

export const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const { cart, addToCart, updateCartQty, storeStatus } = useStore();
  const inCart = cart.find((c) => c.productId === product.id);
  const qtyInCart = inCart?.quantity ?? 0;
  const soldOut = !product.isAvailable || product.stockQty <= 0;
  const effectivePrice = product.discountPrice !== null ? product.discountPrice : product.price;

  return (
    <Surface className="group flex h-full flex-col overflow-hidden">
      <Link to={`/product/${product.slug}`} className="block focus-visible:outline-2 focus-visible:outline-primary">
        <ProductVisual product={product} aspectClass="aspect-[4/3]" />
      </Link>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {/* Scoped Convention: product category label above product name */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span className="uppercase tracking-wider">
              {product.categorySlug}
              {product.isDailyDeal ? <span className="text-gold"> · Daily Deal</span> : null}
            </span>
            <StarRatingText rating={product.averageRating} count={product.reviewCount} />
          </div>

          <Link
            to={`/product/${product.slug}`}
            className="mt-1.5 block focus-visible:outline-2 focus-visible:outline-primary"
          >
            <h3 className="text-base font-semibold text-foreground group-hover:text-gold">
              {product.nameEn}
            </h3>
            <p className="font-urdu mt-0.5 text-sm text-muted">{product.nameUr}</p>
          </Link>

          <p className="mt-2 text-xs text-muted line-clamp-2">{product.descriptionEn}</p>
        </div>

        <div className="mt-4 border-t border-border/50 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-base font-semibold text-foreground">{formatPKR(effectivePrice)}</span>
              {product.discountPrice !== null ? (
                <span className="text-xs text-muted line-through">{formatPKR(product.price)}</span>
              ) : null}
            </div>
            <SpicyLabel level={product.spicyLevel} />
          </div>

          <div className="mt-3">
            {soldOut ? (
              <Button tone="quiet" disabled className="w-full">
                Sold out · ختم شد
              </Button>
            ) : !storeStatus.isOpen ? (
              <Button tone="quiet" disabled className="w-full" title={storeStatus.closedBannerUr}>
                Store Closed · بند ہے
              </Button>
            ) : qtyInCart > 0 ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  tone="quiet"
                  onClick={() => updateCartQty(product.id, qtyInCart - 1)}
                  aria-label={`Decrease quantity of ${product.nameEn}`}
                  className="px-3"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {qtyInCart} in cart
                </span>
                <Button
                  tone="primary"
                  onClick={() => updateCartQty(product.id, qtyInCart + 1)}
                  disabled={qtyInCart >= product.stockQty}
                  aria-label={`Increase quantity of ${product.nameEn}`}
                  className="px-3"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                tone="primary"
                onClick={() => addToCart(product.id, 1)}
                className="w-full"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Add · آرڈر میں شامل کریں</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Surface>
  );
};
