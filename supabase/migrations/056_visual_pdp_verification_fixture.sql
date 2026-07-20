-- ============================================================
-- Migration 056 — TEMPORARY verification fixture for cards -> PDP
-- preselection with a general image present (to prove per-color
-- images take priority over it, not just "vs nothing"). Removed
-- by 057.
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
  v_t40_id uuid := gen_random_uuid();
  v_variant_verde38_id uuid := gen_random_uuid();
  v_variant_azul40_id uuid := gen_random_uuid();
BEGIN
  SELECT id, owner_id INTO v_store_id, v_owner_id FROM public.stores WHERE slug = 'padel-shop';
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Fixture store padel-shop not found — aborting';
  END IF;

  SELECT id INTO v_category_zapatos_id FROM public.store_product_categories
    WHERE store_id = v_store_id AND slug = 'zapatos';

  INSERT INTO public.products (
    id, store_id, owner_id, name, slug, description, regular_price, stock,
    status, is_available, track_inventory, category_id, has_variants, show_variants_as_cards,
    main_image_url
  ) VALUES (
    v_p_id, v_store_id, v_owner_id,
    '[FIXTURE] Zapato Visual PDP Test', 'fixture-zapato-visual-pdp-test',
    'Producto de verificación temporal — prioridad de galería card->PDP.',
    200000, 0, 'active', true, true, v_category_zapatos_id, true, true,
    'https://fixture.local/zapato-visual-pdp-general.jpg'
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
    (v_t40_id, v_store_id, v_opt_talla_id, v_owner_id, '40', 1);

  -- General image (should NEVER be shown once Verde/Azul is selected and
  -- has its own images) + one image per color value.
  INSERT INTO public.product_images (store_id, product_id, owner_id, image_url, sort_order, is_primary)
  VALUES (v_store_id, v_p_id, v_owner_id, 'https://fixture.local/zapato-visual-pdp-general-2.jpg', 0, true);

  INSERT INTO public.product_images (store_id, product_id, owner_id, image_url, option_value_id, sort_order, is_primary)
  VALUES
    (v_store_id, v_p_id, v_owner_id, 'https://fixture.local/zapato-visual-pdp-verde.jpg', v_verde_id, 0, true),
    (v_store_id, v_p_id, v_owner_id, 'https://fixture.local/zapato-visual-pdp-azul.jpg', v_azul_id, 0, true);

  INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, stock_quantity, status, is_default, position, option_signature)
  VALUES
    (v_variant_verde38_id, v_store_id, v_p_id, v_owner_id, 'FIX-PDP-VERDE-38', 6, 'active', true, 0,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_verde_id::text, v_t38_id::text]) x)),
    (v_variant_azul40_id, v_store_id, v_p_id, v_owner_id, 'FIX-PDP-AZUL-40', 4, 'active', false, 1,
      (SELECT string_agg(x, '|' ORDER BY x) FROM unnest(ARRAY[v_azul_id::text, v_t40_id::text]) x));

  INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id) VALUES
    (v_variant_verde38_id, v_opt_color_id, v_verde_id, v_store_id),
    (v_variant_verde38_id, v_opt_talla_id, v_t38_id, v_store_id),
    (v_variant_azul40_id, v_opt_color_id, v_azul_id, v_store_id),
    (v_variant_azul40_id, v_opt_talla_id, v_t40_id, v_store_id);

  RAISE NOTICE 'Fixture created: product %, color values % %', v_p_id, v_verde_id, v_azul_id;
END $$;
