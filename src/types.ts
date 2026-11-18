export type UserRole = 'customer' | 'admin';

export type SpicyLevel = 'none' | 'mild' | 'medium' | 'hot' | 'extra_hot';

export type AccentTone = 'cream' | 'spicy_red' | 'golden' | 'cool_fresh' | 'ember';

export type OrderStatus =
  | 'New'
  | 'Accepted'
  | 'Preparing'
  | 'Ready'
  | 'Out for delivery'
  | 'Completed'
  | 'Cancelled';

export type TimingMode =
  | 'scheduled'
  | 'force_open_24h'
  | 'force_closed'
  | 'one_hour_window';

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  landmark?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  pointsBalance: number;
  savedAddresses: SavedAddress[];
  twoFactorEnabled?: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameUr: string;
  descriptionEn: string;
  descriptionUr: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  categorySlug: string;
  slug: string;
  nameEn: string;
  nameUr: string;
  descriptionEn: string;
  descriptionUr: string;
  price: number;
  discountPrice: number | null;
  spicyLevel: SpicyLevel;
  accentTone: AccentTone;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  isDailyDeal: boolean;
  stockQty: number;
  lowStockThreshold: number;
  autoDisableOnZero: boolean;
  seoTitle: string;
  seoDescription: string;
  averageRating: number;
  reviewCount: number;
}

export interface StockHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  previousQty: number;
  newQty: number;
  reason: string;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productNameEn: string;
  productNameUr: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  note?: string;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  fulfillmentType: 'delivery' | 'pickup';
  paymentMethod: 'cod' | 'whatsapp_cod' | 'jazzcash_placeholder' | 'easypaisa_placeholder' | 'card_placeholder';
  notes: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  pointsEarned: number;
  pointsRedeemed: number;
  rewardIdUsed?: string | null;
  status: OrderStatus;
  cancelReason?: string;
  statusHistory: OrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  recipientRole: 'admin' | 'customer' | 'broadcast';
  recipientUserId: string | null;
  orderId: string | null;
  orderNumber?: string;
  customerName?: string;
  itemsSummary?: string;
  totalAmount?: number;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string | null;
  productNameEn?: string;
  userId: string;
  customerName: string;
  rating: number;
  comment: string;
  adminReply?: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RewardOffer {
  id: string;
  titleEn: string;
  titleUr: string;
  descriptionEn: string;
  descriptionUr: string;
  pointsRequired: number;
  discountValue: number;
  rewardType: 'free_item' | 'flat_discount';
  isActive: boolean;
}

export interface RewardTransaction {
  id: string;
  userId: string;
  orderId: string | null;
  pointsDelta: number;
  description: string;
  createdAt: string;
}

export interface PromoOffer {
  id: string;
  titleEn: string;
  titleUr: string;
  subtitleEn: string;
  subtitleUr: string;
  discountPercent: number;
  code: string;
  imageUrl?: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export interface PolicyItem {
  slug: string;
  titleEn: string;
  titleUr: string;
  contentEn: string;
  contentUr: string;
  updatedAt: string;
}

export interface SocialLink {
  id: string;
  platform: 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'whatsapp' | 'tiktok' | 'twitter' | 'custom';
  label: string;
  url: string;
  isActive: boolean;
  sortOrder: number;
}

export interface OpeningHour {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  dayNameEn: string;
  dayNameUr: string;
  openTime: string; // HH:mm (24h in Asia/Karachi)
  closeTime: string; // HH:mm (24h in Asia/Karachi)
  isClosed: boolean;
}

export interface StoreSettings {
  brandName: string;
  logoUrl: string;
  faviconUrl?: string;
  taglineEn: string;
  taglineUr: string;
  primaryGreen: string;
  primaryYellow: string;
  accentRed: string;
  contactPhone: string;
  whatsappNumber: string;
  addressEn: string;
  addressUr: string;
  mapsUrl: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  pointsPer100Pkr: number;
  timezone: string;
  timingMode: TimingMode;
  oneHourOpensUntil: string | null;
  aiEnabled: boolean;
  aiPersonality: string;
  aiInstructions: string;
  aiKnowledgeNote: string;
  aiLanguage: 'bilingual' | 'urdu' | 'english';
}

export interface AdminLog {
  id: string;
  adminEmail: string;
  action: string;
  entity: string;
  details: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface BootstrapPayload {
  settings: StoreSettings;
  openingHours: OpeningHour[];
  categories: Category[];
  products: Product[];
  offers: PromoOffer[];
  rewards: RewardOffer[];
  reviews: Review[];
  policies: PolicyItem[];
  socialLinks: SocialLink[];
}

export type RealtimeEvent =
  | { type: 'order:created'; order: Order }
  | { type: 'order:updated'; order: Order }
  | { type: 'notification:created'; notification: AppNotification }
  | { type: 'catalogue:updated' }
  | { type: 'settings:updated'; settings: StoreSettings; openingHours: OpeningHour[] };

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId: string | null;
  role: 'guest' | 'customer' | 'admin';
  userAgent: string;
  createdAt: string;
  updatedAt: string;
}

export interface RealtimeClientConfig {
  supabaseEnabled: boolean;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  vapidPublicKey: string;
  realtimeMode: 'supabase_and_ws' | 'ws';
}
