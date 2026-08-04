-- Professional, verified product reviews.
-- Reviews can only be submitted through a bearer invitation created from a
-- delivered order. Merchants control the feature and individual visibility,
-- while commercial hiding deliberately keeps the rating in the aggregate.

create table public.store_review_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  mode text not null default 'disabled',
  auto_publish boolean not null default true,
  show_rating_on_cards boolean not null default true,
  show_product_reviews boolean not null default true,
  show_review_photos boolean not null default true,
  invitation_expiry_days integer not null default 90,
  invitation_message text not null default 'Gracias por tu compra. Tu opinión ayuda a otras personas a elegir mejor.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_review_settings_mode_valid check (mode in ('disabled', 'collect_only', 'public')),
  constraint store_review_settings_expiry_valid check (invitation_expiry_days between 7 and 365),
  constraint store_review_settings_message_valid check (char_length(invitation_message) between 1 and 400)
);

create table public.review_invitations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null,
  first_opened_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_invitations_order_unique unique (order_id),
  constraint review_invitations_token_unique unique (token)
);

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  invitation_id uuid not null references public.review_invitations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  rating smallint not null,
  title text,
  comment text,
  customer_display_name text not null,
  publication_status text not null default 'pending',
  moderation_status text not null default 'approved',
  rating_included boolean not null default true,
  hidden_reason text,
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_reviews_rating_valid check (rating between 1 and 5),
  constraint product_reviews_title_valid check (title is null or char_length(title) between 1 and 120),
  constraint product_reviews_comment_valid check (comment is null or char_length(comment) between 1 and 2000),
  constraint product_reviews_customer_name_valid check (char_length(customer_display_name) between 1 and 100),
  constraint product_reviews_publication_valid check (publication_status in ('pending', 'published', 'hidden', 'removed')),
  constraint product_reviews_moderation_valid check (moderation_status in ('approved', 'flagged', 'rejected')),
  constraint product_reviews_one_product_per_invitation unique (invitation_id, product_id)
);

create table public.product_review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.product_reviews(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  body text not null,
  replied_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_review_replies_body_valid check (char_length(body) between 1 and 1200)
);

create table public.product_review_images (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  image_url text not null,
  storage_path text not null unique,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint product_review_images_sort_valid check (sort_order between 0 and 2),
  constraint product_review_images_url_valid check (image_url ~ '^https?://'),
  constraint product_review_images_path_valid check (storage_path like 'reviews/%')
);

create table public.product_review_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint product_review_events_type_valid check (event_type in ('submitted', 'published', 'hidden', 'restored', 'removed', 'replied', 'reply_updated'))
);

create index review_invitations_store_created_idx on public.review_invitations(store_id, created_at desc);
create index review_invitations_token_lookup_idx on public.review_invitations(token);
create index product_reviews_store_status_created_idx on public.product_reviews(store_id, publication_status, created_at desc);
create index product_reviews_product_public_idx on public.product_reviews(product_id, created_at desc)
  where publication_status = 'published';
create index product_reviews_store_rating_idx on public.product_reviews(store_id, rating, created_at desc);
create index product_review_events_review_created_idx on public.product_review_events(review_id, created_at desc);
create index product_review_images_review_order_idx on public.product_review_images(review_id, sort_order);
create unique index product_review_images_one_slot_idx on public.product_review_images(review_id, sort_order);

drop trigger if exists store_review_settings_updated_at on public.store_review_settings;
create trigger store_review_settings_updated_at before update on public.store_review_settings
  for each row execute function public.handle_updated_at();
drop trigger if exists review_invitations_updated_at on public.review_invitations;
create trigger review_invitations_updated_at before update on public.review_invitations
  for each row execute function public.handle_updated_at();
drop trigger if exists product_reviews_updated_at on public.product_reviews;
create trigger product_reviews_updated_at before update on public.product_reviews
  for each row execute function public.handle_updated_at();
drop trigger if exists product_review_replies_updated_at on public.product_review_replies;
create trigger product_review_replies_updated_at before update on public.product_review_replies
  for each row execute function public.handle_updated_at();

