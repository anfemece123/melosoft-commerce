-- Keep the public asset bucket image-only and prevent oversized uploads even
-- when a client bypasses the frontend crop/optimization flow. The current UI
-- normally uploads WebP files below 1.2 MiB; 5 MiB leaves operational margin
-- for browser encoder differences and older supported clients.
update storage.buckets
set
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif'
  ]::text[]
where id = 'store-assets';
