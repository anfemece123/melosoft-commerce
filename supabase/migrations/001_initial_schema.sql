-- ============================================================
-- Melosoft Commerce — Initial Schema (Multistore Platform)
-- Migration: 001
-- ============================================================

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION (reusable)
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- STORES
-- Central entity: each store is a generated ecommerce.
-- ============================================================

create table public.stores (
  id               uuid        primary key default gen_random_uuid(),
  owner_id         uuid        not null references auth.users(id) on delete cascade,
  name             text        not null,
  slug             text        not null,
  description      text,
  logo_url         text,
  favicon_url      text,
  whatsapp_number  text,
  support_email    text,
  instagram_url    text,
  facebook_url     text,
  tiktok_url       text,
  country          text        not null default 'CO',
  city             text,
  currency         text        not null default 'COP',
  status           text        not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint stores_owner_slug_unique unique (owner_id, slug),
  constraint stores_status_valid check (status in ('active', 'inactive', 'archived'))
);

comment on table public.stores is 'Each store represents a generated public ecommerce';

create trigger stores_updated_at
  before update on public.stores
  for each row execute function public.handle_updated_at();

-- ============================================================
-- STORE THEME SETTINGS
-- Visual configuration per store.
-- ============================================================

create table public.store_theme_settings (
  id               uuid        primary key default gen_random_uuid(),
  store_id         uuid        not null references public.stores(id) on delete cascade,
  mode             text        not null default 'light',
  primary_color    text,
  secondary_color  text,
  accent_color     text,
  background_color text,
  text_color       text,
  button_radius    text,
  template_key     text        not null default 'default',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint store_theme_store_unique unique (store_id),
  constraint store_theme_mode_valid check (mode in ('light', 'dark')),
  constraint store_theme_template_valid check (template_key in ('default'))
);

comment on table public.store_theme_settings is 'Theme and visual configuration for each store';

create trigger store_theme_settings_updated_at
  before update on public.store_theme_settings
  for each row execute function public.handle_updated_at();

-- ============================================================
-- STORE POLICIES
-- Public policies per store.
-- ============================================================

create table public.store_policies (
  id                  uuid        primary key default gen_random_uuid(),
  store_id            uuid        not null references public.stores(id) on delete cascade,
  shipping_policy     text,
  returns_policy      text,
  warranty_policy     text,
  privacy_policy      text,
  terms_and_conditions text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint store_policies_store_unique unique (store_id)
);

comment on table public.store_policies is 'Public policies for each store';

create trigger store_policies_updated_at
  before update on public.store_policies
  for each row execute function public.handle_updated_at();

-- ============================================================
-- PRODUCTS
-- Each product belongs to a store.
-- ============================================================

create table public.products (
  id                uuid        primary key default gen_random_uuid(),
  store_id          uuid        not null references public.stores(id) on delete cascade,
  owner_id          uuid        not null references auth.users(id) on delete cascade,
  name              text        not null,
  slug              text        not null,
  description       text        not null,
  short_description text,
  regular_price     numeric(12,2) not null,
  sale_price        numeric(12,2),
  cost_price        numeric(12,2),
  stock             integer     not null default 0,
  status            text        not null default 'active',
  main_image_url    text,
  category          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint products_store_slug_unique  unique (store_id, slug),
  constraint products_stock_positive     check (stock >= 0),
  constraint products_regular_price_ok   check (regular_price >= 0),
  constraint products_sale_price_ok      check (sale_price is null or sale_price >= 0),
  constraint products_cost_price_ok      check (cost_price is null or cost_price >= 0),
  constraint products_status_valid       check (status in ('active', 'inactive', 'archived'))
);

comment on table public.products is 'Product catalog per store';

create trigger products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================

