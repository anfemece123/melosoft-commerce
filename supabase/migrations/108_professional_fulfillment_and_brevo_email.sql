-- ============================================================
-- Migration 108 — Professional fulfillment + Brevo email outbox
--
-- Keeps the historical order status values for compatibility while adding
-- the shipment data expected by a professional ecommerce operation. Email
-- delivery is transactional-outbox based: order writes enqueue durable rows,
-- and a separate service-role Edge Function sends them through Brevo. A Brevo
-- outage can therefore never roll back a valid order.
-- ============================================================

-- ── 1. Shipment metadata on orders ──────────────────────────

alter table public.orders
  add column if not exists shipping_carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists estimated_delivery_at date,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.orders
  drop constraint if exists orders_shipping_carrier_length,
  add constraint orders_shipping_carrier_length
    check (shipping_carrier is null or char_length(shipping_carrier) between 1 and 120),
  drop constraint if exists orders_tracking_number_length,
  add constraint orders_tracking_number_length
    check (tracking_number is null or char_length(tracking_number) between 1 and 160),
  drop constraint if exists orders_tracking_url_valid,
  add constraint orders_tracking_url_valid
    check (
      tracking_url is null
      or (char_length(tracking_url) <= 2048 and tracking_url ~* '^https?://[^[:space:]]+$')
    );

create index if not exists orders_tracking_number_idx
  on public.orders (tracking_number)
  where tracking_number is not null;

comment on column public.orders.shipping_carrier is
  'Carrier or local delivery operator snapshot entered when an order is dispatched.';
comment on column public.orders.tracking_number is
  'Customer-facing shipment tracking/guide number.';
comment on column public.orders.tracking_url is
  'Optional HTTPS/HTTP carrier tracking URL sent to the customer.';
comment on column public.orders.estimated_delivery_at is
  'Merchant-provided estimated delivery date; not a carrier guarantee.';

create or replace function public.set_order_fulfillment_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'shipped' and old.status is distinct from 'shipped' then
    new.shipped_at := coalesce(new.shipped_at, now());
  end if;
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_fulfillment_timestamps on public.orders;
create trigger orders_set_fulfillment_timestamps
  before update of status on public.orders
  for each row execute function public.set_order_fulfillment_timestamps();

-- Atomic, permission-checked dispatch operation. National shipments must
-- include a carrier and guide before they can reach `shipped`; pickup and
-- local delivery intentionally allow those fields to stay empty.
create or replace function public.dispatch_store_order(
  p_order_id uuid,
  p_shipping_carrier text default null,
  p_tracking_number text default null,
  p_tracking_url text default null,
  p_estimated_delivery_at date default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_updated public.orders;
  v_carrier text := nullif(btrim(p_shipping_carrier), '');
  v_tracking_number text := nullif(btrim(p_tracking_number), '');
  v_tracking_url text := nullif(btrim(p_tracking_url), '');
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not public.is_platform_admin()
     and not public.has_store_role(v_order.store_id, array['owner', 'admin', 'staff']) then
    raise exception 'INSUFFICIENT_PERMISSIONS';
  end if;

  if v_order.status not in ('processing', 'shipped') then
    raise exception 'ORDER_NOT_READY_FOR_DISPATCH';
  end if;

  if v_order.fulfillment_method = 'national_shipping'
     and (v_carrier is null or v_tracking_number is null) then
    raise exception 'NATIONAL_SHIPMENT_REQUIRES_TRACKING';
  end if;

  if v_tracking_url is not null and v_tracking_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'INVALID_TRACKING_URL';
  end if;

  update public.orders
  set status = 'shipped',
      shipping_carrier = case when fulfillment_method = 'pickup' then null else v_carrier end,
      tracking_number = case when fulfillment_method = 'pickup' then null else v_tracking_number end,
      tracking_url = case when fulfillment_method = 'pickup' then null else v_tracking_url end,
      estimated_delivery_at = case when fulfillment_method = 'pickup' then null else p_estimated_delivery_at end,
      shipped_at = coalesce(shipped_at, now())
  where id = p_order_id
  returning * into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.dispatch_store_order(uuid, text, text, text, date) from public;
grant execute on function public.dispatch_store_order(uuid, text, text, text, date) to authenticated;
grant execute on function public.dispatch_store_order(uuid, text, text, text, date) to service_role;

-- ── 2. Durable email notification outbox ────────────────────

create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  channel text not null default 'email',
  event_type text not null,
  recipient_type text not null,
  recipient_email text not null,
  recipient_name text,
  status text not null default 'queued',
  provider text not null default 'brevo',
  provider_message_id text,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  is_permanent_failure boolean not null default false,
  last_error_category text,
  last_error_code text,
  last_error_message text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint email_notifications_channel_valid check (channel = 'email'),
  constraint email_notifications_event_type_valid check (event_type in (
    'merchant_new_order',
    'customer_order_received',
    'customer_order_confirmed',
    'customer_order_ready_for_pickup',
    'customer_order_shipped',
    'customer_order_delivered',
    'customer_order_cancelled'
  )),
  constraint email_notifications_recipient_type_valid check (recipient_type in ('customer', 'merchant')),
  constraint email_notifications_recipient_length check (char_length(recipient_email) between 1 and 320),
  constraint email_notifications_status_valid check (status in (
    'queued', 'sending', 'sent', 'delivered', 'failed', 'invalid_recipient'
  )),
  constraint email_notifications_attempts_valid check (
    attempts >= 0 and max_attempts between 1 and 10 and attempts <= max_attempts
  ),
  constraint email_notifications_provider_valid check (provider = 'brevo')
);

