-- ============================================================
-- Melosoft Commerce — Storage Policies (Multistore)
-- Migration: 002
-- Bucket: store-assets
-- Paths: {owner_id}/stores/{store_id}/logo/{filename}
--        {owner_id}/stores/{store_id}/products/{product_id}/{filename}
--        {owner_id}/stores/{store_id}/offers/{offer_id}/{filename}
-- ============================================================

-- Create the store-assets bucket (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

-- ============================================================
-- READ: Anyone can read files in store-assets (public bucket)
-- ============================================================

create policy "store_assets_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'store-assets');

-- ============================================================
-- INSERT: Authenticated users can upload only under their own owner_id prefix.
-- Path format: {owner_id}/stores/...
-- The first path segment must equal the user's auth.uid().
-- ============================================================

create policy "store_assets_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- UPDATE: Authenticated users can update only their own files.
-- ============================================================

create policy "store_assets_auth_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- DELETE: Authenticated users can delete only their own files.
-- ============================================================

create policy "store_assets_auth_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
