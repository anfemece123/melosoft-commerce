-- ============================================================
-- Migration 073 — TEMPORARY verification fixture (Home Builder UX-fix pass)
--
-- Verifies: (1) hero always renders regardless of Home Builder sections,
-- (2) legacy product grid is replaced (not duplicated) once sections
-- exist, (3) all 7 offered section types render, (4) a manually-featured
-- SUBcategory link still resolves correctly (parent+sub), (5) restaurant
-- store (menu products) works the same way. Followed by 074, which
-- deletes everything created here, including the temporary subcategory.
-- ============================================================

DO $$
DECLARE
  v_padel_store_id uuid;
  v_once_store_id  uuid;

  v_zapatos_cat_id uuid;
  v_hombre_subcat_id uuid := gen_random_uuid();

  v_palas_product_id   uuid;
  v_zapato_variante_id uuid;

  v_hamburguesa_doble_id    uuid;
  v_hamburguesa_sencilla_id uuid;

  v_featured_products_id   uuid;
  v_featured_categories_id uuid;
  v_promo_id               uuid;
  v_testimonials_id        uuid;
  v_image_text_id          uuid;
  v_benefits_id             uuid;
  v_gallery_id              uuid;

  v_once_featured_id     uuid;
  v_once_benefits_id     uuid;
  v_once_testimonials_id uuid;
