-- Professional order corrections and amendments.
--
-- Two deliberately separate operations are exposed to the panel:
--   1. update_store_order_details: corrects customer/contact/delivery data.
--   2. amend_store_order_items: adjusts/removes existing lines while the
--      order is still operationally reversible (COD + pending/confirmed).
--
-- Both operations lock the order, use optimistic concurrency, write an
-- immutable audit event and keep notification recipients/inventory in sync.

create table if not exists public.order_change_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  change_type text not null,
  changed_fields text[] not null default '{}',
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  reason text not null,
  actor_user_id uuid,
  actor_name text,
  created_at timestamptz not null default now(),
  constraint order_change_events_type_valid check (
    change_type in ('customer_delivery', 'items')
  ),
  constraint order_change_events_reason_length check (
    char_length(reason) between 5 and 500
  )
);

create index if not exists order_change_events_order_created_idx
  on public.order_change_events(order_id, created_at desc);
create index if not exists order_change_events_store_created_idx
  on public.order_change_events(store_id, created_at desc);

alter table public.order_change_events enable row level security;

create policy "order_change_events_select_platform_admin"
  on public.order_change_events for select to authenticated
  using (public.is_platform_admin());

create policy "order_change_events_select_store_member"
  on public.order_change_events for select to authenticated
  using (public.is_store_member(store_id));

revoke all on public.order_change_events from anon, authenticated;
grant select on public.order_change_events to authenticated;
grant all on public.order_change_events to service_role;

comment on table public.order_change_events is
  'Immutable audit trail for panel-originated order corrections and line amendments. Snapshots are visible only to store members.';

create or replace function public.prevent_order_change_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'ORDER_CHANGE_EVENTS_ARE_IMMUTABLE';
end;
$$;

drop trigger if exists order_change_events_immutable on public.order_change_events;
create trigger order_change_events_immutable
  before update or delete on public.order_change_events
  for each row execute function public.prevent_order_change_event_mutation();

-- Customer and delivery fields must go through the audited RPC. Status,
-- payment and dispatch RPCs remain unaffected.
create or replace function public.protect_order_customer_delivery_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.customer_name is distinct from new.customer_name
     or old.customer_phone is distinct from new.customer_phone
     or old.customer_email is distinct from new.customer_email
     or old.shipping_address is distinct from new.shipping_address
     or old.city is distinct from new.city
     or old.department is distinct from new.department
     or old.delivery_neighborhood is distinct from new.delivery_neighborhood
     or old.delivery_reference is distinct from new.delivery_reference
     or old.notes is distinct from new.notes then
    if coalesce(current_setting('app.audited_order_edit', true), '') <> 'true'
       and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'USE_AUDITED_ORDER_EDIT';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_protect_customer_delivery_fields on public.orders;
create trigger orders_protect_customer_delivery_fields
  before update on public.orders
  for each row execute function public.protect_order_customer_delivery_fields();

