-- ============================================================
-- Migration 124 — Remove Carta cover compositions
-- ============================================================

-- Keep the first previously selected image so existing cartas do not
-- suddenly lose their cover when the old composition option disappears.
UPDATE public.store_carta_settings
SET
  cover_layout = 'single',
  cover_product_ids = cover_product_ids[1:1]
WHERE cover_layout = 'collage';

-- An uploaded image is the single source when present.
UPDATE public.store_carta_settings
SET cover_product_ids = '{}'::uuid[]
WHERE cover_image_url IS NOT NULL;

ALTER TABLE public.store_carta_settings
  DROP CONSTRAINT store_carta_cover_layout_valid,
  DROP CONSTRAINT store_carta_cover_product_limit,
  ADD CONSTRAINT store_carta_cover_layout_valid
    CHECK (cover_layout IN ('none', 'single')),
  ADD CONSTRAINT store_carta_cover_product_limit
    CHECK (cardinality(cover_product_ids) <= 1);

COMMENT ON COLUMN public.store_carta_settings.cover_layout IS
  'Carta cover mode: typography only or one owner-selected image.';
