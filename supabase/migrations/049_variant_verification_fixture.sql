-- ============================================================
-- Migration 049 — TEMPORARY verification fixture
--
-- Purpose: create real rows (not just code-reading) to verify the
-- variant system end-to-end against the live public views, per an
-- explicit request to prove combination-exact filtering with real
-- data rather than just asserting it from source. Attached to the
-- existing real store "padel-shop" / category "zapatos".
--
-- This migration is meant to be followed by 050, which deletes
-- everything it creates (cascades handle variants/options/values).
-- Both files are kept in migration history for transparency instead
-- of being silently reverted and removed.
--
-- Note: "Tono" is used instead of "Color" for the exact-combination
-- test products (1 and 2) on purpose — padel-shop already has a
-- REAL store facet named "Color", and the variant-filter dedup logic
-- (deriveVariantFilters) intentionally skips a variant option whose
-- name collides with an existing real facet. Naming it "Color" here
-- would test the dedup path, not the combination-exact path, and
-- would silently produce zero variant-filter values, muddying the
-- signal. Product 3 below separately exercises the real "Color"
-- collision/dedup path on its own.
-- ============================================================

DO $$
DECLARE
  v_store_id    uuid;
  v_owner_id    uuid;
  v_category_id uuid;

  v_p1_id uuid := gen_random_uuid();
  v_p2_id uuid := gen_random_uuid();
  v_p3_id uuid := gen_random_uuid();

  v_p1_opt_tono_id  uuid := gen_random_uuid();
  v_p1_opt_talla_id uuid := gen_random_uuid();
  v_p2_opt_tono_id  uuid := gen_random_uuid();
  v_p2_opt_talla_id uuid := gen_random_uuid();
  v_p3_opt_color_id uuid := gen_random_uuid();

  v_p1_verde_id uuid := gen_random_uuid();
  v_p1_azul_id  uuid := gen_random_uuid();
  v_p1_t38_id   uuid := gen_random_uuid();
  v_p1_t40_id   uuid := gen_random_uuid();
  v_p2_verde_id uuid := gen_random_uuid();
  v_p2_t40_id   uuid := gen_random_uuid();
  v_p3_rojo_id  uuid := gen_random_uuid();

  v_p1_variant_verde38_id uuid := gen_random_uuid();
  v_p1_variant_azul40_id  uuid := gen_random_uuid();
  v_p2_variant_verde40_id uuid := gen_random_uuid();
  v_p3_variant_rojo_id    uuid := gen_random_uuid();