-- Existing stores start with reviews disabled so this migration never changes
-- a live storefront without the merchant explicitly enabling the module.
insert into public.store_review_settings (store_id)
select id from public.stores
on conflict (store_id) do nothing;

create or replace function public.create_store_review_settings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.store_review_settings(store_id) values (new.id)
  on conflict (store_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_store_review_settings on public.stores;
create trigger create_store_review_settings
  after insert on public.stores
  for each row execute function public.create_store_review_settings();

create or replace function public.mask_review_customer_name(p_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  with clean as (
    select regexp_replace(btrim(coalesce(p_name, 'Cliente verificado')), '\s+', ' ', 'g') value
  ), parts as (
    select value, regexp_split_to_array(value, ' ') words from clean
  )
  select left(words[1], 50) || case when cardinality(words) > 1 then ' ' || left(words[cardinality(words)], 1) || '.' else '' end
  from parts
$$;

create or replace function public.ensure_review_invitation_after_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expiry_days integer;
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    select coalesce(settings.invitation_expiry_days, 90)
      into v_expiry_days
    from public.store_review_settings settings
    where settings.store_id = new.store_id;

    insert into public.review_invitations(store_id, order_id, expires_at)
    values (new.store_id, new.id, coalesce(new.delivered_at, now()) + make_interval(days => coalesce(v_expiry_days, 90)))
    on conflict (order_id) do nothing;
  end if;
  return new;
exception when others then
  -- Reviews are important, but they must never make an order transition fail.
  raise warning 'review_invitation_create_failed order_id=% sqlstate=%', new.id, sqlstate;
  return new;
end;
$$;

drop trigger if exists ensure_review_invitation_after_delivery on public.orders;
create trigger ensure_review_invitation_after_delivery
  after update of status on public.orders
  for each row execute function public.ensure_review_invitation_after_delivery();

-- Backfill delivered orders that predate the module. Invitations remain
-- dormant until their store enables collection.
insert into public.review_invitations(store_id, order_id, expires_at)
select orders.store_id,
       orders.id,
       greatest(now() + interval '30 days', coalesce(orders.delivered_at, orders.updated_at) + make_interval(days => settings.invitation_expiry_days))
from public.orders orders
join public.store_review_settings settings on settings.store_id = orders.store_id
where orders.status = 'delivered'
on conflict (order_id) do nothing;

alter table public.store_review_settings enable row level security;
alter table public.review_invitations enable row level security;
alter table public.product_reviews enable row level security;
alter table public.product_review_replies enable row level security;
alter table public.product_review_images enable row level security;
alter table public.product_review_events enable row level security;

create policy store_review_settings_select_member on public.store_review_settings
  for select to authenticated using (public.is_store_member(store_id) or public.is_platform_admin());
create policy store_review_settings_write_member on public.store_review_settings
  for all to authenticated
  using (public.has_store_role(store_id, array['owner', 'admin']) or public.is_platform_admin())
  with check (public.has_store_role(store_id, array['owner', 'admin']) or public.is_platform_admin());

create policy review_invitations_select_member on public.review_invitations
  for select to authenticated using (public.is_store_member(store_id) or public.is_platform_admin());
create policy product_reviews_select_member on public.product_reviews
  for select to authenticated using (public.is_store_member(store_id) or public.is_platform_admin());
create policy product_review_replies_select_member on public.product_review_replies
  for select to authenticated using (public.is_store_member(store_id) or public.is_platform_admin());
create policy product_review_images_select_member on public.product_review_images
  for select to authenticated using (public.is_store_member(store_id) or public.is_platform_admin());
create policy product_review_events_select_member on public.product_review_events
  for select to authenticated using (public.is_store_member(store_id) or public.is_platform_admin());

revoke all on public.store_review_settings, public.review_invitations, public.product_reviews,
  public.product_review_replies, public.product_review_images, public.product_review_events
  from anon, authenticated;
grant select, insert, update on public.store_review_settings to authenticated;
grant select on public.review_invitations, public.product_reviews, public.product_review_replies,
  public.product_review_images, public.product_review_events to authenticated;
grant all on public.store_review_settings, public.review_invitations, public.product_reviews,
  public.product_review_replies, public.product_review_images, public.product_review_events to service_role;

create or replace function public.ensure_order_review_invitation(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_settings public.store_review_settings%rowtype;
  v_invitation public.review_invitations%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'REVIEW_ORDER_NOT_FOUND'; end if;
  if not (public.has_store_role(v_order.store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin()) then
    raise exception 'REVIEW_FORBIDDEN';
  end if;
  if v_order.status <> 'delivered' then raise exception 'REVIEW_ORDER_NOT_DELIVERED'; end if;

  select * into v_settings from public.store_review_settings where store_id = v_order.store_id;
  insert into public.review_invitations(store_id, order_id, expires_at)
  values (v_order.store_id, v_order.id, coalesce(v_order.delivered_at, now()) + make_interval(days => coalesce(v_settings.invitation_expiry_days, 90)))
  on conflict (order_id) do update set
    token = case
      when review_invitations.submitted_at is null and review_invitations.expires_at <= now() then gen_random_uuid()
      else review_invitations.token
    end,
    expires_at = case
      when review_invitations.submitted_at is null and review_invitations.expires_at <= now() then now() + make_interval(days => coalesce(v_settings.invitation_expiry_days, 90))
      else review_invitations.expires_at
    end
  returning * into v_invitation;

  return jsonb_build_object(
    'id', v_invitation.id,
    'token', v_invitation.token,
    'expires_at', v_invitation.expires_at,
    'submitted_at', v_invitation.submitted_at,
    'mode', coalesce(v_settings.mode, 'disabled'),
    'invitation_message', coalesce(v_settings.invitation_message, 'Gracias por tu compra. Comparte tu experiencia.')
  );
end;
$$;

create or replace function public.get_review_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.review_invitations%rowtype;
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_settings public.store_review_settings%rowtype;
begin
  select * into v_invitation from public.review_invitations where token = p_token;
  if not found then return jsonb_build_object('state', 'invalid'); end if;

  select * into v_order from public.orders where id = v_invitation.order_id;
  select * into v_store from public.stores where id = v_invitation.store_id;
  select * into v_settings from public.store_review_settings where store_id = v_invitation.store_id;

  if v_store.status <> 'active' or v_order.status <> 'delivered' then
    return jsonb_build_object('state', 'unavailable');
  end if;
  if coalesce(v_settings.mode, 'disabled') = 'disabled' then
    return jsonb_build_object('state', 'disabled', 'store_name', v_store.name, 'logo_url', v_store.logo_url);
  end if;
  if v_invitation.expires_at <= now() then
    return jsonb_build_object('state', 'expired', 'store_name', v_store.name, 'logo_url', v_store.logo_url);
  end if;
  if v_invitation.submitted_at is not null then
    return jsonb_build_object('state', 'submitted', 'store_name', v_store.name, 'logo_url', v_store.logo_url);
  end if;

  update public.review_invitations
  set first_opened_at = coalesce(first_opened_at, now())
  where id = v_invitation.id;

  return jsonb_build_object(
    'state', 'ready',
    'store_id', v_store.id,
    'store_slug', v_store.slug,
    'store_name', v_store.name,
    'logo_url', v_store.logo_url,
    'customer_name', public.mask_review_customer_name(v_order.customer_name),
    'order_number', coalesce(v_order.order_number, upper(left(v_order.id::text, 8))),
    'expires_at', v_invitation.expires_at,
    'show_review_photos', coalesce(v_settings.show_review_photos, true),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_item_id', item.id,
        'product_id', item.product_id,
        'product_name', item.product_name,
        'variant_label', item.variant_label,
        'image_url', item.image_url
      ) order by item.created_at, item.id)
      from (
        select distinct on (order_item.product_id)
          order_item.id,
          order_item.product_id,
          coalesce(order_item.product_name_snapshot, order_item.name, product.name) as product_name,
          order_item.variant_label_snapshot as variant_label,
          coalesce(order_item.product_image_url_snapshot, product.main_image_url) as image_url,
          order_item.created_at
        from public.order_items order_item
        join public.products product on product.id = order_item.product_id and product.store_id = v_store.id
        where order_item.order_id = v_order.id and order_item.product_id is not null
        order by order_item.product_id, order_item.created_at, order_item.id
      ) item
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_verified_product_reviews(p_token uuid, p_reviews jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.review_invitations%rowtype;
  v_order public.orders%rowtype;
  v_settings public.store_review_settings%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_order_item_id uuid;
  v_rating integer;
  v_title text;
  v_comment text;
  v_review_id uuid;
  v_status text;
  v_moderation text;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_reviews) <> 'array' or jsonb_array_length(p_reviews) < 1 or jsonb_array_length(p_reviews) > 25 then
    raise exception 'REVIEW_INVALID_PAYLOAD';
  end if;
  select * into v_invitation from public.review_invitations where token = p_token for update;
  if not found then raise exception 'REVIEW_INVALID_INVITATION'; end if;
  if v_invitation.expires_at <= now() then raise exception 'REVIEW_INVITATION_EXPIRED'; end if;
  if v_invitation.submitted_at is not null then raise exception 'REVIEW_ALREADY_SUBMITTED'; end if;

  select * into v_order from public.orders where id = v_invitation.order_id;
  select * into v_settings from public.store_review_settings where store_id = v_invitation.store_id;
  if v_order.status <> 'delivered' then raise exception 'REVIEW_ORDER_NOT_DELIVERED'; end if;
  if coalesce(v_settings.mode, 'disabled') = 'disabled' then raise exception 'REVIEWS_DISABLED'; end if;

  for v_item in select value from jsonb_array_elements(p_reviews)
  loop
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_order_item_id := nullif(v_item ->> 'order_item_id', '')::uuid;
      v_rating := (v_item ->> 'rating')::integer;
    exception when others then
      raise exception 'REVIEW_INVALID_ITEM';
    end;
    v_title := nullif(left(btrim(coalesce(v_item ->> 'title', '')), 120), '');
    v_comment := nullif(left(btrim(coalesce(v_item ->> 'comment', '')), 2000), '');
    if v_rating not between 1 and 5 then raise exception 'REVIEW_INVALID_RATING'; end if;
    if not exists (
      select 1 from public.order_items item
      where item.order_id = v_order.id
        and item.product_id = v_product_id
        and (v_order_item_id is null or item.id = v_order_item_id)
    ) then raise exception 'REVIEW_PRODUCT_NOT_PURCHASED'; end if;

    -- Links and contact-data-like patterns are held for review. Clean text
    -- follows the merchant's auto-publication preference.
    if coalesce(v_comment, '') ~* '(https?://|www\.|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,})' then
      v_status := 'pending';
      v_moderation := 'flagged';
    else
      v_status := case when v_settings.auto_publish then 'published' else 'pending' end;
      v_moderation := 'approved';
    end if;

    insert into public.product_reviews(
      store_id, invitation_id, order_id, product_id, order_item_id, rating,
      title, comment, customer_display_name, publication_status,
      moderation_status, rating_included, published_at
    ) values (
      v_invitation.store_id, v_invitation.id, v_order.id, v_product_id, v_order_item_id, v_rating,
      v_title, v_comment, public.mask_review_customer_name(v_order.customer_name), v_status,
      v_moderation, true, case when v_status = 'published' then now() else null end
    ) returning id into v_review_id;

    insert into public.product_review_events(review_id, store_id, event_type, to_status)
    values (v_review_id, v_invitation.store_id, 'submitted', v_status);
    v_results := v_results || jsonb_build_array(jsonb_build_object('product_id', v_product_id, 'review_id', v_review_id));
  end loop;

  update public.review_invitations set submitted_at = now() where id = v_invitation.id;
  return jsonb_build_object('reviews', v_results);
end;
$$;

create or replace function public.set_product_review_status(p_review_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review public.product_reviews%rowtype;
  v_event text;
begin
  select * into v_review from public.product_reviews where id = p_review_id for update;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if not (public.has_store_role(v_review.store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin()) then
    raise exception 'REVIEW_FORBIDDEN';
  end if;
  if p_status not in ('published', 'hidden', 'removed') then raise exception 'REVIEW_INVALID_STATUS'; end if;
  if p_status in ('hidden', 'removed') and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'REVIEW_REASON_REQUIRED';
  end if;

  v_event := case
    when p_status = 'published' and v_review.publication_status = 'hidden' then 'restored'
    when p_status = 'published' then 'published'
    when p_status = 'hidden' then 'hidden'
    else 'removed'
  end;

  update public.product_reviews set
    publication_status = p_status,
    moderation_status = case when p_status = 'removed' then 'rejected' else 'approved' end,
    rating_included = p_status <> 'removed',
    hidden_reason = case when p_status in ('hidden', 'removed') then left(btrim(p_reason), 500) else null end,
    hidden_at = case when p_status in ('hidden', 'removed') then now() else null end,
    hidden_by = case when p_status in ('hidden', 'removed') then auth.uid() else null end,
    published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
  where id = p_review_id;

  insert into public.product_review_events(review_id, store_id, event_type, from_status, to_status, reason, actor_user_id)
  values (p_review_id, v_review.store_id, v_event, v_review.publication_status, p_status, nullif(left(btrim(coalesce(p_reason, '')), 500), ''), auth.uid());
end;
$$;

create or replace function public.upsert_product_review_reply(p_review_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review public.product_reviews%rowtype;
  v_existed boolean;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into v_review from public.product_reviews where id = p_review_id;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  if not (public.has_store_role(v_review.store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin()) then
    raise exception 'REVIEW_FORBIDDEN';
  end if;
  if char_length(v_body) not between 1 and 1200 then raise exception 'REVIEW_REPLY_INVALID'; end if;
  select exists(select 1 from public.product_review_replies where review_id = p_review_id) into v_existed;

  insert into public.product_review_replies(review_id, store_id, body, replied_by)
  values (p_review_id, v_review.store_id, v_body, auth.uid())
  on conflict (review_id) do update set body = excluded.body, replied_by = excluded.replied_by, updated_at = now();

  insert into public.product_review_events(review_id, store_id, event_type, actor_user_id)
  values (p_review_id, v_review.store_id, case when v_existed then 'reply_updated' else 'replied' end, auth.uid());
end;
$$;

create or replace function public.get_store_review_dashboard(p_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_store_member(p_store_id) or public.is_platform_admin()) then raise exception 'REVIEW_FORBIDDEN'; end if;
  return (
    select jsonb_build_object(
      'total', count(*),
      'average', coalesce(round(avg(rating) filter (where rating_included), 2), 0),
      'published', count(*) filter (where publication_status = 'published'),
      'pending', count(*) filter (where publication_status = 'pending'),
      'hidden', count(*) filter (where publication_status = 'hidden'),
      'removed', count(*) filter (where publication_status = 'removed'),
      'with_reply', count(reply.id),
      'five', count(*) filter (where rating = 5 and rating_included),
      'four', count(*) filter (where rating = 4 and rating_included),
      'three', count(*) filter (where rating = 3 and rating_included),
      'two', count(*) filter (where rating = 2 and rating_included),
      'one', count(*) filter (where rating = 1 and rating_included),
      'best_products', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id', ranked.product_id,
          'product_name', ranked.product_name,
          'average', ranked.average,
          'count', ranked.review_count
        ) order by ranked.average desc, ranked.review_count desc, ranked.product_name)
        from (
          select product.id as product_id,
                 product.name as product_name,
                 round(avg(candidate.rating), 2) as average,
                 count(*)::integer as review_count
          from public.product_reviews candidate
          join public.products product on product.id = candidate.product_id
          where candidate.store_id = p_store_id and candidate.rating_included
          group by product.id, product.name
          order by average desc, review_count desc, product.name
          limit 5
        ) ranked
      ), '[]'::jsonb),
      'attention_products', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id', ranked.product_id,
          'product_name', ranked.product_name,
          'average', ranked.average,
          'count', ranked.review_count
        ) order by ranked.average, ranked.review_count desc, ranked.product_name)
        from (
          select product.id as product_id,
                 product.name as product_name,
                 round(avg(candidate.rating), 2) as average,
                 count(*)::integer as review_count
          from public.product_reviews candidate
          join public.products product on product.id = candidate.product_id
          where candidate.store_id = p_store_id and candidate.rating_included
          group by product.id, product.name
          having avg(candidate.rating) < 4
          order by average, review_count desc, product.name
          limit 5
        ) ranked
      ), '[]'::jsonb)
    )
    from public.product_reviews review
    left join public.product_review_replies reply on reply.review_id = review.id
    where review.store_id = p_store_id
  );
