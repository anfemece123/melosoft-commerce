-- ============================================================
-- Migration 063 — TEMPORARY verification fixture: partial (non-
-- cartesian) combinations. Verde only in 39/40/41, Azul only in
-- 38/40/42 — NOT the full 2x5 cartesian product. Removed by 064.
-- ============================================================

DO $$
DECLARE
  v_store_id    uuid;
  v_owner_id    uuid;
  v_category_zapatos_id uuid;

  v_p_id uuid := gen_random_uuid();
  v_opt_color_id uuid := gen_random_uuid();
  v_opt_talla_id uuid := gen_random_uuid();
  v_verde_id uuid := gen_random_uuid();
  v_azul_id uuid := gen_random_uuid();
  v_t38_id uuid := gen_random_uuid();
  v_t39_id uuid := gen_random_uuid();
  v_t40_id uuid := gen_random_uuid();
  v_t41_id uuid := gen_random_uuid();
  v_t42_id uuid := gen_random_uuid();

  v_verde_39 uuid := gen_random_uuid();
  v_verde_40 uuid := gen_random_uuid();
  v_verde_41 uuid := gen_random_uuid();
  v_azul_38 uuid := gen_random_uuid();
  v_azul_40 uuid := gen_random_uuid();
  v_azul_42 uuid := gen_random_uuid();
BEGIN
  SELECT id, owner_id INTO v_store_id, v_owner_id FROM public.stores WHERE slug = 'padel-shop';
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Fixture store padel-shop not found — aborting';
  END IF;

  SELECT id INTO v_category_zapatos_id FROM public.store_product_categories
    WHERE store_id = v_store_id AND slug = 'zapatos';

  INSERT INTO public.products (
    id, store_id, owner_id, name, slug, description, regular_price, stock,
    status, is_available, track_inventory, category_id, has_variants, show_variants_as_cards
  ) VALUES (
    v_p_id, v_store_id, v_owner_id,
    '[FIXTURE] Zapato Combinaciones Reales Test', 'fixture-zapato-combinaciones-reales-test',
    'Producto de verificación temporal — combinaciones parciales (no cartesiano).',
    150000, 0, 'active', true, true, v_category_zapatos_id, true, true
  );

  INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, use_as_public_filter, controls_media, sort_order)
  VALUES
    (v_opt_color_id, v_store_id, v_p_id, v_owner_id, 'Color', 'color', true, true, 0),
    (v_opt_talla_id, v_store_id, v_p_id, v_owner_id, 'Talla', 'size', true, false, 1);

  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, color_hex, sort_order)
  VALUES
    (v_verde_id, v_store_id, v_opt_color_id, v_owner_id, 'Verde', '#22c55e', 0),
    (v_azul_id, v_store_id, v_opt_color_id, v_owner_id, 'Azul', '#3b82f6', 1);
  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
  VALUES
    (v_t38_id, v_store_id, v_opt_talla_id, v_owner_id, '38', 0),
    (v_t39_id, v_store_id, v_opt_talla_id, v_owner_id, '39', 1),
    (v_t40_id, v_store_id, v_opt_talla_id, v_owner_id, '40', 2),
    (v_t41_id, v_store_id, v_opt_talla_id, v_owner_id, '41', 3),
    (v_t42_id, v_store_id, v_opt_talla_id, v_owner_id, '42', 4);

  -- Only 6 of the 10 possible combinations — the whole point of this fixture.
  INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, stock_quantity, status, is_default, position, option_signature)
  VALUES
    (v_verde_39, v_store_id, v_p_id, v_owner_id, 'FIX-COMB-VERDE-39', 5, 'active', true, 0,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_verde_id::text, v_t39_id::text]) x)),
    (v_verde_40, v_store_id, v_p_id, v_owner_id, 'FIX-COMB-VERDE-40', 4, 'active', false, 1,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_verde_id::text, v_t40_id::text]) x)),
    (v_verde_41, v_store_id, v_p_id, v_owner_id, 'FIX-COMB-VERDE-41', 3, 'active', false, 2,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_verde_id::text, v_t41_id::text]) x)),
    (v_azul_38, v_store_id, v_p_id, v_owner_id, 'FIX-COMB-AZUL-38', 6, 'active', false, 3,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_azul_id::text, v_t38_id::text]) x)),
    (v_azul_40, v_store_id, v_p_id, v_owner_id, 'FIX-COMB-AZUL-40', 2, 'active', false, 4,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_azul_id::text, v_t40_id::text]) x)),
    (v_azul_42, v_store_id, v_p_id, v_owner_id, 'FIX-COMB-AZUL-42', 7, 'active', false, 5,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_azul_id::text, v_t42_id::text]) x));

  INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id) VALUES
    (v_verde_39, v_opt_color_id, v_verde_id, v_store_id), (v_verde_39, v_opt_talla_id, v_t39_id, v_store_id),
    (v_verde_40, v_opt_color_id, v_verde_id, v_store_id), (v_verde_40, v_opt_talla_id, v_t40_id, v_store_id),
    (v_verde_41, v_opt_color_id, v_verde_id, v_store_id), (v_verde_41, v_opt_talla_id, v_t41_id, v_store_id),
    (v_azul_38, v_opt_color_id, v_azul_id, v_store_id), (v_azul_38, v_opt_talla_id, v_t38_id, v_store_id),
    (v_azul_40, v_opt_color_id, v_azul_id, v_store_id), (v_azul_40, v_opt_talla_id, v_t40_id, v_store_id),
    (v_azul_42, v_opt_color_id, v_azul_id, v_store_id), (v_azul_42, v_opt_talla_id, v_t42_id, v_store_id);

  RAISE NOTICE 'Fixture created: product %, 6 partial-combination variants', v_p_id;
END $$;
