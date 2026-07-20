-- ============================================================
-- Migration 055 — cleanup of the 054 verification fixture.
-- Deleting the product cascades its variant options/values/
-- variants/selected_values/images (ON DELETE CASCADE).
-- ============================================================

DELETE FROM public.products
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'padel-shop')
  AND slug = 'fixture-zapato-visual-test';
