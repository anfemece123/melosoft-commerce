-- Professional menu modifiers backed by real catalog products.
--
-- A modifier can remain a simple label/price ("sin cebolla", "salsa BBQ")
-- or point to a real product/variant ("Gaseosa / 400 ml"). Linked options
-- share the catalog price when requested and always share inventory.

alter table public.product_option_items
  add column if not exists linked_product_id uuid null,
  add column if not exists linked_variant_id uuid null,
  add column if not exists linked_quantity integer not null default 1,
  add column if not exists price_mode text not null default 'custom';

alter table public.product_option_items
  drop constraint if exists product_option_items_linked_product_fkey,
  add constraint product_option_items_linked_product_fkey
    foreign key (linked_product_id) references public.products(id) on delete cascade,
  drop constraint if exists product_option_items_linked_variant_fkey,
  add constraint product_option_items_linked_variant_fkey
    foreign key (linked_variant_id) references public.product_variants(id) on delete cascade,
  drop constraint if exists product_option_items_linked_quantity_valid,
  add constraint product_option_items_linked_quantity_valid
    check (linked_quantity between 1 and 100),
  drop constraint if exists product_option_items_price_mode_valid,
  add constraint product_option_items_price_mode_valid
    check (price_mode in ('custom', 'catalog')),
  drop constraint if exists product_option_items_link_pair_valid,
  add constraint product_option_items_link_pair_valid
    check (linked_variant_id is null or linked_product_id is not null),
  drop constraint if exists product_option_items_catalog_price_requires_link,
  add constraint product_option_items_catalog_price_requires_link
    check (price_mode <> 'catalog' or linked_product_id is not null);

create index if not exists idx_product_option_items_linked_product
  on public.product_option_items(linked_product_id)
  where linked_product_id is not null;
create index if not exists idx_product_option_items_linked_variant
  on public.product_option_items(linked_variant_id)
  where linked_variant_id is not null;

alter table public.order_item_customizations
  add column if not exists linked_product_id_snapshot uuid null,
  add column if not exists linked_variant_id_snapshot uuid null,
  add column if not exists linked_quantity_snapshot integer null;

alter table public.order_item_customizations
  drop constraint if exists order_item_customizations_linked_quantity_snapshot_valid,
  add constraint order_item_customizations_linked_quantity_snapshot_valid
    check (linked_quantity_snapshot is null or linked_quantity_snapshot between 1 and 100);

create or replace function public.prepare_catalog_linked_option_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent_product_id uuid;
  v_parent_store_id uuid;
  v_linked_product public.products%rowtype;
  v_linked_variant public.product_variants%rowtype;
begin
  select g.product_id, g.store_id
    into v_parent_product_id, v_parent_store_id
    from public.product_option_groups g
   where g.id = new.group_id;
  if not found then raise exception 'INVALID_OPTION_GROUP'; end if;
  if new.store_id is distinct from v_parent_store_id then
    raise exception 'OPTION_STORE_MISMATCH';
  end if;

  if new.linked_product_id is null then
    new.linked_variant_id := null;
    new.linked_quantity := 1;
    new.price_mode := 'custom';
    return new;
  end if;

  if new.linked_product_id = v_parent_product_id then
    raise exception 'OPTION_CANNOT_LINK_PARENT_PRODUCT';
  end if;

  select * into v_linked_product
    from public.products
   where id = new.linked_product_id and store_id = v_parent_store_id;
  if not found then raise exception 'INVALID_LINKED_PRODUCT'; end if;

  if new.linked_variant_id is not null then
    select * into v_linked_variant
      from public.product_variants
     where id = new.linked_variant_id
       and product_id = new.linked_product_id
       and store_id = v_parent_store_id;
    if not found then raise exception 'INVALID_LINKED_VARIANT'; end if;
  elsif v_linked_product.has_variants then
    raise exception 'LINKED_VARIANT_REQUIRED';
  end if;

  if new.price_mode = 'catalog' then
    new.price_delta := coalesce(
      case when new.linked_variant_id is not null then v_linked_variant.price end,
      v_linked_product.sale_price,
      v_linked_product.regular_price
    );
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_catalog_linked_option_item on public.product_option_items;
create trigger prepare_catalog_linked_option_item
  before insert or update of group_id, store_id, linked_product_id, linked_variant_id,
    linked_quantity, price_mode, price_delta
  on public.product_option_items
  for each row execute function public.prepare_catalog_linked_option_item();

