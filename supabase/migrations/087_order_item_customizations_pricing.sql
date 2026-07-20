-- ============================================================
-- Migration 087 — Modifiers/adiciones are priced and persisted
--
-- Problem: product_option_groups/product_option_items already let an
-- owner define paid modifiers (e.g. "Queso extra +$2.000"), and the
-- storefront already shows the marked-up price to the customer
-- client-side. But create_store_order never received or priced
-- modifiers at all — it only ever priced from products/product_variants.
-- The customer's selections were flattened into order_items.customer_note
-- as plain text, and order_item_customizations (the table built for this
-- exact purpose in migration 021) has never had a single row inserted
-- anywhere in the codebase. Net effect: a customer could select and be
-- shown a priced extra, and the store never actually charged for it.
--
-- This migration:
--   1. Adds option_group_id/option_item_id to order_item_customizations
--      — optional traceability only. The text snapshot columns
--      (option_group_name/option_item_label/price_delta) remain the
--      source of truth for display; product_option_groups/items rows
--      get replaced wholesale on every catalog edit (see
--      productOptionsService.replaceProductOptionGroups), so an id can
--      go stale the moment an owner edits their menu. Never join against
--      these ids to render a past order.
--   2. Rewrites create_store_order (same signature — no grant/overload
--      changes needed) so each item in p_items can carry a
--      `customizations: [{option_group_id, option_item_id}]` array.
--      The server re-validates and re-prices every one of them from
--      product_option_groups/product_option_items — the client can send
--      ids, never a price. Group-level required/min/max rules are
--      enforced the same way, against ALL of the product's active
--      groups (not just the ones the client happened to send), so a
--      required group with nothing selected is rejected even though the
--      client never mentioned it.
--   3. Inserts one order_item_customizations row per validated modifier,
--      and folds price_delta into the item's unit price before
--      multiplying by quantity — so a modifier's cost is now actually
--      charged, and charged per unit (quantity times), not once per line.
--
-- No RLS changes: create_store_order is SECURITY DEFINER (owned by the
-- migration-running role, which bypasses RLS entirely — the same reason
-- it can already insert into orders/order_items despite their owner-
-- scoped RLS policies), and wompi-webhook writes via service_role (also
-- RLS-bypassing). The existing order_item_customizations policies
-- (SELECT scoped to is_store_member, INSERT restricted away from
-- regular authenticated clients) are already correct for "the client
-- never inserts directly, the owner can only read their own store's
-- data" — nothing to change there.
--
-- search_path hardening: the previous version of this function (migration
-- 082) only had `SET search_path = public`. For a SECURITY DEFINER
-- function that's plain wrong to rely on as a full pin — Postgres always
-- searches the caller's temp schema (pg_temp) FIRST for unqualified table/
-- sequence names, ahead of anything in search_path, UNLESS pg_temp is
-- itself explicitly listed in search_path (at which point it's searched
-- in the position given, no longer implicitly first). Any authenticated
-- or anon caller can create their own temp objects, so without this, a
-- caller could in principle shadow a table this function references
-- unqualified (e.g. a temp `orders` table) and influence what this
-- elevated-privilege function reads/writes. `SET search_path = public,
-- pg_temp` removes that implicit-first behavior — public resolves before
-- pg_temp is ever considered.
-- ============================================================

-- ── 1. Optional traceability columns (never the source of truth) ────

ALTER TABLE public.order_item_customizations
  ADD COLUMN IF NOT EXISTS option_group_id uuid REFERENCES public.product_option_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS option_item_id  uuid REFERENCES public.product_option_items(id) ON DELETE SET NULL;

-- ── 2. create_store_order — now prices modifiers ─────────────────────

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
  v_group_row                record;
  v_group_selected_count     integer;
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
