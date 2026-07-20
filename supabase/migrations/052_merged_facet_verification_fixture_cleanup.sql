-- ============================================================
-- Migration 052 — cleanup of the 051 verification fixture.
-- Deleting the 3 [FIXTURE] products cascades their variant
-- options/values/variants/selected_values and product_facet_values
-- rows (ON DELETE CASCADE). The temporary "Ropa" category and the
-- "Naranja"/"Negro" values added under the real Color facet are
-- removed explicitly since nothing else cascades them.
-- ============================================================

DELETE FROM public.products
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'padel-shop')
  AND slug IN (
    'fixture-zapato-naranja-test',
    'fixture-camiseta-color-test',
    'fixture-zapato-negro-test'
  );

DELETE FROM public.store_product_categories
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'padel-shop')
  AND slug = 'fixture-ropa';

DELETE FROM public.store_product_facet_values
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'padel-shop')
  AND facet_id = '8e63ed57-ad56-4b3f-afff-1722f0d0e672'
  AND slug IN ('naranja', 'negro');