end;
$$;

-- Only deliberately public projections leave the database. Raw orders,
-- invitation tokens and merchant audit data never appear in these views.
create or replace view public.public_store_review_settings
with (security_invoker = false)
as
select store.slug as store_slug,
       settings.mode,
       settings.show_rating_on_cards,
       settings.show_product_reviews,
       settings.show_review_photos
from public.store_review_settings settings
join public.stores store on store.id = settings.store_id
where store.status = 'active';

create or replace view public.public_product_review_summaries
with (security_invoker = false)
as
select review.product_id,
       review.store_id,
       round(avg(review.rating)::numeric, 2) as average_rating,
       count(*)::integer as review_count,
       count(*) filter (where review.rating = 5)::integer as five_count,
       count(*) filter (where review.rating = 4)::integer as four_count,
       count(*) filter (where review.rating = 3)::integer as three_count,
       count(*) filter (where review.rating = 2)::integer as two_count,
       count(*) filter (where review.rating = 1)::integer as one_count
from public.product_reviews review
join public.store_review_settings settings on settings.store_id = review.store_id
join public.stores store on store.id = review.store_id
where settings.mode = 'public'
  and store.status = 'active'
  and review.rating_included = true
  and review.moderation_status <> 'rejected'
  and review.publication_status in ('published', 'hidden')