create table public.product_images (
  id           uuid        primary key default gen_random_uuid(),
  store_id     uuid        not null references public.stores(id) on delete cascade,
  product_id   uuid        not null references public.products(id) on delete cascade,
  owner_id     uuid        not null references auth.users(id) on delete cascade,
  image_url    text        not null,
  storage_path text,
  alt_text     text,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.product_images is 'Gallery images for a product';

-- ============================================================
-- OFFERS
-- Each offer belongs to a store. Offers are a feature of the ecommerce.
-- ============================================================

create table public.offers (
  id                   uuid        primary key default gen_random_uuid(),
  store_id             uuid        not null references public.stores(id) on delete cascade,
  owner_id             uuid        not null references auth.users(id) on delete cascade,
  product_id           uuid        references public.products(id) on delete set null,
  title                text        not null,
  slug                 text        not null,
  subtitle             text,
  description          text        not null,
  regular_price        numeric(12,2) not null,
  offer_price          numeric(12,2) not null,
  starts_at            timestamptz,
  ends_at              timestamptz not null,
  status               text        not null default 'draft',
  timer_type           text        not null default 'fixed_date',
  whatsapp_number      text,
  whatsapp_message     text,
  cta_label            text        not null default 'Comprar ahora',
  hero_image_url       text,
  terms_and_conditions text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint offers_store_slug_unique  unique (store_id, slug),
  constraint offers_regular_price_ok   check (regular_price >= 0),
  constraint offers_offer_price_ok     check (offer_price >= 0),
  constraint offers_price_valid        check (offer_price <= regular_price),
  constraint offers_dates_valid        check (starts_at is null or ends_at > starts_at),
  constraint offers_status_valid       check (status in ('draft', 'active', 'paused', 'expired', 'sold_out', 'archived')),
  constraint offers_timer_type_valid   check (timer_type in ('fixed_date'))
);

comment on table public.offers is 'Promotional offers with countdown timers per store';

create trigger offers_updated_at
  before update on public.offers
  for each row execute function public.handle_updated_at();

-- ============================================================
-- OFFER IMAGES
-- ============================================================

create table public.offer_images (
  id           uuid        primary key default gen_random_uuid(),
  store_id     uuid        not null references public.stores(id) on delete cascade,
  offer_id     uuid        not null references public.offers(id) on delete cascade,
  owner_id     uuid        not null references auth.users(id) on delete cascade,
  image_url    text        not null,
  storage_path text,
  alt_text     text,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.offer_images is 'Gallery images for an offer';

-- ============================================================
-- ORDERS
-- Customer orders per store.
-- ============================================================

create table public.orders (
  id               uuid        primary key default gen_random_uuid(),
  store_id         uuid        not null references public.stores(id) on delete cascade,
  customer_name    text        not null,
  customer_email   text,
  customer_phone   text        not null,
  customer_document text,
  shipping_address text,
  city             text,
  department       text,
  subtotal         numeric(12,2) not null default 0,
  shipping_amount  numeric(12,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  total_amount     numeric(12,2) not null default 0,
  currency         text        not null default 'COP',
  status           text        not null default 'pending',
  payment_status   text        not null default 'pending',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint orders_status_valid         check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  constraint orders_payment_status_valid check (payment_status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  constraint orders_subtotal_ok          check (subtotal >= 0),
  constraint orders_shipping_ok          check (shipping_amount >= 0),
  constraint orders_discount_ok          check (discount_amount >= 0),
  constraint orders_total_ok             check (total_amount >= 0)
);

comment on table public.orders is 'Customer orders per store';

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ORDER ITEMS
-- Products or offers included in an order.
-- ============================================================

create table public.order_items (
  id          uuid        primary key default gen_random_uuid(),
  order_id    uuid        not null references public.orders(id) on delete cascade,
  product_id  uuid        references public.products(id) on delete set null,
  offer_id    uuid        references public.offers(id) on delete set null,
  name        text        not null,
  quantity    integer     not null,
  unit_price  numeric(12,2) not null,
  total_price numeric(12,2) not null,
  created_at  timestamptz not null default now(),

  constraint order_items_quantity_ok    check (quantity > 0),
  constraint order_items_unit_price_ok  check (unit_price >= 0),
  constraint order_items_total_price_ok check (total_price >= 0)
);

comment on table public.order_items is 'Items (products or offers) included in an order';

-- ============================================================
-- PAYMENT PROVIDERS
-- Platform-level payment providers (seeded by platform admin).
-- ============================================================

create table public.payment_providers (
  id         uuid        primary key default gen_random_uuid(),
  code       text        unique not null,
  name       text        not null,
  status     text        not null default 'active',
  created_at timestamptz not null default now(),

  constraint payment_providers_status_valid check (status in ('active', 'inactive'))
);

comment on table public.payment_providers is 'Available payment providers on the platform';

-- ============================================================
-- STORE PAYMENT SETTINGS
-- Payment configuration per store.
-- NOTE: private_key_reference and integrity_secret_reference
-- are references to secrets stored in Edge Function environment,
-- NOT actual private keys. Never expose real private keys here.
-- ============================================================

create table public.store_payment_settings (
  id                         uuid        primary key default gen_random_uuid(),
  store_id                   uuid        not null references public.stores(id) on delete cascade,
  provider_id                uuid        not null references public.payment_providers(id),
  public_key                 text,
  private_key_reference      text,
  integrity_secret_reference text,
  environment                text        not null default 'sandbox',
  is_active                  boolean     not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint store_payment_settings_unique  unique (store_id, provider_id),
  constraint store_payment_env_valid        check (environment in ('sandbox', 'production'))
);

comment on table public.store_payment_settings is 'Payment gateway configuration per store. Keys are references only.';

create trigger store_payment_settings_updated_at
  before update on public.store_payment_settings
  for each row execute function public.handle_updated_at();

-- ============================================================
-- PAYMENT TRANSACTIONS
-- Transaction records linked to orders.
-- ============================================================

create table public.payment_transactions (
  id                     uuid        primary key default gen_random_uuid(),
  store_id               uuid        not null references public.stores(id) on delete cascade,
  order_id               uuid        references public.orders(id) on delete set null,
  provider_id            uuid        references public.payment_providers(id),
  provider_transaction_id text,
  provider_reference     text,
  amount                 numeric(12,2) not null,
  currency               text        not null default 'COP',
  status                 text        not null default 'pending',
  payment_method         text,
  raw_response           jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint payment_transactions_amount_ok  check (amount >= 0),
  constraint payment_transactions_status_valid check (
    status in ('pending', 'approved', 'declined', 'error', 'voided', 'refunded')
  )
);

comment on table public.payment_transactions is 'Payment gateway transactions per store';

create trigger payment_transactions_updated_at
  before update on public.payment_transactions
  for each row execute function public.handle_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_stores_owner_id         on public.stores(owner_id);
create index idx_stores_owner_status     on public.stores(owner_id, status);
create index idx_stores_owner_slug       on public.stores(owner_id, slug);
create index idx_stores_slug             on public.stores(slug);

create index idx_products_store_id       on public.products(store_id);
create index idx_products_store_status   on public.products(store_id, status);
create index idx_products_store_slug     on public.products(store_id, slug);

create index idx_offers_store_id         on public.offers(store_id);
create index idx_offers_store_status     on public.offers(store_id, status);
create index idx_offers_store_slug       on public.offers(store_id, slug);
create index idx_offers_status_ends_at   on public.offers(status, ends_at);

create index idx_orders_store_id         on public.orders(store_id);
create index idx_orders_store_status     on public.orders(store_id, status);
create index idx_orders_store_payment    on public.orders(store_id, payment_status);

create index idx_payment_transactions_store_id  on public.payment_transactions(store_id);
create index idx_payment_transactions_order_id  on public.payment_transactions(order_id);

create index idx_product_images_product_id on public.product_images(product_id);
create index idx_offer_images_offer_id     on public.offer_images(offer_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.stores                  enable row level security;
alter table public.store_theme_settings    enable row level security;
alter table public.store_policies          enable row level security;
alter table public.products                enable row level security;
alter table public.product_images          enable row level security;
alter table public.offers                  enable row level security;
alter table public.offer_images            enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.payment_providers       enable row level security;
alter table public.store_payment_settings  enable row level security;
alter table public.payment_transactions    enable row level security;

-- Stores
create policy "stores_select_own" on public.stores
  for select to authenticated using (owner_id = auth.uid());
create policy "stores_insert_own" on public.stores
  for insert to authenticated with check (owner_id = auth.uid());
create policy "stores_update_own" on public.stores
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "stores_delete_own" on public.stores
  for delete to authenticated using (owner_id = auth.uid());

-- Store theme settings (via store ownership)
create policy "store_theme_select_own" on public.store_theme_settings
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "store_theme_insert_own" on public.store_theme_settings
  for insert to authenticated
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "store_theme_update_own" on public.store_theme_settings
  for update to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "store_theme_delete_own" on public.store_theme_settings
  for delete to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Store policies (via store ownership)
create policy "store_policies_select_own" on public.store_policies
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "store_policies_insert_own" on public.store_policies
  for insert to authenticated
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "store_policies_update_own" on public.store_policies
  for update to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "store_policies_delete_own" on public.store_policies
  for delete to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Products
create policy "products_select_own" on public.products
  for select to authenticated using (owner_id = auth.uid());
create policy "products_insert_own" on public.products
  for insert to authenticated with check (owner_id = auth.uid());
create policy "products_update_own" on public.products
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "products_delete_own" on public.products
  for delete to authenticated using (owner_id = auth.uid());

-- Product images
create policy "product_images_select_own" on public.product_images
  for select to authenticated using (owner_id = auth.uid());
create policy "product_images_insert_own" on public.product_images
  for insert to authenticated with check (owner_id = auth.uid());
create policy "product_images_update_own" on public.product_images
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "product_images_delete_own" on public.product_images
  for delete to authenticated using (owner_id = auth.uid());

-- Offers
create policy "offers_select_own" on public.offers
  for select to authenticated using (owner_id = auth.uid());
create policy "offers_insert_own" on public.offers
  for insert to authenticated with check (owner_id = auth.uid());
create policy "offers_update_own" on public.offers
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "offers_delete_own" on public.offers
  for delete to authenticated using (owner_id = auth.uid());

-- Offer images
create policy "offer_images_select_own" on public.offer_images
  for select to authenticated using (owner_id = auth.uid());
create policy "offer_images_insert_own" on public.offer_images
  for insert to authenticated with check (owner_id = auth.uid());
create policy "offer_images_update_own" on public.offer_images
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "offer_images_delete_own" on public.offer_images
  for delete to authenticated using (owner_id = auth.uid());

-- Orders (owner via store)
create policy "orders_select_own" on public.orders
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "orders_insert_own" on public.orders
  for insert to authenticated
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "orders_update_own" on public.orders
  for update to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Order items (via order ownership)
create policy "order_items_select_own" on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));
create policy "order_items_insert_own" on public.order_items
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));

-- Payment providers (read-only for authenticated, no write from frontend)
create policy "payment_providers_select_auth" on public.payment_providers
  for select to authenticated using (status = 'active');

-- Store payment settings
create policy "store_payment_settings_select_own" on public.store_payment_settings
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "store_payment_settings_insert_own" on public.store_payment_settings
  for insert to authenticated
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "store_payment_settings_update_own" on public.store_payment_settings
  for update to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Payment transactions
create policy "payment_transactions_select_own" on public.payment_transactions
  for select to authenticated
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- ============================================================
-- PUBLIC READ POLICIES (anon users for store public pages)
-- ============================================================

-- Active stores readable by anon (needed for public views)
create policy "stores_select_public_active" on public.stores
  for select to anon using (status = 'active');

-- Active store theme settings readable by anon
create policy "store_theme_select_public" on public.store_theme_settings
  for select to anon
  using (exists (select 1 from public.stores s where s.id = store_id and s.status = 'active'));

-- Store policies readable by anon
create policy "store_policies_select_public" on public.store_policies
  for select to anon
  using (exists (select 1 from public.stores s where s.id = store_id and s.status = 'active'));

-- Active products readable by anon
create policy "products_select_public_active" on public.products
  for select to anon
  using (
    status = 'active'
    and exists (select 1 from public.stores s where s.id = store_id and s.status = 'active')
  );

-- Active offers readable by anon
create policy "offers_select_public_active" on public.offers
  for select to anon
  using (
    status = 'active'
    and ends_at > now()
    and exists (select 1 from public.stores s where s.id = store_id and s.status = 'active')
  );

-- ============================================================
-- PUBLIC VIEWS
-- ============================================================

-- 1. Public store pages view
create view public.public_store_pages
  with (security_invoker = true)
as
  select
    s.id              as store_id,
    s.slug            as store_slug,
    s.name            as store_name,
    s.description,
    s.logo_url,
    s.favicon_url,
    s.whatsapp_number,
    s.support_email,
    s.instagram_url,
    s.facebook_url,
    s.tiktok_url,
    s.country,
    s.city,
    s.currency,
    -- Theme settings
    t.mode            as theme_mode,
    t.primary_color,
    t.secondary_color,
    t.accent_color,
    t.background_color,
    t.text_color,
    t.button_radius,
    t.template_key,
    -- Policies
    p.shipping_policy,
    p.returns_policy,
    p.warranty_policy,
    p.privacy_policy,
    p.terms_and_conditions
  from public.stores s
  left join public.store_theme_settings t on t.store_id = s.id
  left join public.store_policies p on p.store_id = s.id
  where s.status = 'active';

grant select on public.public_store_pages to anon;

-- 2. Public product pages view
create view public.public_product_pages
  with (security_invoker = true)
as
  select
    s.slug            as store_slug,
    s.name            as store_name,
    s.logo_url,
    -- Theme
    t.mode            as theme_mode,
    t.primary_color,
    t.secondary_color,
    t.accent_color,
    t.background_color,
    t.text_color,
    t.button_radius,
    t.template_key,
    -- Product
    pr.id             as product_id,
    pr.slug           as product_slug,
    pr.name           as product_name,
    pr.description,
    pr.short_description,
    pr.regular_price,
    pr.sale_price,
    pr.stock,
    pr.main_image_url,
    pr.category
    -- NOTE: cost_price and owner_id are intentionally excluded
  from public.products pr
  join public.stores s on s.id = pr.store_id
  left join public.store_theme_settings t on t.store_id = s.id
  where
    s.status = 'active'
    and pr.status = 'active';

grant select on public.public_product_pages to anon;

-- 3. Public offer pages view
create view public.public_offer_pages
  with (security_invoker = true)
as
  select
    s.slug            as store_slug,
    s.name            as store_name,
    s.logo_url,
    -- Theme
    t.mode            as theme_mode,
    t.primary_color,
    t.secondary_color,
    t.accent_color,
    t.background_color,
    t.text_color,
    t.button_radius,
    t.template_key,
    -- Offer
    o.id              as offer_id,
    o.slug            as offer_slug,
    o.title,
    o.subtitle,
    o.description,
    o.regular_price,
    o.offer_price,
    o.starts_at,
    o.ends_at,
    o.status,
    o.timer_type,
    o.whatsapp_number,
    o.whatsapp_message,
    o.cta_label,
    o.hero_image_url,
    o.terms_and_conditions,
    -- Associated product (nullable)
    pr.name           as product_name,
    pr.slug           as product_slug,
    pr.main_image_url as product_main_image_url
  from public.offers o
  join public.stores s on s.id = o.store_id
  left join public.store_theme_settings t on t.store_id = s.id
  left join public.products pr on pr.id = o.product_id
  where
    s.status = 'active'
    and o.status = 'active'
    and o.ends_at > now();

grant select on public.public_offer_pages to anon;
