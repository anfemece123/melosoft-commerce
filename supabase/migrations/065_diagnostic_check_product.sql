-- ============================================================
-- Migration 065 — READ-ONLY diagnostic, no schema/data changes.
-- Checking whether product cc2fc898-0eba-45e6-ba72-1564236a70b0
-- (reported as a 406/PGRST116 from `products?id=eq...&select=*`)
-- actually exists, and if so, why it might be invisible to the
-- querying session.
-- ============================================================

DO $$
DECLARE
  v_product RECORD;
  v_store RECORD;
BEGIN
  SELECT id, store_id, name, slug, status, is_available, created_at, updated_at
  INTO v_product
  FROM public.products
  WHERE id = 'cc2fc898-0eba-45e6-ba72-1564236a70b0';

  IF NOT FOUND THEN
    RAISE NOTICE 'PRODUCT_NOT_FOUND: no row in products with this id at all';
    RETURN;
  END IF;

  RAISE NOTICE 'PRODUCT_FOUND: store_id=%, name=%, slug=%, status=%, is_available=%, created_at=%, updated_at=%',
    v_product.store_id, v_product.name, v_product.slug, v_product.status, v_product.is_available, v_product.created_at, v_product.updated_at;

  SELECT id, slug, name, status INTO v_store FROM public.stores WHERE id = v_product.store_id;
  IF FOUND THEN
    RAISE NOTICE 'STORE_FOUND: slug=%, name=%, status=%', v_store.slug, v_store.name, v_store.status;
  ELSE
    RAISE NOTICE 'STORE_NOT_FOUND for store_id=%', v_product.store_id;
  END IF;
END $$;