create unique index if not exists email_notifications_order_event_recipient_uidx
  on public.email_notifications (order_id, event_type, lower(recipient_email));
create index if not exists email_notifications_due_idx
  on public.email_notifications (next_attempt_at, queued_at)
  where status = 'queued';
create index if not exists email_notifications_store_created_idx
  on public.email_notifications (store_id, created_at desc);

drop trigger if exists email_notifications_updated_at on public.email_notifications;
create trigger email_notifications_updated_at
  before update on public.email_notifications
  for each row execute function public.handle_updated_at();

alter table public.email_notifications enable row level security;

create policy "email_notifications_select_platform_admin" on public.email_notifications
  for select to authenticated using (public.is_platform_admin());
create policy "email_notifications_select_store_member" on public.email_notifications
  for select to authenticated using (public.is_store_member(store_id));

revoke all on public.email_notifications from anon, authenticated;
grant select on public.email_notifications to authenticated;
grant all on public.email_notifications to service_role;

comment on table public.email_notifications is
  'Idempotent transactional-email outbox. Only the service-role Brevo worker mutates delivery state.';

create or replace function public.normalize_transactional_email(p_email text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_email is not null
     and char_length(btrim(p_email)) between 3 and 320
     and btrim(p_email) ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    then lower(btrim(p_email))
    else null
  end
$$;

-- AFTER INSERT is the one authoritative trigger point for both COD orders
-- and orders materialized by the Wompi webhook. Errors are isolated so email
-- infrastructure can never make a completed sale fail.
create or replace function public.enqueue_order_created_emails()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_name text;
  v_merchant_email text;
  v_customer_email text;
begin
  begin
    select s.name,
           coalesce(
             public.normalize_transactional_email(s.support_email),
             public.normalize_transactional_email(p.email)
           )
      into v_store_name, v_merchant_email
      from public.stores s
      left join public.profiles p on p.user_id = s.owner_id
     where s.id = new.store_id;

    if v_merchant_email is not null then
      insert into public.email_notifications (
        store_id, order_id, event_type, recipient_type, recipient_email, recipient_name
      ) values (
        new.store_id, new.id, 'merchant_new_order', 'merchant', v_merchant_email, v_store_name
      ) on conflict do nothing;
    else
      raise warning 'merchant_order_email_skipped order_id=% store_id=% reason=no_valid_recipient',
        new.id, new.store_id;
    end if;

    v_customer_email := public.normalize_transactional_email(new.customer_email);
    if v_customer_email is not null then
      insert into public.email_notifications (
        store_id, order_id, event_type, recipient_type, recipient_email, recipient_name
      ) values (
        new.store_id, new.id, 'customer_order_received', 'customer', v_customer_email, new.customer_name
      ) on conflict do nothing;
    elsif new.customer_email is not null and btrim(new.customer_email) <> '' then
      insert into public.email_notifications (
        store_id, order_id, event_type, recipient_type, recipient_email, recipient_name,
        status, attempts, max_attempts, is_permanent_failure,
        last_error_category, last_error_code, last_error_message, failed_at
      ) values (
        new.store_id, new.id, 'customer_order_received', 'customer', left(btrim(new.customer_email), 320), new.customer_name,
        'invalid_recipient', 0, 1, true,
        'invalid_email', 'INVALID_EMAIL', 'El correo del cliente no tiene un formato válido.', now()
      ) on conflict do nothing;
    end if;
  exception when others then
    raise warning 'order_email_enqueue_failed order_id=% store_id=% sqlstate=%',
      new.id, new.store_id, sqlstate;
  end;
  return new;
end;
$$;

drop trigger if exists trg_enqueue_order_created_emails on public.orders;
create trigger trg_enqueue_order_created_emails
  after insert on public.orders
  for each row execute function public.enqueue_order_created_emails();

-- Customer milestones are intentionally limited to useful events: confirmed,
-- ready/shipped, delivered and cancelled. Internal preparation is not emailed.
create or replace function public.enqueue_order_status_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_type text;
  v_customer_email text;
begin
  begin
    if old.status is not distinct from new.status then
      return new;
    end if;

    v_customer_email := public.normalize_transactional_email(new.customer_email);
    if v_customer_email is null then
      return new;
    end if;

    if new.status = 'confirmed' then
      v_event_type := 'customer_order_confirmed';
    elsif new.status = 'shipped' and new.fulfillment_method = 'pickup' then
      v_event_type := 'customer_order_ready_for_pickup';
    elsif new.status = 'shipped' then
      v_event_type := 'customer_order_shipped';
    elsif new.status = 'delivered' then
      v_event_type := 'customer_order_delivered';
    elsif new.status = 'cancelled' then
      v_event_type := 'customer_order_cancelled';
    else
      return new;
    end if;

    insert into public.email_notifications (
      store_id, order_id, event_type, recipient_type, recipient_email, recipient_name
    ) values (
      new.store_id, new.id, v_event_type, 'customer', v_customer_email, new.customer_name
    ) on conflict do nothing;
  exception when others then
    raise warning 'order_status_email_enqueue_failed order_id=% store_id=% sqlstate=%',
      new.id, new.store_id, sqlstate;
  end;
  return new;
end;
$$;

drop trigger if exists trg_enqueue_order_status_email on public.orders;
create trigger trg_enqueue_order_status_email
  after update of status on public.orders
  for each row execute function public.enqueue_order_status_email();

-- Atomic queue claim for concurrent workers. Stale sends are reclaimed after
-- two minutes; Brevo receives the stable row UUID as an idempotency key.
create or replace function public.claim_pending_email_notifications(
  p_limit integer default 20,
  p_worker_id text default 'brevo-worker'
)
returns setof public.email_notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Brevo's idempotency window is finite. A send left in an ambiguous
  -- `sending` state for too long is dead-lettered for manual review instead
  -- of being retried after that protection may have expired and risking a
  -- duplicate customer email.
  update public.email_notifications
  set status = 'failed',
      is_permanent_failure = false,
      failed_at = now(),
      locked_at = null,
      locked_by = null,
      last_error_category = 'ambiguous',
      last_error_code = 'STALE_SEND_OUTSIDE_IDEMPOTENCY_WINDOW',
      last_error_message = 'El resultado del envío no pudo confirmarse dentro de la ventana segura de idempotencia.'
  where status = 'sending'
    and locked_at < now() - interval '20 minutes';

  return query
  update public.email_notifications
  set status = 'sending',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = p_worker_id
  where id in (
    select id
    from public.email_notifications
    where attempts < max_attempts
      and ((status = 'queued' and next_attempt_at <= now())
       or (status = 'sending'
           and locked_at < now() - interval '2 minutes'
           and locked_at >= now() - interval '20 minutes'))
    order by next_attempt_at asc
    limit least(greatest(p_limit, 1), 50)
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_pending_email_notifications(integer, text) from public;
revoke all on function public.claim_pending_email_notifications(integer, text) from anon, authenticated;
grant execute on function public.claim_pending_email_notifications(integer, text) to service_role;
