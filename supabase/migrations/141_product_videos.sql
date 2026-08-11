-- ============================================================
-- Migration 141 — Optional product videos
--
-- Videos intentionally live outside product_images. A product's first
-- image remains its primary image and all existing gallery/cached catalog
-- queries keep their current, image-only behavior.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  duration_seconds numeric(6,2) NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_videos_product_unique UNIQUE (product_id),
  CONSTRAINT product_videos_mime_type_valid CHECK (mime_type IN ('video/mp4', 'video/webm')),
  CONSTRAINT product_videos_file_size_valid CHECK (file_size_bytes > 0 AND file_size_bytes <= 20 * 1024 * 1024),
  CONSTRAINT product_videos_duration_valid CHECK (duration_seconds > 0 AND duration_seconds <= 15),
  CONSTRAINT product_videos_dimensions_valid CHECK (width > 0 AND height > 0 AND width <= 1920 AND height <= 1080)
);

CREATE INDEX IF NOT EXISTS idx_product_videos_store_id ON public.product_videos(store_id);

DROP TRIGGER IF EXISTS product_videos_updated_at ON public.product_videos;
CREATE TRIGGER product_videos_updated_at
  BEFORE UPDATE ON public.product_videos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.product_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active product videos" ON public.product_videos;
CREATE POLICY "Public can view active product videos"
  ON public.product_videos FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_videos.product_id
        AND p.status = 'active'
        AND p.show_in_ecommerce = true
    )
  );

DROP POLICY IF EXISTS "Store members can read product videos" ON public.product_videos;
CREATE POLICY "Store members can read product videos"
  ON public.product_videos FOR SELECT
  TO authenticated
  USING (public.is_store_member(store_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Catalog managers can insert product videos" ON public.product_videos;
CREATE POLICY "Catalog managers can insert product videos"
  ON public.product_videos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_store_role(store_id, ARRAY['owner', 'admin', 'staff'])
  );

DROP POLICY IF EXISTS "Catalog managers can update product videos" ON public.product_videos;
CREATE POLICY "Catalog managers can update product videos"
  ON public.product_videos FOR UPDATE
  TO authenticated
  USING (public.has_store_role(store_id, ARRAY['owner', 'admin', 'staff']))
  WITH CHECK (public.has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

DROP POLICY IF EXISTS "Catalog managers can delete product videos" ON public.product_videos;
CREATE POLICY "Catalog managers can delete product videos"
  ON public.product_videos FOR DELETE
  TO authenticated
  USING (public.has_store_role(store_id, ARRAY['owner', 'admin', 'staff']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_videos TO authenticated;
GRANT SELECT ON public.product_videos TO anon;

COMMENT ON TABLE public.product_videos IS
  'One optional, optimized short video per product. Kept separate from the image gallery so it can never become the primary product image.';

-- A separate bucket is required because store-assets is intentionally image-only.
INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
VALUES (
  'store-videos',
  'store-videos',
  true,
  20 * 1024 * 1024,
  ARRAY['video/mp4', 'video/webm']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "store_videos_public_read" ON storage.objects;
CREATE POLICY "store_videos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'store-videos');

DROP POLICY IF EXISTS "store_videos_auth_insert" ON storage.objects;
CREATE POLICY "store_videos_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'store-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "store_videos_auth_update" ON storage.objects;
CREATE POLICY "store_videos_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'store-videos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_store_role((storage.foldername(name))[3]::uuid, ARRAY['owner', 'admin', 'staff'])
      OR public.is_platform_admin()
    )
  );

DROP POLICY IF EXISTS "store_videos_auth_delete" ON storage.objects;
CREATE POLICY "store_videos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'store-videos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_store_role((storage.foldername(name))[3]::uuid, ARRAY['owner', 'admin', 'staff'])
      OR public.is_platform_admin()
    )
  );
