-- Product videos are displayed as another square product-gallery medium.
-- Keep existing 1920x1080 rows valid while allowing the new square output up
-- to 1200x1200. New uploads are normalized by the app before they reach this
-- constraint.
ALTER TABLE public.product_videos
  DROP CONSTRAINT IF EXISTS product_videos_dimensions_valid;

ALTER TABLE public.product_videos
  ADD CONSTRAINT product_videos_dimensions_valid
  CHECK (
    width > 0
    AND height > 0
    AND width <= 1920
    AND height <= 1200
  );
