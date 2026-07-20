-- ============================================================
-- Migration 068 — TEMPORARY verification fixture
--
-- Purpose: create real Home Builder sections against the live public
-- views to verify the feature end-to-end with real data, per the plan's
-- "Pruebas obligatorias" — same fixture/cleanup convention already used
-- by 049/050, 051/052, 054/055, 056/058, 059/062, 063/064.
--
-- Attaches to the existing real stores "padel-shop" (products type) and
-- "once" (restaurant/menu type). Followed by 069, which deletes
-- everything created here.
-- ============================================================

DO $$
DECLARE
  v_padel_store_id uuid;
  v_once_store_id  uuid;

  v_palas_cat_id    uuid;
  v_zapatos_cat_id  uuid;

  v_palas_product_id   uuid;
  v_zapato_variante_id uuid;

  v_hamburguesa_doble_id    uuid;
  v_hamburguesa_sencilla_id uuid;

  v_hero_id uuid;
  v_promo_id uuid;
  v_featured_products_id uuid;
  v_featured_categories_id uuid;
  v_testimonials_id uuid;
  v_image_text_id uuid;

  v_once_hero_id uuid;
  v_once_featured_id uuid;
  v_once_promo_id uuid;
  v_once_testimonials_id uuid;
BEGIN
  SELECT id INTO v_padel_store_id FROM public.stores WHERE slug = 'padel-shop';
  SELECT id INTO v_once_store_id FROM public.stores WHERE slug = 'once';
  IF v_padel_store_id IS NULL OR v_once_store_id IS NULL THEN
    RAISE EXCEPTION 'Fixture stores padel-shop/once not found — aborting';
  END IF;

  SELECT id INTO v_palas_cat_id FROM public.store_product_categories WHERE store_id = v_padel_store_id AND slug = 'palas';
  SELECT id INTO v_zapatos_cat_id FROM public.store_product_categories WHERE store_id = v_padel_store_id AND slug = 'zapatos';

  SELECT id INTO v_palas_product_id FROM public.products WHERE store_id = v_padel_store_id AND slug = 'head-serie-flash-padelpop-tennis-paddle';
  SELECT id INTO v_zapato_variante_id FROM public.products WHERE store_id = v_padel_store_id AND slug = 'zapatos-para-padel';

  SELECT id INTO v_hamburguesa_doble_id FROM public.products WHERE store_id = v_once_store_id AND slug = 'hamburguesa-doble';
  SELECT id INTO v_hamburguesa_sencilla_id FROM public.products WHERE store_id = v_once_store_id AND slug = 'hamburguesa-sencilla';

  -- ── padel-shop: Hero (marker) ──
  v_hero_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_hero_id, v_padel_store_id, 'hero', 0, true, NULL, NULL, '{}'::jsonb);

  -- ── padel-shop: Promo banners (2 items) ──
  v_promo_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_promo_id, v_padel_store_id, 'promo_banners', 1, true, '[FIXTURE] Promociones', 'Aprovecha antes de que se acaben', '{"layout":"grid_2"}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, subtitle, link_url, link_label)
  VALUES
    (v_promo_id, v_padel_store_id, 0, true, '[FIXTURE] Hasta 30% OFF', 'En palas seleccionadas', '/s/padel-shop/catalog?cat=palas', 'Ver palas'),
    (v_promo_id, v_padel_store_id, 1, true, '[FIXTURE] Envíos nacionales', 'A todo Colombia', '/s/padel-shop/catalog', 'Ver catálogo');

  -- ── padel-shop: Featured products (manual: 1 simple + 1 with variants) ──
  v_featured_products_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_featured_products_id, v_padel_store_id, 'featured_products', 2, true, '[FIXTURE] Productos destacados', NULL, '{"selectionMode":"manual","maxItems":8}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, linked_entity_type, linked_entity_id)
  VALUES
    (v_featured_products_id, v_padel_store_id, 0, true, 'product', v_palas_product_id),
    (v_featured_products_id, v_padel_store_id, 1, true, 'product', v_zapato_variante_id);

  -- ── padel-shop: Featured categories (auto) ──
  v_featured_categories_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_featured_categories_id, v_padel_store_id, 'featured_categories', 3, true, '[FIXTURE] Categorías destacadas', NULL, '{"selectionMode":"auto","maxItems":6}'::jsonb);

  -- ── padel-shop: Testimonials (2 items) ──
  v_testimonials_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_testimonials_id, v_padel_store_id, 'testimonials', 4, true, '[FIXTURE] Lo que dicen nuestros clientes', NULL, '{}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, subtitle, body, rating)
  VALUES
    (v_testimonials_id, v_padel_store_id, 0, true, '[FIXTURE] Camilo R.', 'Bogotá', 'Excelente calidad y despacho rápido.', 5),
    (v_testimonials_id, v_padel_store_id, 1, true, '[FIXTURE] Laura M.', 'Medellín', 'Las palas llegaron perfectas, muy recomendado.', 4);

  -- ── padel-shop: Image + text ──
  v_image_text_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (
    v_image_text_id, v_padel_store_id, 'image_text', 5, true,
    '[FIXTURE] Equípate para la cancha',
    'Productos pensados para jugadores que buscan calidad y comodidad.',
    '{"imageUrl":null,"imagePosition":"left","linkUrl":"/s/padel-shop/catalog","linkLabel":"Ver catálogo"}'::jsonb
  );

  -- ── once: Hero (marker) ──
  v_once_hero_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_once_hero_id, v_once_store_id, 'hero', 0, true, NULL, NULL, '{}'::jsonb);

  -- ── once: Featured products (manual — menu highlights via featured_products) ──
  v_once_featured_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_once_featured_id, v_once_store_id, 'featured_products', 1, true, '[FIXTURE] Destacados del menú', NULL, '{"selectionMode":"manual","maxItems":8}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, linked_entity_type, linked_entity_id)
  VALUES
    (v_once_featured_id, v_once_store_id, 0, true, 'product', v_hamburguesa_doble_id),
    (v_once_featured_id, v_once_store_id, 1, true, 'product', v_hamburguesa_sencilla_id);

  -- ── once: Promo banners ──
  v_once_promo_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_once_promo_id, v_once_store_id, 'promo_banners', 2, true, '[FIXTURE] Promociones', NULL, '{"layout":"grid_2"}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, subtitle)
  VALUES (v_once_promo_id, v_once_store_id, 0, true, '[FIXTURE] 2x1 en hamburguesas', 'Solo hoy');

  -- ── once: Testimonials ──
  v_once_testimonials_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_once_testimonials_id, v_once_store_id, 'testimonials', 3, true, '[FIXTURE] Lo que dicen nuestros clientes', NULL, '{}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, body, rating)
  VALUES (v_once_testimonials_id, v_once_store_id, 0, true, '[FIXTURE] Andrea P.', 'Muy buena comida y entrega rápida.', 5);

  RAISE NOTICE 'Home Builder fixture created for padel-shop (%) and once (%)', v_padel_store_id, v_once_store_id;
END $$;
