import React, { Component, type ComponentProps, type ErrorInfo, type ReactNode, useState } from 'react';
import type { AccentTone, Product, SpicyLevel } from '../types';

export const Surface = ({
  inset = false,
  className = '',
  ...props
}: ComponentProps<'div'> & { inset?: boolean }) => (
  <div
    className={`min-w-0 [:where(&)]:rounded-card [:where(&)]:border [:where(&)]:border-border/70 [:where(&)]:text-foreground ${
      inset ? '[:where(&)]:bg-background' : '[:where(&)]:bg-surface [:where(&)]:shadow-surface'
    } ${className}`}
    {...props}
  />
);

const buttonTones = {
  primary: '[:where(&)]:bg-primary [:where(&)]:text-primary-foreground',
  gold: '[:where(&)]:bg-gold [:where(&)]:text-gold-foreground',
  spicy: '[:where(&)]:bg-spicy [:where(&)]:text-spicy-foreground',
  quiet: '[:where(&)]:border [:where(&)]:border-border [:where(&)]:bg-surface [:where(&)]:text-foreground',
  ghost: '[:where(&)]:bg-transparent [:where(&)]:text-muted hover:[:where(&)]:text-foreground',
};

export const Button = ({
  tone = 'primary',
  type = 'button',
  className = '',
  ...props
}: ComponentProps<'button'> & { tone?: keyof typeof buttonTones }) => (
  <button
    type={type}
    className={`[:where(&)]:inline-flex [:where(&)]:min-h-11 [:where(&)]:items-center [:where(&)]:justify-center [:where(&)]:gap-2 whitespace-nowrap [:where(&)]:rounded-control [:where(&)]:px-4 [:where(&)]:text-sm [:where(&)]:font-medium transition-[transform,opacity,background-color,color] duration-150 ease-out hover:brightness-95 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${buttonTones[tone]} ${className}`}
    {...props}
  />
);

