-- ============================================================================
-- Home Food Corner — Complete Production Database Schema & Supabase RLS Policies
-- Timezone: Asia/Karachi
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. roles & profiles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (name in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  points_balance integer not null default 0 check (points_balance >= 0),
  saved_addresses jsonb not null default '[]'::jsonb,
  two_factor_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. categories & products & product_images & inventory
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_en text not null,
  name_ur text not null,
  description_en text,
  description_ur text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  slug text unique not null,
  name_en text not null,
  name_ur text not null,
  description_en text not null,
  description_ur text not null,
  price integer not null check (price >= 0),
  discount_price integer check (discount_price is null or discount_price >= 0),
  spicy_level text not null default 'medium' check (spicy_level in ('none', 'mild', 'medium', 'hot', 'extra_hot')),
  accent_tone text not null default 'golden' check (accent_tone in ('cream', 'spicy_red', 'golden', 'cool_fresh', 'ember')),
  image_url text,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  is_daily_deal boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text not null,
  sort_order integer not null default 0
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid unique not null references public.products(id) on delete cascade,
  stock_qty integer not null default 50 check (stock_qty >= 0),
  low_stock_threshold integer not null default 8 check (low_stock_threshold >= 0),
  auto_disable_on_zero boolean not null default true,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3. carts & cart_items
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  session_token text,
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unique (cart_id, product_id)
);

-- 4. orders, order_items, order_status_history
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_address text,
  fulfillment_type text not null check (fulfillment_type in ('delivery', 'pickup')),
  payment_method text not null default 'cod' check (payment_method in ('cod', 'whatsapp_cod', 'jazzcash_placeholder', 'easypaisa_placeholder', 'card_placeholder')),
  notes text,
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  total_amount integer not null check (total_amount >= 0),
  points_earned integer not null default 0,
  points_redeemed integer not null default 0,
  status text not null default 'New' check (status in ('New', 'Accepted', 'Preparing', 'Ready', 'Out for delivery', 'Completed', 'Cancelled')),
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_en text not null,
  product_name_ur text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total integer not null check (line_total >= 0)
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. notifications (Supabase Realtime enabled)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_role text not null check (recipient_role in ('admin', 'customer', 'broadcast')),
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 6. reviews & ratings
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  admin_reply text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ratings (
  product_id uuid primary key references public.products(id) on delete cascade,
  average_rating numeric(3,2) not null default 0,
  review_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 7. rewards & reward_transactions
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ur text not null,
  description_en text not null,
  description_ur text not null,
  points_required integer not null check (points_required > 0),
  discount_value integer not null check (discount_value >= 0),
  reward_type text not null check (reward_type in ('free_item', 'flat_discount')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  reward_id uuid references public.rewards(id) on delete set null,
  points_delta integer not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- 8. offers & daily_deals
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_ur text not null,
  subtitle_en text not null,
  subtitle_ur text not null,
  discount_percent integer not null check (discount_percent between 0 and 100),
  code text,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_deals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  deal_price integer not null check (deal_price >= 0),
  label_en text not null,
  label_ur text not null,
  is_active boolean not null default true
);

-- 9. policies, social_links, store_settings, opening_hours
create table if not exists public.policies (
  slug text primary key,
  title_en text not null,
  title_ur text not null,
  content_en text not null,
  content_ur text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  label text not null,
  url text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  brand_name text not null default 'Home Food Corner',
  tagline_en text not null default 'Hot Tawa, Coal BBQ & Karak Chai — Made Fresh Every Evening',
  tagline_ur text not null default 'گرما گرم تکّہ، کرسپی ڈرم، کریمی پاستا اور کڑک چائے — ہر شام تازہ ذائقہ',
  contact_phone text not null default '+92 300 5550147',
  whatsapp_number text not null default '923005550147',
  address_en text not null default 'Shop 4, Block C Commercial Market, Gulshan-e-Iqbal, Karachi',
  address_ur text not null default 'دکان نمبر 4، بلاک سی کمرشل مارکیٹ، گلشنِ اقبال، کراچی',
  maps_url text not null default 'https://maps.google.com/?q=24.9207,67.0924',
  delivery_fee integer not null default 120,
  free_delivery_threshold integer not null default 1500,
  points_per_100_pkr integer not null default 10,
  timezone text not null default 'Asia/Karachi',
  timing_mode text not null default 'scheduled' check (timing_mode in ('scheduled', 'force_open_24h', 'force_closed', 'one_hour_window')),
  one_hour_opens_until timestamptz,
  ai_enabled boolean not null default true,
  ai_personality text not null default 'Warm, polite Pakistani food stall host (Urdu + English)',
  ai_instructions text not null default 'Answer strictly about Home Food Corner menu, timings, deals, delivery, rewards, and policies.',
  ai_language text not null default 'bilingual',
  updated_at timestamptz not null default now()
);

create table if not exists public.opening_hours (
  day_of_week integer primary key check (day_of_week between 0 and 6),
  day_name text not null,
  open_time text not null default '19:00',
  close_time text not null default '00:00',
  is_closed boolean not null default false
);

-- 10. ai_chat_messages & admin_logs
create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  admin_email text not null,
  action text not null,
  entity text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.offers enable row level security;
alter table public.policies enable row level security;
alter table public.social_links enable row level security;
alter table public.store_settings enable row level security;
alter table public.opening_hours enable row level security;
alter table public.admin_logs enable row level security;

-- Profiles: Customer reads/updates own profile; Admin reads all
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Public read for active catalogue, settings, policies, social links
create policy "public_read_categories" on public.categories for select using (is_active = true or public.is_admin());
create policy "admin_manage_categories" on public.categories for all using (public.is_admin());

create policy "public_read_products" on public.products for select using (true);
create policy "admin_manage_products" on public.products for all using (public.is_admin());

create policy "public_read_inventory" on public.inventory for select using (true);
create policy "admin_manage_inventory" on public.inventory for all using (public.is_admin());

-- Orders: Customer sees own orders; Admin sees & updates all
create policy "orders_select_own_or_admin" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());
create policy "orders_insert_validated" on public.orders
  for insert with check (auth.uid() = user_id or user_id is null);