group by review.product_id, review.store_id;

create or replace view public.public_product_reviews
with (security_invoker = false)
as
select review.id,
       review.product_id,
       review.rating,
       review.title,
       review.comment,
       review.customer_display_name,
       review.created_at,
       reply.body as merchant_reply,
       reply.created_at as merchant_replied_at
from public.product_reviews review
join public.store_review_settings settings on settings.store_id = review.store_id
join public.stores store on store.id = review.store_id
left join public.product_review_replies reply on reply.review_id = review.id
where settings.mode = 'public'
  and settings.show_product_reviews = true
  and store.status = 'active'
  and review.publication_status = 'published'
  and review.moderation_status = 'approved';

create or replace view public.public_product_review_images
with (security_invoker = false)
as
select image.id, image.review_id, image.image_url, image.sort_order
from public.product_review_images image
join public.product_reviews review on review.id = image.review_id
join public.store_review_settings settings on settings.store_id = review.store_id
join public.stores store on store.id = review.store_id
where settings.mode = 'public'
  and settings.show_product_reviews = true
  and settings.show_review_photos = true
  and store.status = 'active'
  and review.publication_status = 'published'
  and review.moderation_status = 'approved';

revoke all on public.public_store_review_settings, public.public_product_review_summaries,
  public.public_product_reviews, public.public_product_review_images from public, anon, authenticated;