BEGIN
  SELECT id INTO v_padel_store_id FROM public.stores WHERE slug = 'padel-shop';
  SELECT id INTO v_once_store_id FROM public.stores WHERE slug = 'once';
  IF v_padel_store_id IS NULL OR v_once_store_id IS NULL THEN
    RAISE EXCEPTION 'Fixture stores padel-shop/once not found — aborting';
  END IF;

  SELECT id INTO v_zapatos_cat_id FROM public.store_product_categories WHERE store_id = v_padel_store_id AND slug = 'zapatos';
  SELECT id INTO v_palas_product_id FROM public.products WHERE store_id = v_padel_store_id AND slug = 'head-serie-flash-padelpop-tennis-paddle';
  SELECT id INTO v_zapato_variante_id FROM public.products WHERE store_id = v_padel_store_id AND slug = 'zapatos-para-padel';
  SELECT id INTO v_hamburguesa_doble_id FROM public.products WHERE store_id = v_once_store_id AND slug = 'hamburguesa-doble';
  SELECT id INTO v_hamburguesa_sencilla_id FROM public.products WHERE store_id = v_once_store_id AND slug = 'hamburguesa-sencilla';

  -- Temporary subcategory under "zapatos", to verify the parent+sub link fix.
  INSERT INTO public.store_product_categories (id, store_id, owner_id, name, slug, parent_id, sort_order, is_active)
  SELECT v_hombre_subcat_id, v_padel_store_id, owner_id, '[FIXTURE] Hombre', 'fixture-hombre', v_zapatos_cat_id, 0, true
  FROM public.stores WHERE id = v_padel_store_id;

  -- ── padel-shop: Featured products (auto) ──
  v_featured_products_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES (v_featured_products_id, v_padel_store_id, 'featured_products', 0, true, '[FIXTURE] Productos destacados',
    '{"selectionMode":"auto","maxItems":8,"columnsDesktop":4,"showViewAllButton":true,"viewAllLabel":"Ver catálogo"}'::jsonb);

  -- ── padel-shop: Featured categories (manual, includes the subcategory) ──
  v_featured_categories_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES (v_featured_categories_id, v_padel_store_id, 'featured_categories', 1, true, '[FIXTURE] Categorías destacadas',
    '{"selectionMode":"manual","maxItems":6}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, linked_entity_type, linked_entity_id)
  VALUES
    (v_featured_categories_id, v_padel_store_id, 0, true, 'category', v_zapatos_cat_id),
    (v_featured_categories_id, v_padel_store_id, 1, true, 'category', v_hombre_subcat_id);

  -- ── padel-shop: Promo banners (grid_2, full_image) ──
  v_promo_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES (v_promo_id, v_padel_store_id, 'promo_banners', 2, true, '[FIXTURE] Promociones', '{"layout":"grid_2","style":"full_image"}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, subtitle)
  VALUES (v_promo_id, v_padel_store_id, 0, true, '[FIXTURE] Hasta 30% OFF', 'En palas seleccionadas');

  -- ── padel-shop: Testimonials (carousel) ──
  v_testimonials_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES (v_testimonials_id, v_padel_store_id, 'testimonials', 3, true, '[FIXTURE] Lo que dicen nuestros clientes', '{"layout":"carousel"}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, body, rating)
  VALUES (v_testimonials_id, v_padel_store_id, 0, true, '[FIXTURE] Camilo R.', 'Excelente calidad.', 5);

  -- ── padel-shop: Image + text (light background) ──
  v_image_text_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, subheading, content)
  VALUES (v_image_text_id, v_padel_store_id, 'image_text', 4, true, '[FIXTURE] Equípate para la cancha', 'Calidad y comodidad.',
    '{"imageUrl":null,"imagePosition":"left","background":"light","linkUrl":"/s/padel-shop/catalog","linkLabel":"Ver catálogo"}'::jsonb);

  -- ── padel-shop: Benefits ──
  v_benefits_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES (v_benefits_id, v_padel_store_id, 'benefits', 5, true, '[FIXTURE] Por qué comprar con nosotros', '{}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, body, link_url)
  VALUES
    (v_benefits_id, v_padel_store_id, 0, true, '[FIXTURE] Envíos nacionales', 'A todo Colombia', 'truck'),
    (v_benefits_id, v_padel_store_id, 1, true, '[FIXTURE] Pago seguro', 'Transacciones protegidas', 'shield');

  -- ── padel-shop: Gallery ──
  v_gallery_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES (v_gallery_id, v_padel_store_id, 'gallery', 6, true, '[FIXTURE] Galería', '{"layout":"grid"}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, image_url, title)
  VALUES (v_gallery_id, v_padel_store_id, 0, true, NULL, '[FIXTURE] Cancha 1');

  -- ── once: Featured products (manual, restaurant) ──
  v_once_featured_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES (v_once_featured_id, v_once_store_id, 'featured_products', 0, true, '[FIXTURE] Destacados del menú',
    '{"selectionMode":"manual","maxItems":8,"columnsDesktop":3,"showViewAllButton":true,"viewAllLabel":"Ver menú"}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, linked_entity_type, linked_entity_id)
  VALUES
    (v_once_featured_id, v_once_store_id, 0, true, 'product', v_hamburguesa_doble_id),
    (v_once_featured_id, v_once_store_id, 1, true, 'product', v_hamburguesa_sencilla_id);

  -- ── once: Benefits ──
  v_once_benefits_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES (v_once_benefits_id, v_once_store_id, 'benefits', 1, true, '[FIXTURE] Por qué pedir con nosotros', '{}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, body, link_url)
  VALUES (v_once_benefits_id, v_once_store_id, 0, true, '[FIXTURE] Entrega rápida', '30 minutos o menos', 'clock');

  -- ── once: Testimonials ──
  v_once_testimonials_id := gen_random_uuid();
  INSERT INTO public.store_home_sections (id, store_id, section_type, sort_order, is_active, heading, content)
  VALUES (v_once_testimonials_id, v_once_store_id, 'testimonials', 2, true, '[FIXTURE] Lo que dicen nuestros clientes', '{"layout":"grid"}'::jsonb);

  INSERT INTO public.store_home_section_items (section_id, store_id, sort_order, is_active, title, body, rating)
  VALUES (v_once_testimonials_id, v_once_store_id, 0, true, '[FIXTURE] Andrea P.', 'Muy buena comida.', 5);

  RAISE NOTICE 'Home Builder v2 fixture created for padel-shop (%) and once (%)', v_padel_store_id, v_once_store_id;
END $$;
