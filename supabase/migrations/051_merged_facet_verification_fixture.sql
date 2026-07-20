-- ============================================================
-- Migration 051 — TEMPORARY verification fixture for the merged
-- attribute+variant "Color" facet fix. Same pattern as 049/050:
-- real rows on the existing store "padel-shop", removed by 052.
--
-- Producto A: Zapato Naranja Test — Color as a plain ATTRIBUTE
--   (facet value assignment), Talla as its only variant option.
-- Producto B: Camiseta Color Test — Color AND Talla as VARIANT
--   options, only Negro/S and Blanco/M exist (no Negro/M).
-- Producto C: Zapato Negro Test — Color as attribute (like A),
--   Talla=40 as its only variant option.
--
-- Creates a temporary "Ropa" category (Producto B) and two new
-- values ("Naranja", "Negro") under the store's existing real
-- "Color" facet — both removed by 052 alongside everything else.
-- ============================================================

DO $$
DECLARE
  v_store_id    uuid;
  v_owner_id    uuid;
  v_category_zapatos_id uuid;
  v_category_ropa_id    uuid := gen_random_uuid();
  v_color_facet_id      uuid := '8e63ed57-ad56-4b3f-afff-1722f0d0e672';
  v_color_naranja_id    uuid := gen_random_uuid();
  v_color_negro_id      uuid := gen_random_uuid();

  v_pa_id uuid := gen_random_uuid();
  v_pb_id uuid := gen_random_uuid();
  v_pc_id uuid := gen_random_uuid();

  v_pa_opt_talla_id uuid := gen_random_uuid();
  v_pa_t38_id uuid := gen_random_uuid();
  v_pa_t40_id uuid := gen_random_uuid();
  v_pa_variant_38_id uuid := gen_random_uuid();
  v_pa_variant_40_id uuid := gen_random_uuid();

  v_pb_opt_color_id uuid := gen_random_uuid();
  v_pb_opt_talla_id uuid := gen_random_uuid();
  v_pb_negro_id uuid := gen_random_uuid();
  v_pb_blanco_id uuid := gen_random_uuid();
  v_pb_ts_id uuid := gen_random_uuid();
  v_pb_tm_id uuid := gen_random_uuid();
  v_pb_variant_negro_s_id uuid := gen_random_uuid();
  v_pb_variant_blanco_m_id uuid := gen_random_uuid();

  v_pc_opt_talla_id uuid := gen_random_uuid();
  v_pc_t40_id uuid := gen_random_uuid();
  v_pc_variant_40_id uuid := gen_random_uuid();