create or replace function public.sync_catalog_linked_option_prices()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'products' then
    update public.product_option_items i
       set price_delta = coalesce(v.price, new.sale_price, new.regular_price),
           updated_at = now()
      from public.product_variants v
     where i.linked_product_id = new.id
       and i.linked_variant_id = v.id
       and i.price_mode = 'catalog';

    update public.product_option_items i
       set price_delta = coalesce(new.sale_price, new.regular_price),
           updated_at = now()
     where i.linked_product_id = new.id
       and i.linked_variant_id is null
       and i.price_mode = 'catalog';
  else
    update public.product_option_items i
       set price_delta = coalesce(new.price, p.sale_price, p.regular_price),
           updated_at = now()
      from public.products p
     where i.linked_variant_id = new.id
       and i.linked_product_id = p.id
       and i.price_mode = 'catalog';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_catalog_linked_option_product_price on public.products;
create trigger sync_catalog_linked_option_product_price
  after update of regular_price, sale_price on public.products
  for each row execute function public.sync_catalog_linked_option_prices();
drop trigger if exists sync_catalog_linked_option_variant_price on public.product_variants;
create trigger sync_catalog_linked_option_variant_price
  after update of price on public.product_variants
  for each row execute function public.sync_catalog_linked_option_prices();

-- Save the entire editor in one transaction. A validation error can no
-- longer leave a product with all its option groups accidentally deleted.
create or replace function public.replace_product_option_groups(
  p_store_id uuid,
  p_product_id uuid,
  p_groups jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group jsonb;
  v_item jsonb;
  v_group_id uuid;
  v_group_index integer := 0;
  v_item_index integer;
  v_min integer;
  v_max integer;
begin
  if not (
    auth.role() = 'service_role'
    or public.has_store_role(p_store_id, array['owner', 'admin', 'staff'])
    or public.is_platform_admin()
  ) then
    raise exception 'INSUFFICIENT_PERMISSIONS';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and store_id = p_store_id) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if p_groups is null or jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) > 30 then
    raise exception 'INVALID_OPTION_GROUPS';
  end if;

  delete from public.product_option_groups where product_id = p_product_id;

  for v_group in select value from jsonb_array_elements(p_groups)
  loop
    if nullif(btrim(v_group->>'name'), '') is null
       or jsonb_typeof(coalesce(v_group->'items', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(v_group->'items', '[]'::jsonb)) < 1
       or jsonb_array_length(coalesce(v_group->'items', '[]'::jsonb)) > 100 then
      raise exception 'INVALID_OPTION_GROUP';
    end if;

    v_min := greatest(coalesce((v_group->>'min_select')::integer, 0), 0);
    v_max := nullif(v_group->>'max_select', '')::integer;
    if coalesce(v_group->>'selection_type', 'single') = 'single' then v_max := 1; end if;
    if v_max is not null and (v_max < 1 or v_max < v_min) then
      raise exception 'INVALID_OPTION_LIMITS:%', v_group->>'name';
    end if;

    insert into public.product_option_groups (
      store_id, product_id, owner_id, name, description, selection_type,
      min_select, max_select, is_required, is_active, sort_order
    ) values (
      p_store_id, p_product_id, auth.uid(), btrim(v_group->>'name'),
      nullif(btrim(v_group->>'description'), ''),
      coalesce(v_group->>'selection_type', 'single'), v_min, v_max,
      coalesce((v_group->>'is_required')::boolean, false),
      coalesce((v_group->>'is_active')::boolean, true), v_group_index
    ) returning id into v_group_id;

    v_item_index := 0;
    for v_item in select value from jsonb_array_elements(v_group->'items')
    loop
      if nullif(btrim(v_item->>'label'), '') is null then raise exception 'INVALID_OPTION_ITEM'; end if;
      insert into public.product_option_items (
        store_id, group_id, owner_id, label, description, price_delta,
        is_default, is_active, sort_order, linked_product_id,
        linked_variant_id, linked_quantity, price_mode
      ) values (
        p_store_id, v_group_id, auth.uid(), btrim(v_item->>'label'),
        nullif(btrim(v_item->>'description'), ''),
        greatest(coalesce((v_item->>'price_delta')::numeric, 0), 0),
        coalesce((v_item->>'is_default')::boolean, false),
        coalesce((v_item->>'is_active')::boolean, true), v_item_index,
        nullif(v_item->>'linked_product_id', '')::uuid,
        nullif(v_item->>'linked_variant_id', '')::uuid,
        greatest(coalesce((v_item->>'linked_quantity')::integer, 1), 1),
        coalesce(nullif(v_item->>'price_mode', ''), 'custom')
      );
      v_item_index := v_item_index + 1;
    end loop;
    v_group_index := v_group_index + 1;
  end loop;

  return jsonb_build_object('saved', true, 'groups', v_group_index);
end;
$$;

revoke all on function public.replace_product_option_groups(uuid, uuid, jsonb) from public, anon;
grant execute on function public.replace_product_option_groups(uuid, uuid, jsonb) to authenticated, service_role;

-- Public modifier data includes a plain availability flag. The storefront
-- keeps unavailable choices visible so customers understand the menu.
create or replace view public.public_product_option_items
  with (security_invoker = false)
as
select
  i.id,
  i.group_id,
  g.product_id,
  i.label,
  i.description,
  i.price_delta,
  i.is_default,
  i.sort_order,
  i.linked_product_id,
  i.linked_variant_id,
  i.linked_quantity,
  i.price_mode,
  case
    when i.linked_product_id is null then true
    when lp.status <> 'active' or not lp.is_available then false
    when i.linked_variant_id is not null then
      lv.status = 'active' and (lv.stock_policy = 'allow_backorder' or lv.stock_quantity >= i.linked_quantity)
    else not lp.has_variants and (not lp.track_inventory or lp.stock >= i.linked_quantity)
  end as is_available,
  case
    when i.linked_product_id is null then null
    when lp.status <> 'active' or not lp.is_available then 'No disponible'
    when i.linked_variant_id is not null and lv.status <> 'active' then 'No disponible'
    when i.linked_variant_id is not null and lv.stock_policy = 'deny' and lv.stock_quantity < i.linked_quantity then 'Agotado'
    when i.linked_variant_id is null and lp.has_variants then 'Selecciona una presentación'
    when i.linked_variant_id is null and lp.track_inventory and lp.stock < i.linked_quantity then 'Agotado'
    else null
  end as unavailable_reason
from public.product_option_items i
join public.product_option_groups g on g.id = i.group_id
join public.products p on p.id = g.product_id
join public.stores s on s.id = p.store_id
left join public.products lp on lp.id = i.linked_product_id
left join public.product_variants lv on lv.id = i.linked_variant_id
where i.is_active = true
  and g.is_active = true
  and p.status = 'active'
  and p.is_available = true
  and s.status = 'active';

grant select on public.public_product_option_items to anon, authenticated;

-- Add a cheap catalog-level signal so quick-add never bypasses required
-- modifiers. Appending the column preserves existing SETOF view consumers.
create or replace view public.public_product_pages
  with (security_invoker = false)
as
select
  s.slug as store_slug, s.name as store_name, s.whatsapp_number as store_whatsapp_number,
  s.logo_url, t.mode as theme_mode, t.primary_color, t.secondary_color, t.accent_color,
  t.background_color, t.text_color, t.button_radius, t.template_key,
  c.whatsapp_checkout_enabled, c.web_order_enabled, c.allows_pickup, c.allows_local_delivery,
  c.commerce_mode, c.catalog_type,
  pr.id as product_id, pr.slug as product_slug, pr.name as product_name, pr.description,
  pr.short_description, pr.description_sections, pr.product_type, pr.regular_price,
  pr.compare_at_price, pr.sale_price, pr.stock, pr.track_inventory, pr.is_featured,
  pr.is_available, pr.preparation_time_minutes, pr.allows_special_instructions,
  pr.special_instructions_label, pr.special_instructions_placeholder,
  pr.special_instructions_max_length, coalesce(img.image_url, pr.main_image_url) as main_image_url,
  pr.category, pr.category_id, cat.name as category_name, cat.slug as category_slug,
  cat.parent_id as category_parent_id, coalesce(collections.items, '[]'::jsonb) as collections,
  coalesce((select jsonb_agg(jsonb_build_object(
    'facet_id', pfv.facet_id, 'facet_name', pfv.facet_name, 'facet_slug', pfv.facet_slug,
    'input_type', pfv.input_type, 'value_id', pfv.facet_value_id, 'value', pfv.value,
    'value_slug', pfv.value_slug) order by pfv.facet_name, pfv.value)
    from public.public_product_facet_values pfv where pfv.product_id = pr.id), '[]'::jsonb) as facet_values,
  pr.has_variants, pr.show_variants_as_cards, sc.size_chart,
  coalesce(voptions.items, '[]'::jsonb) as variant_options,
  coalesce(variants.items, '[]'::jsonb) as variants,
  pr.created_at as product_created_at,
  exists (select 1 from public.product_option_groups pog
           where pog.product_id = pr.id and pog.is_active = true) as has_options
from public.products pr
join public.stores s on s.id = pr.store_id
left join public.store_theme_settings t on t.store_id = s.id
left join public.store_commerce_settings c on c.store_id = s.id
left join public.store_product_categories cat on cat.id = pr.category_id
left join lateral (
  select pi.image_url from public.product_images pi
   where pi.product_id = pr.id and pi.variant_id is null and pi.option_value_id is null
   order by pi.is_primary desc, pi.sort_order asc limit 1
) img on true
left join lateral (
  select jsonb_agg(jsonb_build_object('id', col.id, 'name', col.name, 'slug', col.slug)
    order by col.sort_order, col.name, col.id) as items
  from public.product_collections pc join public.store_product_collections col on col.id = pc.collection_id
  where pc.product_id = pr.id and col.is_active = true
) collections on true
left join lateral (
  select jsonb_build_object('id', psc.id, 'name', psc.name, 'chartType', psc.chart_type,
    'unit', psc.unit, 'content', psc.content) as size_chart
  from public.product_size_charts psc where psc.id = pr.size_chart_id and psc.is_active = true
) sc on true
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'id', vo.id, 'name', vo.name, 'type', vo.type, 'useAsPublicFilter', vo.use_as_public_filter,
    'controlsMedia', vo.controls_media, 'sortOrder', vo.sort_order,
    'values', coalesce((select jsonb_agg(jsonb_build_object(
      'id', vov.id, 'value', vov.value, 'normalizedValue', vov.normalized_value,
      'colorHex', vov.color_hex, 'images', coalesce((select jsonb_agg(jsonb_build_object(
        'imageUrl', vovi.image_url, 'altText', vovi.alt_text, 'sortOrder', vovi.sort_order,
        'isPrimary', vovi.is_primary) order by vovi.is_primary desc, vovi.sort_order)
        from public.product_images vovi where vovi.option_value_id = vov.id), '[]'::jsonb)
      ) order by vov.sort_order, vov.value) from public.product_variant_option_values vov
      where vov.option_id = vo.id and vov.is_active = true), '[]'::jsonb)
    ) order by vo.sort_order, vo.name) as items
  from public.product_variant_options vo where vo.product_id = pr.id and vo.is_active = true
) voptions on true
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'id', pv.id, 'sku', pv.sku, 'price', pv.price, 'compareAtPrice', pv.compare_at_price,
    'stockQuantity', pv.stock_quantity, 'stockPolicy', pv.stock_policy, 'isDefault', pv.is_default,
    'imageUrl', (select vi.image_url from public.product_images vi where vi.variant_id = pv.id
      order by vi.is_primary desc, vi.sort_order limit 1),
    'optionValues', coalesce((select jsonb_agg(jsonb_build_object(
      'optionId', psv.option_id, 'optionName', vo2.name, 'valueId', psv.option_value_id,
      'value', vov2.value) order by vo2.sort_order)
      from public.product_variant_selected_values psv
      join public.product_variant_options vo2 on vo2.id = psv.option_id
      join public.product_variant_option_values vov2 on vov2.id = psv.option_value_id
      where psv.variant_id = pv.id), '[]'::jsonb)
    ) order by pv.position, pv.created_at) as items
  from public.product_variants pv where pv.product_id = pr.id and pv.status = 'active'
) variants on true
where pr.status = 'active' and s.status = 'active';