create policy "orders_admin_update" on public.orders
  for update using (public.is_admin());

-- Reviews: Public sees visible reviews; logged-in customer inserts/edits/deletes own; Admin manages all
create policy "reviews_public_select" on public.reviews
  for select using (is_visible = true or auth.uid() = user_id or public.is_admin());
create policy "reviews_customer_insert" on public.reviews
  for insert with check (auth.uid() = user_id);
create policy "reviews_customer_modify_own" on public.reviews
  for update using (auth.uid() = user_id or public.is_admin());
create policy "reviews_customer_delete_own" on public.reviews
  for delete using (auth.uid() = user_id or public.is_admin());

-- Notifications: Admin sees admin notifications; Customer sees own or broadcast.
-- Client INSERT is intentionally denied (only server service_role creates notifications).
create policy "notifications_select_scoped" on public.notifications
  for select using (
    (recipient_role = 'admin' and public.is_admin())
    or (recipient_role = 'customer' and recipient_user_id = auth.uid())
    or (recipient_role = 'broadcast')
  );

create policy "notifications_update_read_scoped" on public.notifications
  for update using (
    (recipient_role = 'admin' and public.is_admin())
    or (recipient_role = 'customer' and recipient_user_id = auth.uid())
  );

-- 11. Web Push Subscriptions (VAPID endpoints bound to verified user/role)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'guest' check (role in ('guest', 'customer', 'admin')),
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_own_or_admin" on public.push_subscriptions
  for all using (auth.uid() = user_id or public.is_admin());

-- Admin logs strictly admin-only
create policy "admin_logs_strict" on public.admin_logs
  for all using (public.is_admin());

-- Realtime publication strictly for orders & notifications
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.notifications;
