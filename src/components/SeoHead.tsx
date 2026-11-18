import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

function upsertMeta(selector: string, attrName: 'name' | 'property', attrVal: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLd(data: Record<string, unknown>) {
  const scriptId = 'hfc-dynamic-jsonld';
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export const SeoHead: React.FC = () => {
  const { pathname } = useLocation();
  const { settings, products, categories, openingHours } = useStore();

  useEffect(() => {
    try {
      const brand = settings.brandName || 'Home Food Corner';
      const origin = window.location.origin;
      const canonicalUrl = `${origin}${pathname}`;

      let title = `${brand} – Fresh Pakistani Street Food, BBQ & Chai`;
      let description =
        'Order fresh Chicken Tikka, Loaded Drum, Creamy Pasta, Karak Chai & family dinners from Home Food Corner with live tracking and loyalty rewards.';
      let socialImage = `${origin}/og-image.png`;
      let jsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: brand,
        description,
        url: origin,
        image: socialImage,
        logo: `${origin}/logo-transparent.png`,
        telephone: settings.contactPhone,
        servesCuisine: ['Pakistani', 'Street Food', 'BBQ', 'Fast Food'],
        priceRange: 'PKR 80 - 2500',
        address: {
          '@type': 'PostalAddress',
          streetAddress: settings.addressEn,
          addressLocality: 'Karachi',
          addressCountry: 'PK',
        },
        openingHours: openingHours
          .filter((h) => !h.isClosed)
          .map((h) => `${h.dayNameEn.slice(0, 2)} ${h.openTime}-${h.closeTime}`),
      };

      if (pathname.startsWith('/product/')) {
        const slug = pathname.replace('/product/', '').split('/')[0];
        const prod = products.find((p) => p.slug === slug);
        if (prod) {
          title = prod.seoTitle || `${prod.nameEn} (${prod.nameUr}) – ${brand}`;
          description =
            prod.seoDescription ||
            `${prod.descriptionEn} Freshly prepared at ${brand}. Price Rs. ${prod.discountPrice ?? prod.price}.`;
          const effectivePrice = prod.discountPrice !== null ? prod.discountPrice : prod.price;
          const prodImg = prod.imageUrl
            ? prod.imageUrl.startsWith('http')
              ? prod.imageUrl
              : `${origin}${prod.imageUrl}`
            : `${origin}/og-image.png`;
          socialImage = prodImg;
          jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: prod.nameEn,
            alternateName: prod.nameUr,
            description,
            image: prodImg,
            brand: { '@type': 'Brand', name: brand },
            offers: {
              '@type': 'Offer',
              url: canonicalUrl,
              priceCurrency: 'PKR',
              price: String(effectivePrice),
              availability:
                prod.isAvailable && prod.stockQty > 0
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
            },
            ...(prod.reviewCount > 0
              ? {
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: String(prod.averageRating),
                    reviewCount: String(prod.reviewCount),
                  },
                }
              : {}),
          };
        }
      } else if (pathname.startsWith('/category/')) {
        const slug = pathname.replace('/category/', '').split('/')[0];
        const cat = categories.find((c) => c.slug === slug);
        if (cat) {
          title = `${cat.nameEn} Menu (${cat.nameUr}) – ${brand}`;
          description = `${cat.descriptionEn} Order fresh ${cat.nameEn.toLowerCase()} online from ${brand}.`;
        }
      } else if (pathname === '/menu') {
        title = `Full Menu & Daily Deals – ${brand}`;
        description = `Browse all ${products.length} fresh dishes, cold drinks, karak chai, and dinner deals at ${brand}.`;
      } else if (pathname === '/rewards') {
        title = `Loyalty Points & Free Rewards – ${brand}`;
        description = `Earn ${settings.pointsPer100Pkr} points per Rs. 100 spent at ${brand} and unlock free drinks, fries, and family discounts.`;
      } else if (pathname === '/reviews') {
        title = `Customer Reviews & Ratings – ${brand}`;
        description = `Read verified neighbourhood reviews and ratings for ${brand} dishes in Karachi.`;
      } else if (pathname === '/orders') {
        title = `Live Order Tracking – ${brand}`;
        description = `Track your ${brand} order live from kitchen preparation to doorstep delivery.`;
      } else if (pathname === '/policies') {
        title = `Delivery, Hygiene & Refund Policies – ${brand}`;
        description = `Read delivery zones, freshness guarantee, hygiene standards, and refund policies for ${brand}.`;
      } else if (pathname === '/contact') {
        title = `Contact & Stall Location – ${brand}`;
        description = `Visit ${brand} at ${settings.addressEn} or call ${settings.contactPhone}.`;
      } else if (pathname.startsWith('/admin')) {
        title = `Management Console – ${brand}`;
      }

      document.title = title;
      upsertMeta('meta[name="description"]', 'name', 'description', description);
      upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
      upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
      upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', socialImage);
      upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
      upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', socialImage);
      upsertCanonical(canonicalUrl);
      upsertJsonLd(jsonLd);
    } catch {
      // Ignore head metadata errors in restricted environments
    }
  }, [pathname, settings, products, categories, openingHours]);

  return null;
};
