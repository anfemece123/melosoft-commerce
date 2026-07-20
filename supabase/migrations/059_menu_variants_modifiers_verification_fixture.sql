-- ============================================================
-- Migration 059 — TEMPORARY verification fixture: a menu-item
-- product with BOTH exact variants (Tamaño) and modifiers
-- (Adiciones/Preferencias) at the same time, on the real
-- restaurant store "once". Removed by 060.
-- ============================================================

DO $$
DECLARE
  v_store_id    uuid;
  v_owner_id    uuid;
  v_category_id uuid;

  v_p_id uuid := gen_random_uuid();
  v_opt_tamano_id uuid := gen_random_uuid();
  v_sencilla_id uuid := gen_random_uuid();
  v_doble_id uuid := gen_random_uuid();
  v_variant_sencilla_id uuid := gen_random_uuid();
  v_variant_doble_id uuid := gen_random_uuid();

  v_group_adiciones_id uuid := gen_random_uuid();
  v_group_preferencias_id uuid := gen_random_uuid();
  v_item_queso_id uuid := gen_random_uuid();
  v_item_tocineta_id uuid := gen_random_uuid();
  v_item_sin_cebolla_id uuid := gen_random_uuid();
  v_item_sin_tomate_id uuid := gen_random_uuid();
BEGIN
  SELECT id, owner_id INTO v_store_id, v_owner_id FROM public.stores WHERE slug = 'once';
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Fixture store once not found — aborting';
  END IF;

  SELECT id INTO v_category_id FROM public.store_product_categories
    WHERE store_id = v_store_id AND slug = 'hamburguesas';

  INSERT INTO public.products (
    id, store_id, owner_id, name, slug, description, product_type, regular_price, stock,
    status, is_available, track_inventory, category_id, has_variants
  ) VALUES (
    v_p_id, v_store_id, v_owner_id,
    '[FIXTURE] Hamburguesa Clásica Test', 'fixture-hamburguesa-clasica-test',
    'Producto de verificación temporal — variante Tamaño + modificadores.',
    'menu_item', 18000, 0, 'active', true, false, v_category_id, true
  );

  -- Variante exacta: Tamaño (cambia precio/stock/SKU)
  INSERT INTO public.product_variant_options (id, store_id, product_id, owner_id, name, type, use_as_public_filter, controls_media, sort_order)
  VALUES (v_opt_tamano_id, v_store_id, v_p_id, v_owner_id, 'Tamaño', 'size', true, false, 0);

  INSERT INTO public.product_variant_option_values (id, store_id, option_id, owner_id, value, sort_order)
  VALUES
    (v_sencilla_id, v_store_id, v_opt_tamano_id, v_owner_id, 'Sencilla', 0),
    (v_doble_id, v_store_id, v_opt_tamano_id, v_owner_id, 'Doble', 1);

  INSERT INTO public.product_variants (id, store_id, product_id, owner_id, sku, price, stock_quantity, stock_policy, status, is_default, position, option_signature)
  VALUES
    (v_variant_sencilla_id, v_store_id, v_p_id, v_owner_id, 'FIX-HAMB-SENCILLA', 18000, 0, 'allow_backorder', 'active', true, 0, v_sencilla_id::text),
    (v_variant_doble_id, v_store_id, v_p_id, v_owner_id, 'FIX-HAMB-DOBLE', 24000, 0, 'allow_backorder', 'active', false, 1, v_doble_id::text);

  INSERT INTO public.product_variant_selected_values (variant_id, option_id, option_value_id, store_id) VALUES
    (v_variant_sencilla_id, v_opt_tamano_id, v_sencilla_id, v_store_id),
    (v_variant_doble_id, v_opt_tamano_id, v_doble_id, v_store_id);

  -- Modificadores: Adiciones (multiple) + Preferencias (multiple) — sin
  -- stock, sin SKU, price_delta plano, nunca tocan product_variants.
  INSERT INTO public.product_option_groups (id, store_id, product_id, owner_id, name, selection_type, min_select, max_select, is_required, sort_order)
  VALUES
    (v_group_adiciones_id, v_store_id, v_p_id, v_owner_id, 'Adiciones', 'multiple', 0, NULL, false, 0),
    (v_group_preferencias_id, v_store_id, v_p_id, v_owner_id, 'Preferencias', 'multiple', 0, NULL, false, 1);

  INSERT INTO public.product_option_items (id, store_id, group_id, owner_id, label, price_delta, sort_order)
  VALUES
    (v_item_queso_id, v_store_id, v_group_adiciones_id, v_owner_id, 'Queso extra', 3000, 0),
    (v_item_tocineta_id, v_store_id, v_group_adiciones_id, v_owner_id, 'Tocineta', 5000, 1),
    (v_item_sin_cebolla_id, v_store_id, v_group_preferencias_id, v_owner_id, 'Sin cebolla', 0, 0),
    (v_item_sin_tomate_id, v_store_id, v_group_preferencias_id, v_owner_id, 'Sin tomate', 0, 1);

  RAISE NOTICE 'Fixture created: product %, variants % %, groups % %', v_p_id, v_variant_sencilla_id, v_variant_doble_id, v_group_adiciones_id, v_group_preferencias_id;
END $$;
