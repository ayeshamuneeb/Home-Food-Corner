import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { Button, inputClassName, Surface } from '../components/ui';
import { useStore } from '../context/StoreContext';

export const MenuPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, products, loading } = useStore();

  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [spiceFilter, setSpiceFilter] = useState<'all' | 'deals' | 'mild' | 'spicy'>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating'>('featured');

  const activeCategory = useMemo(
    () => (slug ? categories.find((c) => c.slug === slug) : undefined),
    [slug, categories]
  );

  const filteredProducts = useMemo(() => {
    const q = (searchParams.get('q') || query).trim().toLowerCase();

    return products
      .filter((p) => {
        if (slug && p.categorySlug !== slug) return false;
        if (spiceFilter === 'deals' && !p.isDailyDeal && p.discountPrice === null) return false;
        if (spiceFilter === 'mild' && !['none', 'mild'].includes(p.spicyLevel)) return false;
        if (spiceFilter === 'spicy' && !['hot', 'extra_hot'].includes(p.spicyLevel)) return false;
        if (q) {
          const hay = `${p.nameEn} ${p.nameUr} ${p.descriptionEn} ${p.descriptionUr} ${p.categorySlug}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = a.discountPrice ?? a.price;
        const priceB = b.discountPrice ?? b.price;
        if (sortBy === 'price_asc') return priceA - priceB;
        if (sortBy === 'price_desc') return priceB - priceA;
        if (sortBy === 'rating') return b.averageRating - a.averageRating;
        return Number(b.isFeatured) - Number(a.isFeatured);
      });
  }, [products, slug, spiceFilter, sortBy, query, searchParams]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (val.trim()) {
      setSearchParams({ q: val });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[length:var(--text-display)] font-bold text-foreground">
            {activeCategory ? activeCategory.nameEn : 'Complete Stall Menu'}
          </h1>
          <p className="font-urdu mt-1 text-lg text-gold">
            {activeCategory ? activeCategory.nameUr : 'مکمل مینو — فوڈ، ڈرنکس اور ڈنر ڈیلز'}
          </p>
          {activeCategory ? (
            <p className="mt-1 text-sm text-muted">{activeCategory.descriptionEn}</p>
          ) : null}
        </div>
        <p className="text-sm tabular-nums text-muted">
          Showing {filteredProducts.length} of {slug ? products.filter((p) => p.categorySlug === slug).length : products.length} items
        </p>
      </div>

      {/* Category & Filter Controls (wrapping flex row per frontend-design) */}
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/menu"
            className={`rounded-full border px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              !slug
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-foreground hover:border-gold/50'
            }`}
          >
            All Categories
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className={`rounded-full border px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                slug === cat.slug
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-foreground hover:border-gold/50'
              }`}
            >
              {cat.nameEn}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[210px] flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Filter dishes…"
              aria-label="Filter menu dishes"
              className={`${inputClassName} pl-9`}
            />
          </div>

          <select
            value={spiceFilter}
            onChange={(e) => setSpiceFilter(e.target.value as typeof spiceFilter)}
            aria-label="Filter by spice or deal"
            className={`${inputClassName} w-auto`}
          >
            <option value="all">All Spice Levels</option>
            <option value="deals">Daily Deals & Discounts</option>
            <option value="spicy">Hot & Extra Spicy</option>
            <option value="mild">Mild & Non-Spicy</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Sort menu items"
            className={`${inputClassName} w-auto`}
          >
            <option value="featured">Sort: Featured</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Product Grid or Skeleton / Empty State */}
      {loading ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Surface key={idx} className="h-80 animate-pulse p-4" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Surface className="mt-10 p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            No matching dishes found · کوئی آئٹم نہیں ملا
          </h2>
          <p className="mt-1 text-sm text-muted">
            Try clearing your search filter or switching to All Categories.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button
              tone="primary"
              onClick={() => {
                setQuery('');
                setSpiceFilter('all');
                setSearchParams({});
              }}
            >
              Reset Filters
            </Button>
          </div>
        </Surface>
      ) : (
        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};