create or replace function public.update_store_order_details(
  p_order_id uuid,
  p_expected_updated_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_shipping_address text,
  p_city text,
  p_department text,
  p_delivery_neighborhood text,
  p_delivery_reference text,
  p_notes text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_normalized_phone text;
  v_normalized_email text;
  v_name text := nullif(btrim(p_customer_name), '');
  v_address text := nullif(btrim(p_shipping_address), '');
  v_city text := nullif(btrim(p_city), '');
  v_department text := nullif(btrim(p_department), '');
  v_neighborhood text := nullif(btrim(p_delivery_neighborhood), '');
  v_reference text := nullif(btrim(p_delivery_reference), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_reason text := nullif(btrim(p_reason), '');
  v_before jsonb;
  v_after jsonb;
  v_fields text[] := '{}';
  v_actor_name text;
  v_recipient_phone text;
  v_store_country text;
begin
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (public.has_store_role(v_order.store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin()) then
    raise exception 'INSUFFICIENT_PERMISSIONS';
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'ORDER_DETAILS_LOCKED';
  end if;
  if p_expected_updated_at is null or v_order.updated_at is distinct from p_expected_updated_at then
    raise exception 'ORDER_CHANGED_RELOAD';
  end if;
  if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'INVALID_CHANGE_REASON';
  end if;
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'INVALID_CUSTOMER_NAME';
  end if;

  v_normalized_phone := public.normalize_colombian_mobile_phone(p_customer_phone);
  if v_normalized_phone is null then raise exception 'INVALID_CUSTOMER_PHONE'; end if;

  v_normalized_email := public.normalize_transactional_email(p_customer_email);
  if nullif(btrim(p_customer_email), '') is not null and v_normalized_email is null then
    raise exception 'INVALID_CUSTOMER_EMAIL';
  end if;

  if v_order.fulfillment_method <> 'pickup' then
    if v_address is null or char_length(v_address) < 5 or char_length(v_address) > 250 then
      raise exception 'INVALID_SHIPPING_ADDRESS';
    end if;
    if v_city is null or char_length(v_city) > 100 then
      raise exception 'INVALID_DELIVERY_CITY';
    end if;
  end if;
  if char_length(coalesce(v_department, '')) > 100
     or char_length(coalesce(v_neighborhood, '')) > 120
     or char_length(coalesce(v_reference, '')) > 250
     or char_length(coalesce(v_notes, '')) > 1000 then
    raise exception 'ORDER_DETAIL_TOO_LONG';
  end if;

  -- Pickup orders do not carry delivery-address data. Normalize before
  -- comparing snapshots so a caller cannot generate a fictitious change.
  if v_order.fulfillment_method = 'pickup' then
    v_address := null;
    v_city := null;
    v_department := null;
    v_neighborhood := null;
    v_reference := null;
  end if;

  v_before := jsonb_build_object(
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'customer_email', v_order.customer_email,
    'shipping_address', v_order.shipping_address,
    'city', v_order.city,
    'department', v_order.department,
    'delivery_neighborhood', v_order.delivery_neighborhood,
    'delivery_reference', v_order.delivery_reference,
    'notes', v_order.notes
  );

  if v_order.customer_name is distinct from v_name then v_fields := array_append(v_fields, 'customer_name'); end if;
  if v_order.customer_phone is distinct from v_normalized_phone then v_fields := array_append(v_fields, 'customer_phone'); end if;
  if v_order.customer_email is distinct from v_normalized_email then v_fields := array_append(v_fields, 'customer_email'); end if;
  if v_order.shipping_address is distinct from v_address then v_fields := array_append(v_fields, 'shipping_address'); end if;
  if v_order.city is distinct from v_city then v_fields := array_append(v_fields, 'city'); end if;
  if v_order.department is distinct from v_department then v_fields := array_append(v_fields, 'department'); end if;
  if v_order.delivery_neighborhood is distinct from v_neighborhood then v_fields := array_append(v_fields, 'delivery_neighborhood'); end if;
  if v_order.delivery_reference is distinct from v_reference then v_fields := array_append(v_fields, 'delivery_reference'); end if;
  if v_order.notes is distinct from v_notes then v_fields := array_append(v_fields, 'notes'); end if;

  if cardinality(v_fields) = 0 then
    return jsonb_build_object('order_id', v_order.id, 'changed', false, 'updated_at', v_order.updated_at);
  end if;

  perform set_config('app.audited_order_edit', 'true', true);
  update public.orders
     set customer_name = v_name,
         customer_phone = v_normalized_phone,
         customer_email = v_normalized_email,
         shipping_address = case when fulfillment_method = 'pickup' then null else v_address end,
         city = case when fulfillment_method = 'pickup' then null else v_city end,
         department = case when fulfillment_method = 'pickup' then null else v_department end,
         delivery_neighborhood = case when fulfillment_method = 'pickup' then null else v_neighborhood end,
         delivery_reference = case when fulfillment_method = 'pickup' then null else v_reference end,
         notes = v_notes,
         updated_at = now()
   where id = v_order.id;

  select * into v_order from public.orders where id = p_order_id;
  v_after := jsonb_build_object(
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'customer_email', v_order.customer_email,
    'shipping_address', v_order.shipping_address,
    'city', v_order.city,
    'department', v_order.department,
    'delivery_neighborhood', v_order.delivery_neighborhood,
    'delivery_reference', v_order.delivery_reference,
    'notes', v_order.notes
  );

  select coalesce(nullif(btrim(full_name), ''), nullif(btrim(email), ''), 'Usuario del panel')
    into v_actor_name
    from public.profiles
   where user_id = auth.uid();

  insert into public.order_change_events (
    store_id, order_id, change_type, changed_fields,
    before_snapshot, after_snapshot, reason, actor_user_id, actor_name
  ) values (
    v_order.store_id, v_order.id, 'customer_delivery', v_fields,
    v_before, v_after, v_reason, auth.uid(), coalesce(v_actor_name, 'Usuario del panel')
  );

  -- Only untouched outbox rows are redirected. Once a provider attempt has
  -- begun, changing its recipient would make delivery semantics ambiguous.
  if 'customer_phone' = any(v_fields) then
    select country into v_store_country from public.stores where id = v_order.store_id;
    v_recipient_phone := public.normalize_whatsapp_phone(v_normalized_phone, coalesce(v_store_country, 'CO'));
    update public.whatsapp_notifications
       set recipient_phone = v_recipient_phone,
           template_params = null,
           updated_at = now()
     where order_id = v_order.id
       and status = 'queued'
       and attempts = 0
       and locked_at is null;
  end if;

  if 'customer_email' = any(v_fields) or 'customer_name' = any(v_fields) then
    if v_normalized_email is not null then
      update public.email_notifications
         set recipient_email = v_normalized_email,
             recipient_name = v_name,
             updated_at = now()
       where order_id = v_order.id
         and recipient_type = 'customer'
         and status = 'queued'
         and attempts = 0
         and locked_at is null;
    else
      update public.email_notifications
         set status = 'invalid_recipient',
             is_permanent_failure = true,
             last_error_category = 'recipient_removed',
             last_error_code = 'RECIPIENT_REMOVED',
             last_error_message = 'El correo fue retirado antes del envío.',
             failed_at = now(),
             updated_at = now()
       where order_id = v_order.id
         and recipient_type = 'customer'
         and status = 'queued'
         and attempts = 0
         and locked_at is null;
    end if;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'changed', true,
    'changed_fields', to_jsonb(v_fields),
    'updated_at', v_order.updated_at
  );
end;
$$;

revoke all on function public.update_store_order_details(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.update_store_order_details(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text, text
) to authenticated, service_role;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_type_valid;
alter table public.inventory_movements
  add constraint inventory_movements_type_valid check (movement_type in (
    'stock_in', 'stock_out', 'manual_adjustment', 'damaged', 'lost', 'returned', 'correction',
    'order_placed', 'order_cancelled', 'order_amended', 'order_amendment_reversal',
    'checkout_reserved', 'checkout_released'
  ));

create or replace function public.amend_store_order_items(
  p_order_id uuid,
  p_expected_updated_at timestamptz,
  p_items jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_before jsonb;
  v_after jsonb;
  v_movement record;
  v_line record;
  v_stock_before integer;
  v_stock_after integer;
  v_stock_policy text;
  v_track_inventory boolean;
  v_desired_qty integer;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_total numeric := 0;
  v_settings record;
  v_actor_name text;
  v_changed_fields text[] := array['items'];
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (public.has_store_role(v_order.store_id, array['owner', 'admin', 'staff']) or public.is_platform_admin()) then
    raise exception 'INSUFFICIENT_PERMISSIONS';
  end if;
  if v_order.status not in ('pending', 'confirmed') then
    raise exception 'ORDER_ITEMS_LOCKED_BY_STATUS';
  end if;
  if v_order.payment_method <> 'cash_on_delivery' or v_order.payment_status not in ('pending', 'failed') then
    raise exception 'ORDER_ITEMS_LOCKED_BY_PAYMENT';
  end if;
  if p_expected_updated_at is null or v_order.updated_at is distinct from p_expected_updated_at then
    raise exception 'ORDER_CHANGED_RELOAD';
  end if;
  if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'INVALID_CHANGE_REASON';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_ORDER_ITEMS';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct value->>'order_item_id') from jsonb_array_elements(p_items)) then
    raise exception 'DUPLICATE_ORDER_ITEM';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
     where nullif(item->>'order_item_id', '') is null
        or coalesce((item->>'quantity')::integer, 0) not between 1 and 999
        or not exists (
          select 1 from public.order_items oi
           where oi.id = (item->>'order_item_id')::uuid and oi.order_id = v_order.id
        )
  ) then
    raise exception 'INVALID_ORDER_ITEM';
  end if;

  perform 1 from public.order_items where order_id = v_order.id for update;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', oi.id,
           'product_id', oi.product_id,
           'variant_id', oi.variant_id,
           'offer_id', oi.offer_id,
           'name', oi.name,
           'quantity', oi.quantity,
           'unit_price', oi.unit_price,
           'total_price', oi.total_price,
           'customer_note', oi.customer_note,
           'customizations_snapshot', oi.customizations_snapshot,
           'customizations', (
             select coalesce(jsonb_agg(jsonb_build_object(
               'option_group_name', oic.option_group_name,
               'option_item_label', oic.option_item_label,
               'price_delta', oic.price_delta
             ) order by oic.created_at), '[]'::jsonb)
             from public.order_item_customizations oic
             where oic.order_item_id = oi.id
           )
         ) order by oi.created_at), '[]'::jsonb)
    into v_before
    from public.order_items oi where oi.order_id = v_order.id;

  -- A retry carrying the exact same desired state is idempotent: it must
  -- not churn inventory or create a misleading audit entry.
  if (select count(*) from public.order_items where order_id = v_order.id) = jsonb_array_length(p_items)
     and not exists (
       select 1
         from public.order_items oi
        where oi.order_id = v_order.id
          and oi.quantity is distinct from (
            select (item->>'quantity')::integer
              from jsonb_array_elements(p_items) item
             where (item->>'order_item_id')::uuid = oi.id
          )
     ) then
    return jsonb_build_object(
      'order_id', v_order.id,
      'changed', false,
      'subtotal', v_order.subtotal,
      'shipping_amount', v_order.shipping_amount,
      'total_amount', v_order.total_amount
    );
  end if;

  -- Return the order's complete current reservation before applying the new
  -- quantities. Summing the ledger makes repeated amendments exact.
  for v_movement in
    select product_id, variant_id, sum(quantity_change)::integer as net_change
      from public.inventory_movements
     where order_id = v_order.id
       and movement_type in ('order_placed', 'order_amended', 'order_amendment_reversal')
     group by product_id, variant_id
    having sum(quantity_change) < 0
  loop
    if v_movement.variant_id is not null then
      select stock_quantity into v_stock_before
        from public.product_variants where id = v_movement.variant_id for update;
      v_stock_after := v_stock_before + abs(v_movement.net_change);
      update public.product_variants set stock_quantity = v_stock_after, updated_at = now()
       where id = v_movement.variant_id;
    else
      select stock into v_stock_before
        from public.products where id = v_movement.product_id for update;
      v_stock_after := v_stock_before + abs(v_movement.net_change);
      update public.products set stock = v_stock_after, updated_at = now()
       where id = v_movement.product_id;
    end if;

    insert into public.inventory_movements (
      store_id, product_id, variant_id, store_location_id, order_id,
      movement_type, reason, quantity_change, stock_before, stock_after, created_by
    ) values (
      v_order.store_id, v_movement.product_id, v_movement.variant_id, v_order.store_location_id, v_order.id,
      'order_amendment_reversal', 'Liberación previa a modificación del pedido',
      abs(v_movement.net_change), v_stock_before, v_stock_after, auth.uid()
    );
  end loop;

  delete from public.order_items oi
   where oi.order_id = v_order.id
     and not exists (
       select 1 from jsonb_array_elements(p_items) item
        where (item->>'order_item_id')::uuid = oi.id
     );

  for v_line in
    select oi.*,
           (select (item->>'quantity')::integer
              from jsonb_array_elements(p_items) item
             where (item->>'order_item_id')::uuid = oi.id) as desired_quantity
      from public.order_items oi
     where oi.order_id = v_order.id
     order by oi.created_at
  loop
    v_desired_qty := v_line.desired_quantity;
    update public.order_items
       set quantity = v_desired_qty,
           total_price = unit_price * v_desired_qty
     where id = v_line.id;

    if v_line.variant_id is not null then
      select stock_quantity, stock_policy into v_stock_before, v_stock_policy
        from public.product_variants
       where id = v_line.variant_id and store_id = v_order.store_id
       for update;
      if not found then raise exception 'ORDER_ITEM_VARIANT_UNAVAILABLE'; end if;
      if v_stock_policy = 'deny' and v_stock_before < v_desired_qty then
        raise exception 'INSUFFICIENT_STOCK:%', v_line.variant_id;
      end if;
      v_stock_after := greatest(v_stock_before - v_desired_qty, 0);
      if v_stock_after <> v_stock_before then
        update public.product_variants set stock_quantity = v_stock_after, updated_at = now()
         where id = v_line.variant_id;
        insert into public.inventory_movements (
          store_id, product_id, variant_id, store_location_id, order_id, order_item_id,
          movement_type, reason, quantity_change, stock_before, stock_after, created_by
        ) values (
          v_order.store_id, v_line.product_id, v_line.variant_id, v_order.store_location_id, v_order.id, v_line.id,
          'order_amended', 'Reserva después de modificar el pedido',
          v_stock_after - v_stock_before, v_stock_before, v_stock_after, auth.uid()
        );
      end if;
    elsif v_line.product_id is not null then
      select stock, track_inventory into v_stock_before, v_track_inventory
        from public.products
       where id = v_line.product_id and store_id = v_order.store_id
       for update;
      if not found then raise exception 'ORDER_ITEM_PRODUCT_UNAVAILABLE'; end if;
      if v_track_inventory then
        if v_stock_before < v_desired_qty then
          raise exception 'INSUFFICIENT_STOCK:%', v_line.product_id;
        end if;
        v_stock_after := v_stock_before - v_desired_qty;
        update public.products set stock = v_stock_after, updated_at = now()
         where id = v_line.product_id;
        insert into public.inventory_movements (
          store_id, product_id, store_location_id, order_id, order_item_id,
          movement_type, reason, quantity_change, stock_before, stock_after, created_by
        ) values (
          v_order.store_id, v_line.product_id, v_order.store_location_id, v_order.id, v_line.id,
          'order_amended', 'Reserva después de modificar el pedido',
          v_stock_after - v_stock_before, v_stock_before, v_stock_after, auth.uid()
        );
      end if;
    end if;
  end loop;

  select coalesce(sum(total_price), 0) into v_subtotal
    from public.order_items where order_id = v_order.id;
  select local_delivery_base_fee, local_delivery_free_from,
         national_shipping_base_fee, national_shipping_free_from
    into v_settings
    from public.store_commerce_settings where store_id = v_order.store_id;

  if v_order.fulfillment_method in ('local_delivery', 'delivery') then
    v_shipping := case
      when v_settings.local_delivery_free_from is not null and v_subtotal >= v_settings.local_delivery_free_from then 0
      else coalesce(v_settings.local_delivery_base_fee, 0) end;
  elsif v_order.fulfillment_method = 'national_shipping' then
    v_shipping := case
      when v_settings.national_shipping_free_from is not null and v_subtotal >= v_settings.national_shipping_free_from then 0
      else coalesce(v_settings.national_shipping_base_fee, 0) end;
  end if;
  v_total := greatest(v_subtotal + v_shipping - v_order.discount_amount, 0);

  update public.orders
     set subtotal = v_subtotal,
         shipping_amount = v_shipping,
         total_amount = v_total,
         updated_at = now()
   where id = v_order.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', oi.id,
           'product_id', oi.product_id,
           'variant_id', oi.variant_id,
           'offer_id', oi.offer_id,
           'name', oi.name,
           'quantity', oi.quantity,
           'unit_price', oi.unit_price,
           'total_price', oi.total_price,
           'customer_note', oi.customer_note,
           'customizations_snapshot', oi.customizations_snapshot,
           'customizations', (
             select coalesce(jsonb_agg(jsonb_build_object(
               'option_group_name', oic.option_group_name,
               'option_item_label', oic.option_item_label,
               'price_delta', oic.price_delta
             ) order by oic.created_at), '[]'::jsonb)
             from public.order_item_customizations oic
             where oic.order_item_id = oi.id
           )
         ) order by oi.created_at), '[]'::jsonb)
    into v_after
    from public.order_items oi where oi.order_id = v_order.id;

  if v_order.subtotal is distinct from v_subtotal then
    v_changed_fields := array_append(v_changed_fields, 'subtotal');
  end if;
  if v_order.shipping_amount is distinct from v_shipping then
    v_changed_fields := array_append(v_changed_fields, 'shipping_amount');
  end if;
  if v_order.total_amount is distinct from v_total then
    v_changed_fields := array_append(v_changed_fields, 'total_amount');
  end if;
  select coalesce(nullif(btrim(full_name), ''), nullif(btrim(email), ''), 'Usuario del panel')
    into v_actor_name from public.profiles where user_id = auth.uid();

  insert into public.order_change_events (
    store_id, order_id, change_type, changed_fields,
    before_snapshot, after_snapshot, reason, actor_user_id, actor_name
  ) values (
    v_order.store_id, v_order.id, 'items', v_changed_fields,
    jsonb_build_object('items', v_before, 'subtotal', v_order.subtotal, 'shipping_amount', v_order.shipping_amount, 'total_amount', v_order.total_amount),
    jsonb_build_object('items', v_after, 'subtotal', v_subtotal, 'shipping_amount', v_shipping, 'total_amount', v_total),
    v_reason, auth.uid(), coalesce(v_actor_name, 'Usuario del panel')
  );

  return jsonb_build_object(
    'order_id', v_order.id,
    'changed', true,
    'subtotal', v_subtotal,
    'shipping_amount', v_shipping,
    'total_amount', v_total
  );
