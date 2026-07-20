-- ============================================================
-- Migration 090 — Require variant_id when a product has active variants
--
-- Gap: the frontend already prevents adding a variant product to the
-- cart without a variant_id (ProductLandingPage gates every add-to-cart
-- CTA behind a fully-resolved variant; StorefrontProductCard never wires
-- a direct "add" for hasVariants products, only "Ver opciones" linking
-- to the PDP). But create_store_order itself never checked this — a
-- direct RPC call (curl, or any client bypassing the storefront) sending
-- only product_id for a product that has active variants was silently
-- treated as a simple-product purchase: priced from the PARENT's
-- regular_price/sale_price (which can be stale or a "desde $X" anchor,
-- not what any real variant sells for) and stock-checked against the
-- PARENT's products.stock/track_inventory — which for a real variant
-- product is often track_inventory=false (stock is tracked per variant,
-- not on the parent), meaning migration 088's stock guard would be
-- silently skipped entirely for this bypass. This is a backend trust
-- gap, not a frontend bug — the frontend was never the problem.
--
-- Fix: create_store_order (same signature, no grant changes) gets one
-- new guard clause per item, inserted right after the product is
-- resolved and before it's priced as a simple product. If variant_id is
-- missing AND the product has at least one active variant, the whole
-- call is rejected with VARIANT_REQUIRED:<product_id> — same RAISE
-- EXCEPTION pattern as every other validation in this function, so it
-- rolls back everything atomically like always. Checked against
-- product_variants directly (status = 'active'), not the cached
-- products.has_variants flag, matching how this function already
-- verifies product_option_groups for the modifiers guard (087) instead
-- of trusting a cached boolean. A product whose variants are all
-- inactive/archived is unaffected — EXISTS finds nothing, so it's still
-- purchasable as a simple product exactly like before this migration.
--
-- Everything else in this function (modifiers/pricing from 087, stock
-- validation/deduction from 088) is copied verbatim — no other line
-- changed. cancel_store_order is untouched entirely; it isn't
-- redefined by this migration.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_store_order(
  p_store_slug            text,
  p_customer_name         text,
  p_customer_phone        text,
  p_customer_email        text    DEFAULT NULL,
  p_fulfillment_method    text    DEFAULT 'local_delivery',
  p_shipping_address      text    DEFAULT NULL,
  p_city                  text    DEFAULT NULL,
  p_department            text    DEFAULT NULL,
  p_delivery_neighborhood text    DEFAULT NULL,
  p_delivery_reference    text    DEFAULT NULL,
  p_notes                 text    DEFAULT NULL,
  p_items                 jsonb   DEFAULT '[]'::jsonb,
  p_store_location_id     uuid    DEFAULT NULL,
  p_payment_method        text    DEFAULT 'cash_on_delivery'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_store_id                uuid;
  v_store_status            text;
  v_web_order_enabled       boolean;
  v_cod_enabled             boolean;
  v_online_checkout_enabled boolean;
  v_local_delivery_base_fee numeric := 0;
  v_local_delivery_free_from numeric := NULL;
  v_national_shipping_base_fee numeric := 0;
  v_national_shipping_free_from numeric := NULL;
  v_order_id                uuid;
  v_order_number            text;
  v_subtotal                numeric := 0;
  v_shipping_amount         numeric := 0;
  v_total_amount            numeric := 0;
  v_item                    jsonb;
  v_item_product_id         uuid;
  v_item_variant_id         uuid;
  v_product_name            text;
  v_product_slug            text;
  v_product_main_image      text;
  v_product_regular_price   numeric;
  v_product_sale_price      numeric;
  v_variant_price           numeric;
  v_variant_sku             text;
  v_variant_label           text;
  v_active_price            numeric;
  v_qty                     integer;
  v_line_total              numeric;
  v_customization_note      text;
  v_image_url               text;
  v_order_item_id            uuid;
  v_customizations           jsonb;
  v_custom                   jsonb;
  v_option_group_id          uuid;
  v_option_item_id           uuid;
  v_opt_price_delta          numeric;
  v_opt_label                text;
  v_opt_group_name           text;
  v_customization_total      numeric;
  v_has_option_groups        boolean;
  v_has_active_variants       boolean;
  v_group_row                record;
  v_group_selected_count     integer;
  v_stock_before             integer;
  v_stock_after              integer;
  v_stock_policy             text;
  v_track_inventory          boolean;
  i                         integer;
  j                         integer;
BEGIN
  SELECT s.id, s.status,
         scs.web_order_enabled,
         scs.cash_on_delivery_enabled,
         scs.online_checkout_enabled,
         scs.local_delivery_base_fee,
         scs.local_delivery_free_from,
         scs.national_shipping_base_fee,
         scs.national_shipping_free_from
  INTO v_store_id, v_store_status,
       v_web_order_enabled,
       v_cod_enabled,
       v_online_checkout_enabled,
       v_local_delivery_base_fee,
       v_local_delivery_free_from,
       v_national_shipping_base_fee,
       v_national_shipping_free_from
  FROM stores s
  JOIN store_commerce_settings scs ON scs.store_id = s.id
  WHERE s.slug = p_store_slug;

  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND'; END IF;
  IF v_store_status != 'active' THEN RAISE EXCEPTION 'STORE_INACTIVE'; END IF;
  IF NOT v_web_order_enabled THEN RAISE EXCEPTION 'WEB_ORDERS_DISABLED'; END IF;

  IF p_payment_method NOT IN ('cash_on_delivery', 'online') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;
  IF p_payment_method = 'cash_on_delivery' AND NOT v_cod_enabled THEN
    RAISE EXCEPTION 'COD_DISABLED';
  END IF;
  IF p_payment_method = 'online' AND NOT v_online_checkout_enabled THEN
    RAISE EXCEPTION 'ONLINE_CHECKOUT_DISABLED';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS';
  END IF;

  IF p_store_location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM store_locations
      WHERE id = p_store_location_id AND store_id = v_store_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'INVALID_LOCATION';
    END IF;
  END IF;

  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));

  INSERT INTO orders (
    store_id, order_number, store_location_id,
    customer_name, customer_phone, customer_email,
    fulfillment_method, shipping_address, city, department,
    delivery_neighborhood, delivery_reference, notes,
    source, payment_method,
    subtotal, shipping_amount, discount_amount, total_amount,
    currency, status, payment_status
  ) VALUES (
    v_store_id, v_order_number, p_store_location_id,
    p_customer_name, p_customer_phone, p_customer_email,
    p_fulfillment_method, p_shipping_address, p_city, p_department,
    p_delivery_neighborhood, p_delivery_reference, p_notes,
    'web', p_payment_method,
    0, 0, 0, 0,
    'COP', 'pending', 'pending'
  )
  RETURNING id INTO v_order_id;

  FOR i IN 0 .. (jsonb_array_length(p_items) - 1)
  LOOP
    v_item := p_items -> i;
    v_item_product_id := (v_item ->> 'product_id')::uuid;
    v_item_variant_id := NULLIF(v_item ->> 'variant_id', '')::uuid;
    v_qty := (v_item ->> 'quantity')::integer;
    v_customization_note := v_item ->> 'customization_notes';
    v_customizations := COALESCE(v_item -> 'customizations', '[]'::jsonb);

    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY:%', v_item ->> 'product_id';
    END IF;

    SELECT p.id, p.name, p.slug, p.regular_price, p.sale_price, p.main_image_url
    INTO v_item_product_id, v_product_name, v_product_slug,
         v_product_regular_price, v_product_sale_price, v_product_main_image
    FROM products p
    WHERE p.id = v_item_product_id
      AND p.store_id = v_store_id
      AND p.status = 'active'
      AND p.is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_PRODUCT:%', v_item ->> 'product_id';
    END IF;

    -- ── Backend must not trust the frontend alone: if this product has
    -- any active variant, a bare product_id with no variant_id is
    -- rejected outright rather than silently priced/stocked from the
    -- parent row. Checked against product_variants directly (not the
    -- cached products.has_variants flag) so a product whose variants are
    -- all archived/inactive is unaffected. ──
    IF v_item_variant_id IS NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM product_variants
        WHERE product_id = v_item_product_id
          AND store_id = v_store_id
          AND status = 'active'
      ) INTO v_has_active_variants;

      IF v_has_active_variants THEN
        RAISE EXCEPTION 'VARIANT_REQUIRED:%', v_item_product_id;
      END IF;
    END IF;

    v_active_price := COALESCE(v_product_sale_price, v_product_regular_price);
    v_variant_sku := NULL;
    v_variant_label := NULL;

    IF v_item_variant_id IS NOT NULL THEN
      SELECT pv.price, pv.sku
      INTO v_variant_price, v_variant_sku
      FROM product_variants pv
      WHERE pv.id = v_item_variant_id
        AND pv.product_id = v_item_product_id
        AND pv.store_id = v_store_id
        AND pv.status = 'active';

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_VARIANT:%', v_item ->> 'variant_id';
      END IF;

      v_active_price := COALESCE(v_variant_price, v_product_sale_price, v_product_regular_price);

      SELECT string_agg(vov.value, ' / ' ORDER BY vo.sort_order)
      INTO v_variant_label
      FROM product_variant_selected_values psv
      JOIN product_variant_options vo ON vo.id = psv.option_id
      JOIN product_variant_option_values vov ON vov.id = psv.option_value_id
      WHERE psv.variant_id = v_item_variant_id;
    END IF;

    -- ── Modifiers: reject if the product doesn't support them at all ──
    SELECT EXISTS (
      SELECT 1 FROM product_option_groups
      WHERE product_id = v_item_product_id AND store_id = v_store_id
    ) INTO v_has_option_groups;

    IF jsonb_array_length(v_customizations) > 0 AND NOT v_has_option_groups THEN
      RAISE EXCEPTION 'PRODUCT_HAS_NO_MODIFIERS:%', v_item_product_id;
    END IF;

    -- ── Validate + price each selected modifier (never trust the client) ──
    v_customization_total := 0;

    FOR j IN 0 .. (jsonb_array_length(v_customizations) - 1)
    LOOP
      v_custom := v_customizations -> j;
      v_option_group_id := NULLIF(v_custom ->> 'option_group_id', '')::uuid;
      v_option_item_id  := NULLIF(v_custom ->> 'option_item_id', '')::uuid;

      IF v_option_group_id IS NULL OR v_option_item_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_MODIFIER_PAYLOAD';
      END IF;

      SELECT poi.price_delta INTO v_opt_price_delta
      FROM product_option_items poi
      JOIN product_option_groups pog ON pog.id = poi.group_id
      WHERE poi.id = v_option_item_id
        AND pog.id = v_option_group_id
        AND pog.product_id = v_item_product_id
        AND poi.store_id = v_store_id
        AND pog.store_id = v_store_id
        AND poi.is_active = true
        AND pog.is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_MODIFIER:%', v_option_item_id;
      END IF;

      v_customization_total := v_customization_total + v_opt_price_delta;
    END LOOP;

    -- ── Validate group selection-count rules against ALL of the
    -- product's active groups, not just the ones the client sent — a
    -- required group with zero selections must fail even though the
    -- loop above never saw it. ──
    FOR v_group_row IN
      SELECT pog.id, pog.name, pog.is_required, pog.min_select, pog.max_select
      FROM product_option_groups pog
      WHERE pog.product_id = v_item_product_id
        AND pog.store_id = v_store_id
        AND pog.is_active = true
    LOOP
      SELECT count(*) INTO v_group_selected_count
      FROM jsonb_array_elements(v_customizations) c
      WHERE NULLIF(c ->> 'option_group_id', '')::uuid = v_group_row.id;

      IF v_group_row.is_required AND v_group_selected_count < GREATEST(v_group_row.min_select, 1) THEN
        RAISE EXCEPTION 'MODIFIER_GROUP_REQUIRED:%', v_group_row.name;
      END IF;
      IF v_group_row.min_select > 0 AND v_group_selected_count < v_group_row.min_select THEN
        RAISE EXCEPTION 'MODIFIER_GROUP_MIN:%', v_group_row.name;
      END IF;
      IF v_group_row.max_select IS NOT NULL AND v_group_selected_count > v_group_row.max_select THEN
        RAISE EXCEPTION 'MODIFIER_GROUP_MAX:%', v_group_row.name;
      END IF;
    END LOOP;

    v_active_price := v_active_price + v_customization_total;

    SELECT COALESCE(
      (SELECT pi.image_url FROM product_images pi
       WHERE pi.variant_id = v_item_variant_id
       ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
       LIMIT 1),
      (SELECT pi.image_url FROM product_images pi
       WHERE pi.product_id = v_item_product_id AND pi.variant_id IS NULL
       ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
       LIMIT 1),
      v_product_main_image
    ) INTO v_image_url;

    v_line_total := v_active_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    INSERT INTO order_items (
      order_id, product_id, variant_id,
      product_name_snapshot, product_slug_snapshot, product_image_url_snapshot,
      variant_label_snapshot, variant_sku_snapshot,
      name, quantity, unit_price, total_price,
      customer_note
    ) VALUES (
      v_order_id, v_item_product_id, v_item_variant_id,
      v_product_name, v_product_slug, v_image_url,
      v_variant_label, v_variant_sku,
      v_product_name, v_qty, v_active_price, v_line_total,
      v_customization_note
    )
    RETURNING id INTO v_order_item_id;

    -- ── Snapshot each validated modifier as its own row — text columns
    -- (option_group_name/option_item_label/price_delta) are the source
    -- of truth for display, ids are traceability-only. Re-fetching here
    -- (rather than caching from the validation loop above) keeps the
    -- logic simple; modifier counts per line are always tiny. ──
    FOR j IN 0 .. (jsonb_array_length(v_customizations) - 1)
    LOOP
      v_custom := v_customizations -> j;
      v_option_group_id := (v_custom ->> 'option_group_id')::uuid;
      v_option_item_id  := (v_custom ->> 'option_item_id')::uuid;

      SELECT poi.price_delta, poi.label, pog.name
      INTO v_opt_price_delta, v_opt_label, v_opt_group_name
      FROM product_option_items poi
      JOIN product_option_groups pog ON pog.id = poi.group_id
      WHERE poi.id = v_option_item_id
        AND pog.id = v_option_group_id;

      INSERT INTO order_item_customizations (
        order_item_id, option_group_id, option_item_id,
        option_group_name, option_item_label, price_delta
      ) VALUES (
        v_order_item_id, v_option_group_id, v_option_item_id,
        v_opt_group_name, v_opt_label, v_opt_price_delta
      );
    END LOOP;

    -- ── Stock: validate + atomically decrement, then log the movement.
    -- Runs after order_items/order_item_customizations for this item
    -- already exist, so the movement can reference order_item_id
    -- directly. Any RAISE EXCEPTION below rolls back this entire
    -- function call — the order and every item inserted so far in this
    -- loop — because plpgsql functions are atomic by default. ──
    IF v_item_variant_id IS NOT NULL THEN
      SELECT stock_quantity, stock_policy
      INTO v_stock_before, v_stock_policy
      FROM product_variants
      WHERE id = v_item_variant_id AND store_id = v_store_id
      FOR UPDATE;

      IF v_stock_policy = 'deny' AND v_stock_before < v_qty THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_item_variant_id;
      END IF;

      v_stock_after := GREATEST(v_stock_before - v_qty, 0);

      IF v_stock_after <> v_stock_before THEN
        UPDATE product_variants SET stock_quantity = v_stock_after, updated_at = now()
        WHERE id = v_item_variant_id;

        INSERT INTO inventory_movements (
          store_id, product_id, variant_id, order_id, order_item_id,
          movement_type, reason, quantity_change, stock_before, stock_after, created_by
        ) VALUES (
          v_store_id, v_item_product_id, v_item_variant_id, v_order_id, v_order_item_id,
          'order_placed', 'Pedido web/contraentrega', v_stock_after - v_stock_before,
          v_stock_before, v_stock_after, NULL
        );
      END IF;
    ELSE
      SELECT stock, track_inventory
      INTO v_stock_before, v_track_inventory
      FROM products
      WHERE id = v_item_product_id AND store_id = v_store_id
      FOR UPDATE;

      IF v_track_inventory THEN
        IF v_stock_before < v_qty THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_item_product_id;
        END IF;

        v_stock_after := v_stock_before - v_qty;

        UPDATE products SET stock = v_stock_after, updated_at = now()
        WHERE id = v_item_product_id;

        INSERT INTO inventory_movements (
          store_id, product_id, variant_id, order_id, order_item_id,
          movement_type, reason, quantity_change, stock_before, stock_after, created_by
        ) VALUES (
          v_store_id, v_item_product_id, NULL, v_order_id, v_order_item_id,
          'order_placed', 'Pedido web/contraentrega', v_stock_after - v_stock_before,
          v_stock_before, v_stock_after, NULL
        );
      END IF;
    END IF;
  END LOOP;

  IF p_fulfillment_method = 'local_delivery' OR p_fulfillment_method = 'delivery' THEN
    v_shipping_amount := CASE
      WHEN v_local_delivery_free_from IS NOT NULL AND v_subtotal >= v_local_delivery_free_from THEN 0
      ELSE COALESCE(v_local_delivery_base_fee, 0)
    END;
  ELSIF p_fulfillment_method = 'national_shipping' THEN
    v_shipping_amount := CASE
      WHEN v_national_shipping_free_from IS NOT NULL AND v_subtotal >= v_national_shipping_free_from THEN 0
      ELSE COALESCE(v_national_shipping_base_fee, 0)
    END;
  ELSE
    v_shipping_amount := 0;
  END IF;

  v_total_amount := v_subtotal + v_shipping_amount;

  UPDATE orders
  SET subtotal = v_subtotal,
      shipping_amount = v_shipping_amount,
      total_amount = v_total_amount
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id',       v_order_id,
    'order_number',   v_order_number,
    'total_amount',   v_total_amount,
    'payment_method', p_payment_method,
    'status',         'pending'
  );
END;
$$;
