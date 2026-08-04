import { supabase } from '@/lib/supabase';
import { assertImageReadyForUpload } from './imageFile.utils';

export type CatalogTaxonomyImageKind = 'categories' | 'collections';

function extensionForFile(file: File): string {
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/avif') return 'avif';
  if (file.type === 'image/png') return 'png';
  return 'jpg';
}

async function getAuthenticatedUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Tu sesión terminó. Inicia sesión nuevamente para subir la imagen.');
  return session.user.id;
}

/**
 * Stores one bounded, cache-busted navigation image per user/entity. The
 * fixed filename prevents repeated edits from accumulating files in Storage.
 */
export async function uploadCatalogTaxonomyImage(
  storeId: string,
  kind: CatalogTaxonomyImageKind,
  entityId: string,
  file: File,
): Promise<string> {
  assertImageReadyForUpload(file, 'catalog_taxonomy_image');
  const userId = await getAuthenticatedUserId();
  const extension = extensionForFile(file);
  const folder = `${userId}/stores/${storeId}/catalog/${kind}/${entityId}`;
  const storagePath = `${folder}/navigation.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('store-assets')
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '31536000',
    });
  if (uploadError) throw new Error(uploadError.message);

  // A processed image is normally WebP. If a supported browser emitted a
  // different format, remove only the obsolete sibling files we own.
  const { data: siblings } = await supabase.storage.from('store-assets').list(folder);
  const obsoletePaths = (siblings ?? [])
    .filter((item) => item.name !== `navigation.${extension}`)
    .map((item) => `${folder}/${item.name}`);
  if (obsoletePaths.length > 0) {
    await supabase.storage.from('store-assets').remove(obsoletePaths);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('store-assets')
    .getPublicUrl(storagePath);

  return `${publicUrl}?v=${crypto.randomUUID()}`;
}

/** Best-effort cleanup. A collaborator cannot remove another user's file. */
export async function removeCatalogTaxonomyImage(imageUrl: string | null): Promise<void> {
  if (!imageUrl) return;
  try {
    const userId = await getAuthenticatedUserId();
    const url = new URL(imageUrl);
    const marker = '/storage/v1/object/public/store-assets/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return;
    const storagePath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    if (!storagePath.startsWith(`${userId}/`)) return;
    await supabase.storage.from('store-assets').remove([storagePath]);
  } catch {
    // Removing an image from the database must not fail because an old URL
    // came from another provider or no longer exists in Storage.
  }
}