grant select on public.public_store_review_settings, public.public_product_review_summaries,
  public.public_product_reviews, public.public_product_review_images to anon, authenticated;

revoke all on function public.ensure_order_review_invitation(uuid), public.get_review_invitation(uuid),
  public.submit_verified_product_reviews(uuid, jsonb), public.set_product_review_status(uuid, text, text),
  public.upsert_product_review_reply(uuid, text), public.get_store_review_dashboard(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_order_review_invitation(uuid), public.set_product_review_status(uuid, text, text),
  public.upsert_product_review_reply(uuid, text), public.get_store_review_dashboard(uuid) to authenticated;
grant execute on function public.get_review_invitation(uuid), public.submit_verified_product_reviews(uuid, jsonb)
  to anon, authenticated;
grant execute on function public.ensure_order_review_invitation(uuid), public.get_review_invitation(uuid),
  public.submit_verified_product_reviews(uuid, jsonb), public.set_product_review_status(uuid, text, text),
  public.upsert_product_review_reply(uuid, text), public.get_store_review_dashboard(uuid) to service_role;

comment on table public.product_reviews is
  'Verified product reviews linked to delivered orders. Hidden content keeps rating_included=true; removed policy violations do not.';
comment on function public.submit_verified_product_reviews(uuid, jsonb) is
  'Single-use public submission path. Server validates delivery, purchased products, expiry and store settings.';
