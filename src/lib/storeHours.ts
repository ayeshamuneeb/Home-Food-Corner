import type { OpeningHour, StoreSettings } from '../types';

const pkrFormatter = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: 'PKR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatPKR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return pkrFormatter.format(safe).replace('PKR', 'Rs.');
}

export function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export interface StoreOpenEvaluation {
  isOpen: boolean;
  karachiTimeLabel: string;
  nextOpeningLabel: string;
  statusLabelEn: string;
  statusLabelUr: string;
  closedBannerUr: string;
}

/**
 * Pure evaluation of Home Food Corner open/close state in Asia/Karachi timezone.
 * Handles overnight ranges (e.g. 19:00 -> 02:00), 24/7 mode, 1-hour flash open window, and temporary closure.
 */
export function evaluateStoreOpenStatus(
  settings: StoreSettings,
  openingHours: OpeningHour[],
  now: Date = new Date()
): StoreOpenEvaluation {
  const tz = settings.timezone || 'Asia/Karachi';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const rawHour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const rawMinute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const currentDay = weekdayMap[weekdayStr] ?? 1;
  const currentMinutes = rawHour * 60 + rawMinute;

  const karachiTimeLabel = formatTime12h(
    `${String(rawHour).padStart(2, '0')}:${String(rawMinute).padStart(2, '0')}`
  );

  const findNextOpeningText = (): string => {
    for (let offset = 0; offset < 7; offset++) {
      const idx = (currentDay + offset) % 7;
      const entry = openingHours.find((h) => h.dayOfWeek === idx);
      if (entry && !entry.isClosed) {
        const label = formatTime12h(entry.openTime);
        return offset === 0 ? label : `${entry.dayNameEn} ${label}`;
      }
    }
    return '7:00 PM';
  };

  if (settings.timingMode === 'force_open_24h') {
    return {
      isOpen: true,
      karachiTimeLabel,
      nextOpeningLabel: '24/7',
      statusLabelEn: 'Open 24/7 · Accepting Orders',
      statusLabelUr: '24 گھنٹے کھلا ہے · آرڈر جاری ہیں',
      closedBannerUr: '',
    };
  }

  if (settings.timingMode === 'force_closed') {
    const nextOpen = findNextOpeningText();
    return {
      isOpen: false,
      karachiTimeLabel,
      nextOpeningLabel: nextOpen,
      statusLabelEn: `Temporarily Closed · Opens ${nextOpen}`,
      statusLabelUr: `ابھی آرڈرز بند ہیں، افتتاحی وقت: ${nextOpen}`,
      closedBannerUr: `ابھی آرڈرز بند ہیں، افتتاحی وقت: ${nextOpen}`,
    };
  }

  if (settings.timingMode === 'one_hour_window') {
    const untilMs = settings.oneHourOpensUntil ? Date.parse(settings.oneHourOpensUntil) : 0;
    if (untilMs > now.getTime()) {
      const minsLeft = Math.max(1, Math.ceil((untilMs - now.getTime()) / 60000));
      return {
        isOpen: true,
        karachiTimeLabel,
        nextOpeningLabel: `${minsLeft} min left`,
        statusLabelEn: `Special Window Open (${minsLeft}m left)`,
        statusLabelUr: `خصوصی وقت کے لیے کھلا ہے (${minsLeft} منٹ باقی)`,
        closedBannerUr: '',
      };
    }
    const nextOpen = findNextOpeningText();
    return {
      isOpen: false,
      karachiTimeLabel,
      nextOpeningLabel: nextOpen,
      statusLabelEn: `Special Window Ended · Opens ${nextOpen}`,
      statusLabelUr: `ابھی آرڈرز بند ہیں، افتتاحی وقت: ${nextOpen}`,
      closedBannerUr: `ابھی آرڈرز بند ہیں، افتتاحی وقت: ${nextOpen}`,
    };
  }

  // Scheduled mode — check yesterday's overnight spill first, then today's window
  const parseMins = (t: string): number => {
    const [hh, mm] = t.split(':').map(Number);
    return (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
  };

  const prevDay = (currentDay + 6) % 7;
  const prevEntry = openingHours.find((h) => h.dayOfWeek === prevDay);
  if (prevEntry && !prevEntry.isClosed) {
    const pOpen = parseMins(prevEntry.openTime);
    const pClose = parseMins(prevEntry.closeTime);
    // Overnight schedule (e.g. 19:00 -> 00:00 or 12:00 -> 03:00)
    if (pClose <= pOpen && currentMinutes < pClose) {
      return {
        isOpen: true,
        karachiTimeLabel,
        nextOpeningLabel: formatTime12h(prevEntry.closeTime),
        statusLabelEn: `Open Now · Until ${formatTime12h(prevEntry.closeTime)} PKT`,
        statusLabelUr: `ابھی کھلا ہے · رات ${formatTime12h(prevEntry.closeTime)} تک`,
        closedBannerUr: '',
      };
    }
  }

  const todayEntry = openingHours.find((h) => h.dayOfWeek === currentDay);
  if (todayEntry && !todayEntry.isClosed) {
    const tOpen = parseMins(todayEntry.openTime);
    const tClose = parseMins(todayEntry.closeTime);
    const isOvernight = tClose <= tOpen;
    const withinToday = isOvernight
      ? currentMinutes >= tOpen
      : currentMinutes >= tOpen && currentMinutes < tClose;

    if (withinToday) {
      return {
        isOpen: true,
        karachiTimeLabel,
        nextOpeningLabel: formatTime12h(todayEntry.closeTime),
        statusLabelEn: `Open Now · ${formatTime12h(todayEntry.openTime)} – ${formatTime12h(todayEntry.closeTime)} PKT`,
        statusLabelUr: `ابھی کھلا ہے · ${formatTime12h(todayEntry.closeTime)} تک`,
        closedBannerUr: '',
      };
    }
  }

  const nextOpen = findNextOpeningText();
  return {
    isOpen: false,
    karachiTimeLabel,
    nextOpeningLabel: nextOpen,
    statusLabelEn: `Closed · Opens at ${nextOpen} PKT`,
    statusLabelUr: `ابھی آرڈرز بند ہیں، افتتاحی وقت: ${nextOpen}`,
    closedBannerUr: `ابھی آرڈرز بند ہیں، افتتاحی وقت: ${nextOpen}`,
  };
}

export function calculateOrderPricing(params: {
  items: { unitPrice: number; quantity: number }[];
  fulfillmentType: 'delivery' | 'pickup';
  deliveryFee: number;
  freeDeliveryThreshold: number;
  rewardDiscount: number;
  pointsPer100Pkr: number;
}) {
  const subtotal = params.items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice) * Math.max(0, Math.floor(item.quantity)),
    0
  );
  const appliedDelivery =
    params.fulfillmentType === 'pickup' || subtotal >= params.freeDeliveryThreshold
      ? 0
      : Math.round(params.deliveryFee);
  const discountAmount = Math.min(subtotal, Math.max(0, Math.round(params.rewardDiscount)));
  const totalAmount = Math.max(0, subtotal - discountAmount + appliedDelivery);
  const pointsEarned = Math.floor(((subtotal - discountAmount) / 100) * params.pointsPer100Pkr);

  return {
    subtotal,
    deliveryFee: appliedDelivery,
    discountAmount,
    totalAmount,
    pointsEarned,
  };
}

// Known hand-worked verification & invariant:
// Case: 2 x Rs. 450 Tikka (900) + 1 x Rs. 120 Chai (120) = Rs. 1,020 subtotal.
// Delivery (< Rs. 1,500 threshold) = Rs. 120; Reward discount = Rs. 100 -> Total = 1020 - 100 + 120 = Rs. 1,040;
// Points at 10 pts / 100 PKR on net food (920) = 92 pts.
// Invariant: subtotal - discountAmount + deliveryFee === totalAmount (when subtotal >= discountAmount).