grant select on public.public_product_pages to anon, authenticated;

-- Capture immutable linked-product data in the order line. Historical
-- orders remain understandable even if the catalog is changed later.
create or replace function public.snapshot_linked_option_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.option_item_id is not null then
    select i.linked_product_id, i.linked_variant_id,
           case when i.linked_product_id is null then null else i.linked_quantity end
      into new.linked_product_id_snapshot, new.linked_variant_id_snapshot, new.linked_quantity_snapshot
      from public.product_option_items i where i.id = new.option_item_id;
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_linked_option_inventory on public.order_item_customizations;
create trigger snapshot_linked_option_inventory
  before insert on public.order_item_customizations
  for each row execute function public.snapshot_linked_option_inventory();

create or replace function public.reserve_linked_option_inventory(
  p_store_id uuid, p_location_id uuid, p_order_id uuid, p_order_item_id uuid,
  p_product_id uuid, p_variant_id uuid, p_quantity integer, p_movement_type text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_before integer;
  v_after integer;
begin
  if p_quantity < 1 then return; end if;
  select * into v_product from public.products
   where id = p_product_id and store_id = p_store_id for update;
  if not found or v_product.status <> 'active' or not v_product.is_available then
    raise exception 'LINKED_PRODUCT_UNAVAILABLE:%', p_product_id;
  end if;

  if p_variant_id is not null then
    select * into v_variant from public.product_variants
     where id = p_variant_id and product_id = p_product_id and store_id = p_store_id for update;
    if not found or v_variant.status <> 'active' then
      raise exception 'LINKED_VARIANT_UNAVAILABLE:%', p_variant_id;
    end if;
    v_before := v_variant.stock_quantity;
    if v_variant.stock_policy = 'deny' and v_before < p_quantity then
      raise exception 'INSUFFICIENT_LINKED_STOCK:%', p_variant_id;
    end if;
    v_after := greatest(v_before - p_quantity, 0);
    if v_after <> v_before then
      update public.product_variants set stock_quantity = v_after, updated_at = now() where id = p_variant_id;
      insert into public.inventory_movements (
        store_id, product_id, variant_id, store_location_id, order_id, order_item_id,
        movement_type, reason, quantity_change, stock_before, stock_after, created_by
      ) values (
        p_store_id, p_product_id, p_variant_id, p_location_id, p_order_id, p_order_item_id,
        p_movement_type, 'Inventario de opción vinculada', v_after - v_before, v_before, v_after, auth.uid()
      );
    end if;
  elsif v_product.has_variants then
    raise exception 'LINKED_VARIANT_REQUIRED:%', p_product_id;
  elsif v_product.track_inventory then
    v_before := v_product.stock;
    if v_before < p_quantity then raise exception 'INSUFFICIENT_LINKED_STOCK:%', p_product_id; end if;
    v_after := v_before - p_quantity;
    update public.products set stock = v_after, updated_at = now() where id = p_product_id;
    insert into public.inventory_movements (
      store_id, product_id, store_location_id, order_id, order_item_id,
      movement_type, reason, quantity_change, stock_before, stock_after, created_by
    ) values (
      p_store_id, p_product_id, p_location_id, p_order_id, p_order_item_id,
      p_movement_type, 'Inventario de opción vinculada', v_after - v_before, v_before, v_after, auth.uid()
    );
  end if;
end;
$$;

revoke all on function public.reserve_linked_option_inventory(uuid, uuid, uuid, uuid, uuid, uuid, integer, text) from public, anon, authenticated;

create or replace function public.reserve_new_linked_order_customization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_line public.order_items%rowtype;
begin
  if new.linked_product_id_snapshot is null then return null; end if;
  select * into v_line from public.order_items where id = new.order_item_id;
  select * into v_order from public.orders where id = v_line.order_id;
  if v_order.payment_method <> 'cash_on_delivery' then return null; end if;
  if current_setting('app.linked_inventory_reserved_order', true) = v_order.id::text then return null; end if;

  perform public.reserve_linked_option_inventory(
    v_order.store_id, v_order.store_location_id, v_order.id, v_line.id,
    new.linked_product_id_snapshot, new.linked_variant_id_snapshot,
    v_line.quantity * new.linked_quantity_snapshot, 'order_placed'
  );
  return null;
end;
$$;

drop trigger if exists reserve_new_linked_order_customization on public.order_item_customizations;
create constraint trigger reserve_new_linked_order_customization
  after insert on public.order_item_customizations
  deferrable initially deferred
  for each row execute function public.reserve_new_linked_order_customization();

create or replace function public.reserve_amended_linked_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row record;
begin
  if new.change_type <> 'items' then return new; end if;
  perform set_config('app.linked_inventory_reserved_order', new.order_id::text, true);
  for v_row in
    select o.store_id, o.store_location_id, o.id as order_id, oi.id as order_item_id,
           oi.quantity * c.linked_quantity_snapshot as required_quantity,
           c.linked_product_id_snapshot as linked_product_id,
           c.linked_variant_id_snapshot as linked_variant_id
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      join public.order_item_customizations c on c.order_item_id = oi.id
     where o.id = new.order_id and c.linked_product_id_snapshot is not null
     order by c.linked_product_id_snapshot, c.linked_variant_id_snapshot, oi.id, c.id
  loop
    perform public.reserve_linked_option_inventory(
      v_row.store_id, v_row.store_location_id, v_row.order_id, v_row.order_item_id,
      v_row.linked_product_id, v_row.linked_variant_id, v_row.required_quantity, 'order_amended'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists reserve_amended_linked_order_inventory on public.order_change_events;
create trigger reserve_amended_linked_order_inventory
  after insert on public.order_change_events
  for each row execute function public.reserve_amended_linked_order_inventory();

-- The Wompi reservation happens before the order exists. Once the webhook
-- links the checkout session to its order, attach every component movement
-- too, so normal cancellation restores base products and linked extras.
create or replace function public.attach_checkout_inventory_to_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.order_id is not null and old.order_id is distinct from new.order_id then
    update public.inventory_movements
       set order_id = new.order_id
     where checkout_session_id = new.id and order_id is null and movement_type = 'checkout_reserved';
  end if;
  return new;
end;
$$;

drop trigger if exists attach_checkout_inventory_to_order on public.checkout_sessions;
create trigger attach_checkout_inventory_to_order
  after update of order_id on public.checkout_sessions
  for each row execute function public.attach_checkout_inventory_to_order();