BEGIN
  SELECT id, owner_id INTO v_store_id, v_owner_id FROM public.stores WHERE slug = 'padel-shop';
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Fixture store padel-shop not found — aborting';
  END IF;

  SELECT id INTO v_category_id FROM public.store_product_categories
    WHERE store_id = v_store_id AND slug = 'zapatos';

  -- ── Product 1: Verde/38 + Azul/40 only (NOT Verde/40, NOT Azul/38) ──
  INSERT INTO public.products (
    id, store_id, owner_id, name, slug, description, regular_price, stock,
    status, is_available, track_inventory, category_id, has_variants
  ) VALUES (
    v_p1_id, v_store_id, v_owner_id,
    '[FIXTURE] Zapato Tono Talla Test 1', 'fixture-zapato-tono-talla-test-1',
    'Producto de verificación temporal — combinación exacta Tono x Talla.',
    150000, 0, 'active', true, true, v_category_id, true
  );

  INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, use_as_public_filter, controls_media, sort_order)
  VALUES
    (v_p1_opt_tono_id, v_store_id, v_p1_id, v_owner_id, 'Tono', 'color', true, true, 0),
    (v_p1_opt_talla_id, v_store_id, v_p1_id, v_owner_id, 'Talla', 'size', true, false, 1);

  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, color_hex, sort_order)
  VALUES
    (v_p1_verde_id, v_store_id, v_p1_opt_tono_id, v_owner_id, 'Verde', '#22c55e', 0),
    (v_p1_azul_id,  v_store_id, v_p1_opt_tono_id, v_owner_id, 'Azul',  '#3b82f6', 1),
    (v_p1_t38_id,   v_store_id, v_p1_opt_talla_id, v_owner_id, '38', NULL, 0),
    (v_p1_t40_id,   v_store_id, v_p1_opt_talla_id, v_owner_id, '40', NULL, 1);

  INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, stock_quantity, status, is_default, position, option_signature)
  VALUES
    (v_p1_variant_verde38_id, v_store_id, v_p1_id, v_owner_id, 'FIX-P1-VERDE-38', 7, 'active', true, 0,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_p1_verde_id::text, v_p1_t38_id::text]) x)),
    (v_p1_variant_azul40_id, v_store_id, v_p1_id, v_owner_id, 'FIX-P1-AZUL-40', 5, 'active', false, 1,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_p1_azul_id::text, v_p1_t40_id::text]) x));

  INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id) VALUES
    (v_p1_variant_verde38_id, v_p1_opt_tono_id, v_p1_verde_id, v_store_id),
    (v_p1_variant_verde38_id, v_p1_opt_talla_id, v_p1_t38_id, v_store_id),
    (v_p1_variant_azul40_id, v_p1_opt_tono_id, v_p1_azul_id, v_store_id),
    (v_p1_variant_azul40_id, v_p1_opt_talla_id, v_p1_t40_id, v_store_id);

  -- ── Product 2: Verde/40 only — the one that SHOULD match Tono=Verde + Talla=40 ──
  INSERT INTO public.products (
    id, store_id, owner_id, name, slug, description, regular_price, stock,
    status, is_available, track_inventory, category_id, has_variants
  ) VALUES (
    v_p2_id, v_store_id, v_owner_id,
    '[FIXTURE] Zapato Tono Talla Test 2', 'fixture-zapato-tono-talla-test-2',
    'Producto de verificación temporal — combinación exacta Tono x Talla.',
    150000, 0, 'active', true, true, v_category_id, true
  );

  INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, use_as_public_filter, controls_media, sort_order)
  VALUES
    (v_p2_opt_tono_id, v_store_id, v_p2_id, v_owner_id, 'Tono', 'color', true, true, 0),
    (v_p2_opt_talla_id, v_store_id, v_p2_id, v_owner_id, 'Talla', 'size', true, false, 1);

  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, color_hex, sort_order)
  VALUES
    (v_p2_verde_id, v_store_id, v_p2_opt_tono_id, v_owner_id, 'Verde', '#22c55e', 0),
    (v_p2_t40_id,   v_store_id, v_p2_opt_talla_id, v_owner_id, '40', NULL, 0);

  INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, stock_quantity, status, is_default, position, option_signature)
  VALUES
    (v_p2_variant_verde40_id, v_store_id, v_p2_id, v_owner_id, 'FIX-P2-VERDE-40', 9, 'active', true, 0,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_p2_verde_id::text, v_p2_t40_id::text]) x));

  INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id) VALUES
    (v_p2_variant_verde40_id, v_p2_opt_tono_id, v_p2_verde_id, v_store_id),
    (v_p2_variant_verde40_id, v_p2_opt_talla_id, v_p2_t40_id, v_store_id);

  -- ── Product 3: single option literally named "Color" — collision/dedup check ──
  INSERT INTO public.products (
    id, store_id, owner_id, name, slug, description, regular_price, stock,
    status, is_available, track_inventory, category_id, has_variants
  ) VALUES (
    v_p3_id, v_store_id, v_owner_id,
    '[FIXTURE] Zapato Color Dedup Test', 'fixture-zapato-color-dedup-test',
    'Producto de verificación temporal — colisión de nombre con el facet real Color.',
    150000, 0, 'active', true, true, v_category_id, true
  );

  INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, use_as_public_filter, controls_media, sort_order)
  VALUES (v_p3_opt_color_id, v_store_id, v_p3_id, v_owner_id, 'Color', 'color', true, true, 0);

  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, color_hex, sort_order)
  VALUES (v_p3_rojo_id, v_store_id, v_p3_opt_color_id, v_owner_id, 'Rojo', '#ef4444', 0);

  INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, stock_quantity, status, is_default, position, option_signature)
  VALUES (v_p3_variant_rojo_id, v_store_id, v_p3_id, v_owner_id, 'FIX-P3-ROJO', 3, 'active', true, 0, v_p3_rojo_id::text);

  INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id) VALUES
    (v_p3_variant_rojo_id, v_p3_opt_color_id, v_p3_rojo_id, v_store_id);

  RAISE NOTICE 'Fixture created: products % % %', v_p1_id, v_p2_id, v_p3_id;
END $$;