BEGIN
  SELECT id, owner_id INTO v_store_id, v_owner_id FROM public.stores WHERE slug = 'padel-shop';
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Fixture store padel-shop not found — aborting';
  END IF;

  SELECT id INTO v_category_zapatos_id FROM public.store_product_categories
    WHERE store_id = v_store_id AND slug = 'zapatos';

  INSERT INTO public.store_product_categories (id, store_id, owner_id, name, slug, sort_order, is_active)
  VALUES (v_category_ropa_id, v_store_id, v_owner_id, '[FIXTURE] Ropa', 'fixture-ropa', 100, true);

  INSERT INTO public.store_product_facet_values (id, store_id, facet_id, value, slug, sort_order, is_active)
  VALUES
    (v_color_naranja_id, v_store_id, v_color_facet_id, 'Naranja', 'naranja', 100, true),
    (v_color_negro_id, v_store_id, v_color_facet_id, 'Negro', 'negro', 101, true);

  -- ── Producto A: Zapato Naranja Test — Color ATTRIBUTE + Talla VARIANT ──
  INSERT INTO public.products (
    id, store_id, owner_id, name, slug, description, regular_price, stock,
    status, is_available, track_inventory, category_id, has_variants
  ) VALUES (
    v_pa_id, v_store_id, v_owner_id,
    '[FIXTURE] Zapato Naranja Test', 'fixture-zapato-naranja-test',
    'Producto de verificación temporal — Color como atributo real + Talla como variante.',
    180000, 0, 'active', true, true, v_category_zapatos_id, true
  );

  INSERT INTO public.product_facet_values (product_id, facet_value_id) VALUES (v_pa_id, v_color_naranja_id);

  INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, use_as_public_filter, controls_media, sort_order)
  VALUES (v_pa_opt_talla_id, v_store_id, v_pa_id, v_owner_id, 'Talla', 'size', true, false, 0);

  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
  VALUES
    (v_pa_t38_id, v_store_id, v_pa_opt_talla_id, v_owner_id, '38', 0),
    (v_pa_t40_id, v_store_id, v_pa_opt_talla_id, v_owner_id, '40', 1);

  INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, stock_quantity, status, is_default, position, option_signature)
  VALUES
    (v_pa_variant_38_id, v_store_id, v_pa_id, v_owner_id, 'FIX-PA-38', 6, 'active', true, 0, v_pa_t38_id::text),
    (v_pa_variant_40_id, v_store_id, v_pa_id, v_owner_id, 'FIX-PA-40', 4, 'active', false, 1, v_pa_t40_id::text);

  INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id) VALUES
    (v_pa_variant_38_id, v_pa_opt_talla_id, v_pa_t38_id, v_store_id),
    (v_pa_variant_40_id, v_pa_opt_talla_id, v_pa_t40_id, v_store_id);

  -- ── Producto B: Camiseta Color Test — Color AND Talla as VARIANT (Negro/S + Blanco/M only) ──
  INSERT INTO public.products (
    id, store_id, owner_id, name, slug, description, regular_price, stock,
    status, is_available, track_inventory, category_id, has_variants
  ) VALUES (
    v_pb_id, v_store_id, v_owner_id,
    '[FIXTURE] Camiseta Color Test', 'fixture-camiseta-color-test',
    'Producto de verificación temporal — Color y Talla como variantes, combinación exacta.',
    90000, 0, 'active', true, true, v_category_ropa_id, true
  );

  INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, use_as_public_filter, controls_media, sort_order)
  VALUES
    (v_pb_opt_color_id, v_store_id, v_pb_id, v_owner_id, 'Color', 'color', true, true, 0),
    (v_pb_opt_talla_id, v_store_id, v_pb_id, v_owner_id, 'Talla', 'size', true, false, 1);

  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, color_hex, sort_order)
  VALUES
    (v_pb_negro_id, v_store_id, v_pb_opt_color_id, v_owner_id, 'Negro', '#000000', 0),
    (v_pb_blanco_id, v_store_id, v_pb_opt_color_id, v_owner_id, 'Blanco', '#ffffff', 1);
  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
  VALUES
    (v_pb_ts_id, v_store_id, v_pb_opt_talla_id, v_owner_id, 'S', 0),
    (v_pb_tm_id, v_store_id, v_pb_opt_talla_id, v_owner_id, 'M', 1);

  INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, stock_quantity, status, is_default, position, option_signature)
  VALUES
    (v_pb_variant_negro_s_id, v_store_id, v_pb_id, v_owner_id, 'FIX-PB-NEGRO-S', 8, 'active', true, 0,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_pb_negro_id::text, v_pb_ts_id::text]) x)),
    (v_pb_variant_blanco_m_id, v_store_id, v_pb_id, v_owner_id, 'FIX-PB-BLANCO-M', 6, 'active', false, 1,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_pb_blanco_id::text, v_pb_tm_id::text]) x));

  INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id) VALUES
    (v_pb_variant_negro_s_id, v_pb_opt_color_id, v_pb_negro_id, v_store_id),
    (v_pb_variant_negro_s_id, v_pb_opt_talla_id, v_pb_ts_id, v_store_id),
    (v_pb_variant_blanco_m_id, v_pb_opt_color_id, v_pb_blanco_id, v_store_id),
    (v_pb_variant_blanco_m_id, v_pb_opt_talla_id, v_pb_tm_id, v_store_id);

  -- ── Producto C: Zapato Negro Test — Color ATTRIBUTE + Talla=40 VARIANT ──
  INSERT INTO public.products (
    id, store_id, owner_id, name, slug, description, regular_price, stock,
    status, is_available, track_inventory, category_id, has_variants
  ) VALUES (
    v_pc_id, v_store_id, v_owner_id,
    '[FIXTURE] Zapato Negro Test', 'fixture-zapato-negro-test',
    'Producto de verificación temporal — Color como atributo real + Talla como variante.',
    180000, 0, 'active', true, true, v_category_zapatos_id, true
  );

  INSERT INTO public.product_facet_values (product_id, facet_value_id) VALUES (v_pc_id, v_color_negro_id);

  INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, use_as_public_filter, controls_media, sort_order)
  VALUES (v_pc_opt_talla_id, v_store_id, v_pc_id, v_owner_id, 'Talla', 'size', true, false, 0);

  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
  VALUES (v_pc_t40_id, v_store_id, v_pc_opt_talla_id, v_owner_id, '40', 0);

  INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, stock_quantity, status, is_default, position, option_signature)
  VALUES (v_pc_variant_40_id, v_store_id, v_pc_id, v_owner_id, 'FIX-PC-40', 5, 'active', true, 0, v_pc_t40_id::text);

  INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id) VALUES
    (v_pc_variant_40_id, v_pc_opt_talla_id, v_pc_t40_id, v_store_id);

  RAISE NOTICE 'Fixture created: products % % %, category %, facet values % %', v_pa_id, v_pb_id, v_pc_id, v_category_ropa_id, v_color_naranja_id, v_color_negro_id;
END $$;
