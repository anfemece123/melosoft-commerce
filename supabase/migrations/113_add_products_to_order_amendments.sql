-- Allow a store operator to add current catalog products while amending an
-- unpaid order. Existing lines keep their historical unit_price; new lines
-- are re-resolved and priced from the catalog inside this transaction.

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
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_before jsonb;
  v_after jsonb;
  v_movement record;
  v_line record;
  v_item jsonb;
  v_custom jsonb;
  v_group record;
  v_stock_before integer;
  v_stock_after integer;
  v_stock_policy text;
  v_track_inventory boolean;
  v_desired_qty integer;
  v_order_item_id uuid;
  v_variant_id uuid;
  v_variant_sku text;
  v_has_active_variants boolean;
  v_active_price numeric;
  v_customization_total numeric;
  v_customizations jsonb;
  v_customization_note text;
  v_option_group_id uuid;
  v_option_item_id uuid;
  v_option_price_delta numeric;
  v_option_group_name text;
  v_option_item_label text;
  v_group_selected_count integer;
  v_variant_label text;
  v_image_url text;
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

  -- Every line is either an existing line or a new catalog product, never
  -- both. Validate the scalar shapes before any uuid/integer cast.
  if exists (
    select 1
      from jsonb_array_elements(p_items) item
     where coalesce(item->>'quantity', '') !~ '^[1-9][0-9]{0,2}$'
        or (
          case when nullif(item->>'order_item_id', '') is null then 0 else 1 end
          + case when nullif(item->>'product_id', '') is null then 0 else 1 end
        ) <> 1
        or (
          nullif(item->>'order_item_id', '') is not null
          and (item->>'order_item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
        or (
          nullif(item->>'product_id', '') is not null
          and (item->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
        or (
          nullif(item->>'variant_id', '') is not null
          and (item->>'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
        or (
          nullif(item->>'product_id', '') is not null
          and jsonb_typeof(coalesce(item->'customizations', '[]'::jsonb)) <> 'array'
        )
        or (
          nullif(item->>'product_id', '') is not null
          and jsonb_typeof(coalesce(item->'customizations', '[]'::jsonb)) = 'array'
          and exists (
            select 1
              from jsonb_array_elements(coalesce(item->'customizations', '[]'::jsonb)) custom
             where coalesce(custom->>'option_group_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                or coalesce(custom->>'option_item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          )
        )
  ) then
    raise exception 'INVALID_ORDER_ITEM';
  end if;

  if (
    select count(*)
      from jsonb_array_elements(p_items) item
     where nullif(item->>'order_item_id', '') is not null
  ) <> (
    select count(distinct item->>'order_item_id')
      from jsonb_array_elements(p_items) item
     where nullif(item->>'order_item_id', '') is not null
  ) then
    raise exception 'DUPLICATE_ORDER_ITEM';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) item
     where nullif(item->>'order_item_id', '') is not null
       and not exists (
         select 1 from public.order_items oi
          where oi.id = (item->>'order_item_id')::uuid
            and oi.order_id = v_order.id
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

  -- Exact existing state, without additions: a no-op stays a no-op.
  if not exists (
       select 1 from jsonb_array_elements(p_items) item
        where nullif(item->>'product_id', '') is not null
     )
     and (select count(*) from public.order_items where order_id = v_order.id) = jsonb_array_length(p_items)
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

  -- Release the complete current reservation first. Any failure below rolls
  -- the whole transaction back, including these releases.
  for v_movement in
    select product_id, variant_id, sum(quantity_change)::integer as net_change
      from public.inventory_movements
     where order_id = v_order.id
       and movement_type in ('order_placed', 'order_amended', 'order_amendment_reversal')
     group by product_id, variant_id
    having sum(quantity_change) < 0
     order by product_id, variant_id
  loop
    if v_movement.variant_id is not null then
      select stock_quantity into v_stock_before
        from public.product_variants where id = v_movement.variant_id for update;
      if found then
        v_stock_after := v_stock_before + abs(v_movement.net_change);
        update public.product_variants set stock_quantity = v_stock_after, updated_at = now()
         where id = v_movement.variant_id;
      else
        continue;
      end if;
    else
      select stock into v_stock_before
        from public.products where id = v_movement.product_id for update;
      if found then
        v_stock_after := v_stock_before + abs(v_movement.net_change);
        update public.products set stock = v_stock_after, updated_at = now()
         where id = v_movement.product_id;
      else
        continue;
      end if;
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
        where nullif(item->>'order_item_id', '') is not null
          and (item->>'order_item_id')::uuid = oi.id
     );

  -- Existing lines retain the price and snapshots captured at checkout.
  for v_line in
    select oi.*,
           (select (item->>'quantity')::integer
              from jsonb_array_elements(p_items) item
             where nullif(item->>'order_item_id', '') is not null
               and (item->>'order_item_id')::uuid = oi.id) as desired_quantity
      from public.order_items oi
     where oi.order_id = v_order.id
     order by oi.created_at, oi.id
  loop
    update public.order_items
       set quantity = v_line.desired_quantity,
           total_price = unit_price * v_line.desired_quantity
     where id = v_line.id;
  end loop;

  -- New lines are priced exclusively from current server-side catalog data.
  for v_item in
    select value from jsonb_array_elements(p_items)
     where nullif(value->>'product_id', '') is not null
  loop
    v_desired_qty := (v_item->>'quantity')::integer;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_customizations := coalesce(v_item->'customizations', '[]'::jsonb);
    v_customization_note := nullif(btrim(v_item->>'customization_notes'), '');

    select * into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and store_id = v_order.store_id
       and status = 'active'
       and is_available = true
     for update;
    if not found then raise exception 'INVALID_PRODUCT:%', v_item->>'product_id'; end if;

    if v_variant_id is null then
      select exists (
        select 1 from public.product_variants pv
         where pv.product_id = v_product.id
           and pv.store_id = v_order.store_id
           and pv.status = 'active'
      ) into v_has_active_variants;
      if v_has_active_variants then
        raise exception 'VARIANT_REQUIRED:%', v_product.id;
      end if;
    end if;

    v_active_price := coalesce(v_product.sale_price, v_product.regular_price);
    v_variant_label := null;
    v_variant_sku := null;

    if v_variant_id is not null then
      select * into v_variant
        from public.product_variants
       where id = v_variant_id
         and product_id = v_product.id
         and store_id = v_order.store_id
         and status = 'active'
       for update;
      if not found then raise exception 'INVALID_VARIANT:%', v_variant_id; end if;
      v_active_price := coalesce(v_variant.price, v_product.sale_price, v_product.regular_price);
      v_variant_sku := v_variant.sku;

      select string_agg(vov.value, ' / ' order by vo.sort_order)
        into v_variant_label
        from public.product_variant_selected_values psv
        join public.product_variant_options vo on vo.id = psv.option_id
        join public.product_variant_option_values vov on vov.id = psv.option_value_id
       where psv.variant_id = v_variant_id;
    end if;

    if v_customization_note is not null and (
      not v_product.allows_special_instructions
      or char_length(v_customization_note) > v_product.special_instructions_max_length
    ) then
      raise exception 'INVALID_SPECIAL_INSTRUCTIONS:%', v_product.id;
    end if;

    if (
      select count(*) from jsonb_array_elements(v_customizations)
    ) <> (
      select count(distinct custom->>'option_item_id') from jsonb_array_elements(v_customizations) custom
    ) then
      raise exception 'DUPLICATE_MODIFIER';
    end if;

    v_customization_total := 0;
    for v_custom in select value from jsonb_array_elements(v_customizations)
    loop
      v_option_group_id := nullif(v_custom->>'option_group_id', '')::uuid;
      v_option_item_id := nullif(v_custom->>'option_item_id', '')::uuid;
      if v_option_group_id is null or v_option_item_id is null then
        raise exception 'INVALID_MODIFIER_PAYLOAD';
      end if;

      select poi.price_delta, poi.label, pog.name
        into v_option_price_delta, v_option_item_label, v_option_group_name
        from public.product_option_items poi
        join public.product_option_groups pog on pog.id = poi.group_id
       where poi.id = v_option_item_id
         and pog.id = v_option_group_id
         and pog.product_id = v_product.id
         and poi.store_id = v_order.store_id
         and pog.store_id = v_order.store_id
         and poi.is_active = true
         and pog.is_active = true;
      if not found then raise exception 'INVALID_MODIFIER:%', v_option_item_id; end if;
      v_customization_total := v_customization_total + v_option_price_delta;
    end loop;

    for v_group in
      select pog.id, pog.name, pog.selection_type, pog.is_required, pog.min_select, pog.max_select
        from public.product_option_groups pog
       where pog.product_id = v_product.id
         and pog.store_id = v_order.store_id
         and pog.is_active = true
    loop
      select count(*) into v_group_selected_count
        from jsonb_array_elements(v_customizations) custom
       where nullif(custom->>'option_group_id', '')::uuid = v_group.id;
      if v_group.is_required and v_group_selected_count < greatest(v_group.min_select, 1) then
        raise exception 'MODIFIER_GROUP_REQUIRED:%', v_group.name;
      end if;
      if v_group.min_select > 0 and v_group_selected_count < v_group.min_select then
        raise exception 'MODIFIER_GROUP_MIN:%', v_group.name;
      end if;
      if (v_group.selection_type = 'single' and v_group_selected_count > 1)
         or (v_group.max_select is not null and v_group_selected_count > v_group.max_select) then
        raise exception 'MODIFIER_GROUP_MAX:%', v_group.name;
      end if;
    end loop;

    v_active_price := v_active_price + v_customization_total;
    select coalesce(
      (select pi.image_url from public.product_images pi
        where pi.variant_id = v_variant_id order by pi.is_primary desc, pi.sort_order, pi.created_at limit 1),
      (select pi.image_url from public.product_images pi
        where pi.product_id = v_product.id and pi.variant_id is null
        order by pi.is_primary desc, pi.sort_order, pi.created_at limit 1),
      v_product.main_image_url
    ) into v_image_url;

    insert into public.order_items (
      order_id, product_id, variant_id,
      product_name_snapshot, product_slug_snapshot, product_image_url_snapshot,
      variant_label_snapshot, variant_sku_snapshot,
      name, quantity, unit_price, total_price, customer_note
    ) values (
      v_order.id, v_product.id, v_variant_id,
      v_product.name, v_product.slug, v_image_url,
      v_variant_label, v_variant_sku,
      v_product.name, v_desired_qty, v_active_price, v_active_price * v_desired_qty,
      v_customization_note
    ) returning id into v_order_item_id;

    for v_custom in select value from jsonb_array_elements(v_customizations)
    loop
      v_option_group_id := (v_custom->>'option_group_id')::uuid;
      v_option_item_id := (v_custom->>'option_item_id')::uuid;
      select poi.price_delta, poi.label, pog.name
        into v_option_price_delta, v_option_item_label, v_option_group_name
        from public.product_option_items poi
        join public.product_option_groups pog on pog.id = poi.group_id
       where poi.id = v_option_item_id and pog.id = v_option_group_id;

      insert into public.order_item_customizations (
        order_item_id, option_group_id, option_item_id,
        option_group_name, option_item_label, price_delta
      ) values (
        v_order_item_id, v_option_group_id, v_option_item_id,
        v_option_group_name, v_option_item_label, v_option_price_delta
      );
    end loop;
  end loop;

  -- Reserve the complete desired state. Products with backorders preserve
  -- their existing stock-policy semantics; all deny policies are strict.
  for v_line in
    select oi.* from public.order_items oi
     where oi.order_id = v_order.id
     order by oi.product_id, oi.variant_id, oi.created_at, oi.id
  loop
    if v_line.variant_id is not null then
      select stock_quantity, stock_policy into v_stock_before, v_stock_policy
        from public.product_variants
       where id = v_line.variant_id and store_id = v_order.store_id
       for update;
      if not found then raise exception 'ORDER_ITEM_VARIANT_UNAVAILABLE'; end if;
      if v_stock_policy = 'deny' and v_stock_before < v_line.quantity then
        raise exception 'INSUFFICIENT_STOCK:%', v_line.variant_id;
      end if;
      v_stock_after := greatest(v_stock_before - v_line.quantity, 0);
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
        if v_stock_before < v_line.quantity then
          raise exception 'INSUFFICIENT_STOCK:%', v_line.product_id;
        end if;
        v_stock_after := v_stock_before - v_line.quantity;
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