export const Field = ({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
    {children}
    {error ? (
      <p role="alert" className="text-xs font-medium text-spicy">
        {error}
      </p>
    ) : null}
  </div>
);

export const inputClassName =
  'min-h-11 w-full min-w-0 rounded-control border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:opacity-50';

export const BrandLogo = ({
  size = 40,
  customUrl,
}: {
  size?: number;
  customUrl?: string;
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const src = customUrl && customUrl !== '/icon.svg' ? customUrl : '/logo-transparent.png';

  if (!imgFailed) {
    return (
      <img
        src={src}
        alt="Home Food Corner logo"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      aria-label="Home Food Corner emblem"
      className="shrink-0"
    >
      <rect width="128" height="128" rx="26" fill="#141111" stroke="#FACC15" strokeOpacity="0.38" strokeWidth="3" />
      <path d="M22 38C22 33.5817 25.5817 30 30 30H98C102.418 30 106 33.5817 106 38V45H22V38Z" fill="#DC2626" />
      <path d="M22 45H38.8C38.8 49.4 35 53 30.4 53C25.8 53 22 49.4 22 45Z" fill="#FACC15" />
      <path d="M38.8 45H55.6C55.6 49.4 51.8 53 47.2 53C42.6 53 38.8 49.4 38.8 45Z" fill="#DC2626" />
      <path d="M55.6 45H72.4C72.4 49.4 68.6 53 64 53C59.4 53 55.6 49.4 55.6 45Z" fill="#FACC15" />
      <path d="M72.4 45H89.2C89.2 49.4 85.4 53 80.8 53C76.2 53 72.4 49.4 72.4 45Z" fill="#DC2626" />
      <path d="M89.2 45H106C106 49.4 102.2 53 97.6 53C93 53 89.2 49.4 89.2 45Z" fill="#FACC15" />
      <path d="M50 24C50 20 53 18 53 14" stroke="#FACC15" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M64 23C64 19 67 17 67 13" stroke="#16A34A" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M78 24C78 20 81 18 81 14" stroke="#FACC15" strokeWidth="3.5" strokeLinecap="round" />
      <text
        x="64"
        y="83"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Figtree, sans-serif"
        fontWeight="700"
        fontSize="30"
        letterSpacing="1.5"
      >
        HFC
      </text>
      <path d="M34 94H94C90.5 103.5 78.5 109.5 64 109.5C49.5 109.5 37.5 103.5 34 94Z" fill="#16A34A" />
    </svg>
  );
};

const accentThemes: Record<
  AccentTone,
  { bgClass: string; strokeHex: string; plateFill: string; labelText: string; textClass: string }
> = {
  cream: {
    bgClass: 'bg-[#26231d]',
    strokeHex: '#FDE68A',
    plateFill: '#F5F0E1',
    labelText: 'Creamy Signature',
    textClass: 'text-[#FDE68A]',
  },
  spicy_red: {
    bgClass: 'bg-[#2a1212]',
    strokeHex: '#EF4444',
    plateFill: '#7F1D1D',
    labelText: 'Fiery Chili',
    textClass: 'text-spicy',
  },
  golden: {
    bgClass: 'bg-[#261e0f]',
    strokeHex: '#FACC15',
    plateFill: '#854D0E',
    labelText: 'Golden Stall Classic',
    textClass: 'text-gold',
  },
  cool_fresh: {
    bgClass: 'bg-[#0f2419]',
    strokeHex: '#22C55E',
    plateFill: '#14532D',
    labelText: 'Chilled & Fresh',
    textClass: 'text-primary',
  },
  ember: {
    bgClass: 'bg-[#241311]',
    strokeHex: '#F97316',
    plateFill: '#7C2D12',
    labelText: 'Live Coal & Tawa',
    textClass: 'text-[#FB923C]',
  },
};

export const SpicyLabel = ({ level }: { level: SpicyLevel }) => {
  const map: Record<SpicyLevel, { text: string; ur: string; cls: string }> = {
    none: { text: 'Cool / Non-Spicy', ur: 'بغیر مرچ', cls: 'text-primary' },
    mild: { text: 'Mild', ur: 'ہلکا مصالحہ', cls: 'text-muted' },
    medium: { text: 'Medium', ur: 'درمیانہ چٹپٹا', cls: 'text-gold' },
    hot: { text: 'Hot Spicy', ur: 'تیز مرچ', cls: 'text-spicy' },
    extra_hot: { text: 'Extra Fiery', ur: 'فل اسپائسی', cls: 'text-spicy font-semibold' },
  };
  const info = map[level] || map.medium;
  return (
    <span className={`text-xs ${info.cls}`}>
      {info.text} · <span className="font-urdu">{info.ur}</span>
    </span>
  );
};

export const ProductVisual = ({
  product,
  aspectClass = 'aspect-[4/3]',
}: {
  product: Product;
  aspectClass?: string;
}) => {
  const [failed, setFailed] = useState(false);
  const accent = accentThemes[product.accentTone] || accentThemes.golden;

  if (product.imageUrl && !failed) {
    return (
      <div className={`relative w-full overflow-hidden ${aspectClass} ${accent.bgClass}`}>
        <img
          src={product.imageUrl}
          alt={`${product.nameEn} — ${product.nameUr}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
        />
      </div>
    );
  }

  // Type-led culinary plate art with distinct per-product tone so no photo is ever duplicated
  return (
    <div
      className={`relative flex w-full flex-col justify-between overflow-hidden p-4 ${aspectClass} ${accent.bgClass}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={`font-medium ${accent.textClass}`}>{accent.labelText}</span>
        <span className="font-urdu text-muted">{product.categorySlug === 'drinks' ? 'تازہ مشروب' : product.categorySlug === 'dinner' ? 'خاص ڈنر' : 'تازہ تیار'}</span>
      </div>

      <div className="my-auto flex items-center justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="font-urdu text-lg font-semibold leading-relaxed text-foreground">
            {product.nameUr}
          </p>
          <p className="mt-0.5 text-xs text-muted line-clamp-1">{product.nameEn}</p>
        </div>

        <svg
          width="54"
          height="54"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          className="shrink-0 opacity-90"
        >
          <circle cx="32" cy="34" r="22" fill={accent.plateFill} fillOpacity="0.35" stroke={accent.strokeHex} strokeWidth="2" />
          <circle cx="32" cy="34" r="14" stroke={accent.strokeHex} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="4 3" />
          {product.categorySlug === 'drinks' ? (
            <path d="M24 22H40L37 46H27L24 22Z" stroke={accent.strokeHex} strokeWidth="2" strokeLinejoin="round" />
          ) : (
            <>
              <path d="M25 14C25 11 28 10 28 7" stroke={accent.strokeHex} strokeWidth="2" strokeLinecap="round" />
              <path d="M33 13C33 10 36 9 36 6" stroke={accent.strokeHex} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between border-t border-foreground/10 pt-2 text-xs text-muted">
        <SpicyLabel level={product.spicyLevel} />
        {!product.isAvailable || product.stockQty <= 0 ? (
          <span className="font-medium text-spicy">Sold out · ختم شد</span>
        ) : null}
      </div>
    </div>
  );
};

export const StarRatingText = ({ rating, count }: { rating: number; count: number }) => {
  if (count <= 0) {
    return <span className="text-xs text-muted">New on menu · نیا آئٹم</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs tabular-nums text-foreground">
      <span className="text-gold" aria-hidden="true">★</span>
      <span className="font-medium">{rating.toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
};

export const KarachiLocatorMap = ({ addressEn }: { addressEn: string }) => (
  <svg
    viewBox="0 0 640 280"
    className="h-auto w-full max-w-2xl rounded-card border border-border/70 bg-[#121614]"
    role="img"
    aria-label={`Street map showing Home Food Corner at ${addressEn}`}
  >
    {/* Neighbourhood blocks */}
    <rect x="24" y="22" width="175" height="92" rx="8" fill="#1A201D" />
    <rect x="235" y="22" width="185" height="92" rx="8" fill="#1A201D" />
    <rect x="456" y="22" width="160" height="92" rx="8" fill="#1A201D" />
    <rect x="24" y="154" width="175" height="104" rx="8" fill="#1A201D" />
    <rect x="235" y="154" width="185" height="104" rx="8" fill="#1E2822" stroke="#16A34A" strokeOpacity="0.45" />
    <rect x="456" y="154" width="160" height="104" rx="8" fill="#1A201D" />

    {/* Arterial roads */}
    <line x1="0" y1="134" x2="640" y2="134" stroke="#334139" strokeWidth="18" />
    <line x1="217" y1="0" x2="217" y2="280" stroke="#2B3630" strokeWidth="14" />
    <line x1="438" y1="0" x2="438" y2="280" stroke="#2B3630" strokeWidth="14" />
    <line x1="0" y1="134" x2="640" y2="134" stroke="#FACC15" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="8 8" />

    {/* Stall Marker Pin */}
    <circle cx="328" cy="198" r="16" fill="#16A34A" fillOpacity="0.25" />
    <circle cx="328" cy="198" r="8" fill="#FACC15" stroke="#0B0B0B" strokeWidth="2.5" />

    {/* Explicit x/y labels with cartographic halo */}
    <text
      x="110"
      y="72"
      textAnchor="middle"
      fill="#B0A9A2"
      fontSize="12"
      style={{ paintOrder: 'stroke', stroke: '#121614', strokeWidth: '4px', strokeLinejoin: 'round' }}
    >
      Block B Park
    </text>
    <text
      x="536"
      y="72"
      textAnchor="middle"
      fill="#B0A9A2"
      fontSize="12"
      style={{ paintOrder: 'stroke', stroke: '#121614', strokeWidth: '4px', strokeLinejoin: 'round' }}
    >
      Maskaan Link Rd
    </text>
    <text
      x="98"
      y="128"
      fill="#E5E0D8"
      fontSize="11"
      fontWeight="600"
      style={{ paintOrder: 'stroke', stroke: '#121614', strokeWidth: '4px', strokeLinejoin: 'round' }}
    >
      Main Rashid Minhas Service Lane
    </text>
    <text
      x="328"
      y="228"
      textAnchor="middle"
      fill="#FACC15"
      fontSize="13"
      fontWeight="700"
      style={{ paintOrder: 'stroke', stroke: '#121614', strokeWidth: '5px', strokeLinejoin: 'round' }}
    >
      Home Food Corner (Stall 4, Block C)
    </text>
    <text
      x="328"
      y="246"
      textAnchor="middle"
      fill="#D6D1C9"
      fontSize="11"
      style={{ paintOrder: 'stroke', stroke: '#121614', strokeWidth: '4px', strokeLinejoin: 'round' }}
    >
      Gulshan-e-Iqbal · Karachi
    </text>
  </svg>
);

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected display error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
          <Surface className="max-w-md p-6">
            <div role="alert" className="space-y-4">
              <h1 className="text-xl font-semibold">Something interrupted this screen</h1>
              <p className="text-sm text-muted">{this.state.message}</p>
              <Button
                tone="primary"
                onClick={() => {
                  this.setState({ hasError: false, message: '' });
                  window.location.assign('/');
                }}
              >
                Reload Home Food Corner
              </Button>
            </div>
          </Surface>
        </div>
      );
    }
    return this.props.children;
  }
}