end;
$$;

revoke all on function public.amend_store_order_items(uuid, timestamptz, jsonb, text) from public, anon;
grant execute on function public.amend_store_order_items(uuid, timestamptz, jsonb, text) to authenticated, service_role;

-- Cancellation now restores the order's net inventory footprint, including
-- orders that originated from Wompi reservations and orders amended above.
create or replace function public.cancel_store_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_movement record;
  v_stock_before integer;
  v_stock_after integer;
  v_reversed_count integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (public.has_store_role(v_order.store_id, array['owner', 'admin']) or public.is_platform_admin()) then
    raise exception 'INSUFFICIENT_PERMISSIONS';
  end if;
  if v_order.status = 'cancelled' then raise exception 'ORDER_ALREADY_CANCELLED'; end if;
  if v_order.status = 'delivered' then raise exception 'ORDER_ALREADY_DELIVERED'; end if;

  for v_movement in
    select product_id, variant_id, sum(quantity_change)::integer as net_change
      from public.inventory_movements
     where order_id = v_order.id
       and movement_type in (
         'order_placed', 'order_amended', 'order_amendment_reversal',
         'checkout_reserved', 'checkout_released'
       )
     group by product_id, variant_id
    having sum(quantity_change) < 0
  loop
    if v_movement.variant_id is not null then
      select stock_quantity into v_stock_before from public.product_variants
       where id = v_movement.variant_id for update;
      v_stock_after := v_stock_before + abs(v_movement.net_change);
      update public.product_variants set stock_quantity = v_stock_after, updated_at = now()
       where id = v_movement.variant_id;
    else
      select stock into v_stock_before from public.products
       where id = v_movement.product_id for update;
      v_stock_after := v_stock_before + abs(v_movement.net_change);
      update public.products set stock = v_stock_after, updated_at = now()
       where id = v_movement.product_id;
    end if;

    insert into public.inventory_movements (
      store_id, product_id, variant_id, store_location_id, order_id,
      movement_type, reason, quantity_change, stock_before, stock_after, created_by
    ) values (
      v_order.store_id, v_movement.product_id, v_movement.variant_id, v_order.store_location_id, v_order.id,
      'order_cancelled', 'Pedido cancelado — reposición neta de inventario',
      abs(v_movement.net_change), v_stock_before, v_stock_after, auth.uid()
    );
    v_reversed_count := v_reversed_count + 1;
  end loop;

  update public.orders set status = 'cancelled', updated_at = now() where id = v_order.id;
  return jsonb_build_object(
    'order_id', v_order.id,
    'status', 'cancelled',
    'stock_movements_reversed', v_reversed_count
  );
end;
$$;

revoke all on function public.cancel_store_order(uuid) from public, anon;
grant execute on function public.cancel_store_order(uuid) to authenticated, service_role;
