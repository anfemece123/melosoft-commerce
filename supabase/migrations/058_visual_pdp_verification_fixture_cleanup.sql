-- ============================================================
-- Migration 058 — cleanup of the 056 verification fixture.
-- ============================================================

DELETE FROM public.products
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'padel-shop')
  AND slug = 'fixture-zapato-visual-pdp-test';
