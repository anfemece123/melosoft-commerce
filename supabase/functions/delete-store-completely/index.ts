import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/allowedOrigins.ts';

interface DeleteStorePayload {
  storeId: string;
  confirmation: string;
}

interface StoreRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  [key: string]: unknown;
}

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function storagePathFromPublicUrl(value: unknown, bucket: string): string | null {
  if (typeof value !== 'string') return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return null;
  const rawPath = value.slice(markerIndex + marker.length).split('?')[0];
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

async function listFilesRecursively(
  adminClient: SupabaseClient<any, any, any, any, any>,
  bucket: string,
  folder: string,
): Promise<string[]> {
  const files: string[] = [];

  async function visit(currentFolder: string): Promise<void> {
    let offset = 0;
    const pageSize = 100;
    while (true) {
      const { data, error } = await adminClient.storage.from(bucket).list(currentFolder, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`No se pudo revisar Storage (${bucket}): ${error.message}`);
      const entries = data ?? [];
      for (const entry of entries) {
        if (!entry.name || entry.name === '.emptyFolderPlaceholder') continue;
        const path = `${currentFolder}/${entry.name}`;
        // Storage folders have no id/metadata; files do.
        if (entry.id || entry.metadata) files.push(path);
        else await visit(path);
      }
      if (entries.length < pageSize) break;
      offset += entries.length;
    }
  }

  await visit(folder);
  return files;
}

async function removeStorageFiles(
  adminClient: SupabaseClient<any, any, any, any, any>,
  bucket: string,
  paths: Iterable<string>,
): Promise<number> {
  const uniquePaths = Array.from(new Set(paths)).filter(Boolean);
  for (let index = 0; index < uniquePaths.length; index += 100) {
    const batch = uniquePaths.slice(index, index + 100);
    const { error } = await adminClient.storage.from(bucket).remove(batch);
    if (error) throw new Error(`No se pudieron eliminar archivos de ${bucket}: ${error.message}`);
  }
  return uniquePaths.length;
}

async function userCanBeRemoved(
  adminClient: SupabaseClient<any, any, any, any, any>,
  userId: string,
  storeId: string,
  platformRoles: Map<string, string>,
): Promise<boolean> {
  if (platformRoles.get(userId) === 'platform_admin') return false;

  const [{ count: ownedStoreCount, error: ownedStoresError }, { count: membershipCount, error: membershipsError }] = await Promise.all([
    adminClient.from('stores').select('id', { count: 'exact', head: true }).eq('owner_id', userId).neq('id', storeId),
    adminClient.from('store_members').select('id', { count: 'exact', head: true }).eq('user_id', userId).neq('store_id', storeId),
  ]);
  if (ownedStoresError) throw new Error(`No se pudieron verificar las empresas del usuario: ${ownedStoresError.message}`);
  if (membershipsError) throw new Error(`No se pudieron verificar las membresías del usuario: ${membershipsError.message}`);
  return (ownedStoreCount ?? 0) === 0 && (membershipCount ?? 0) === 0;
}

Deno.serve(async (request) => {
  const cors = getCorsHeaders(request);
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: cors });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Storage or authentication is not configured.' }, 503, cors);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Unauthorized: missing Authorization header' }, 401, cors);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerUser) return jsonResponse({ error: 'Unauthorized: invalid token' }, 401, cors);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('platform_role, status')
    .eq('user_id', callerUser.id)
    .maybeSingle();
  if (profileError) return jsonResponse({ error: `Profile lookup failed: ${profileError.message}` }, 500, cors);
  if (callerProfile?.platform_role !== 'platform_admin' || callerProfile.status !== 'active') {
    return jsonResponse({ error: 'Forbidden: only platform_admin can permanently delete companies' }, 403, cors);
  }

  let payload: DeleteStorePayload;
  try {
    payload = await request.json() as DeleteStorePayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
  }
  if (!payload?.storeId || !isUuid(payload.storeId) || typeof payload.confirmation !== 'string') {
    return jsonResponse({ error: 'El identificador de la empresa no es válido.' }, 400, cors);
  }

  const { data: store, error: storeError } = await adminClient
    .from('stores')
    .select('*')
    .eq('id', payload.storeId)
    .maybeSingle<StoreRow>();
  if (storeError) return jsonResponse({ error: `No se pudo consultar la empresa: ${storeError.message}` }, 500, cors);
  if (!store) return jsonResponse({ error: 'La empresa ya no existe.' }, 404, cors);
  if (payload.confirmation.trim() !== store.slug) {
    return jsonResponse({ error: 'La confirmación no coincide con el slug de la empresa.' }, 422, cors);
  }

  const { data: memberRows, error: membersError } = await adminClient
    .from('store_members')
    .select('user_id')
    .eq('store_id', store.id);
  if (membersError) return jsonResponse({ error: `No se pudieron consultar los usuarios: ${membersError.message}` }, 500, cors);

  const candidateUserIds = Array.from(new Set([store.owner_id, ...(memberRows ?? []).map((row) => row.user_id)]));
  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('user_id, platform_role')
    .in('user_id', candidateUserIds);
  if (profilesError) return jsonResponse({ error: `No se pudieron verificar los perfiles: ${profilesError.message}` }, 500, cors);
  const platformRoles = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.platform_role]));
  const removableUserIds: string[] = [];
  for (const userId of candidateUserIds) {
    if (await userCanBeRemoved(adminClient, userId, store.id, platformRoles)) removableUserIds.push(userId);
  }

  const [productImageRows, productVideoRows, offerImageRows, reviewImageRows] = await Promise.all([
    adminClient.from('product_images').select('storage_path').eq('store_id', store.id),
    adminClient.from('product_videos').select('storage_path').eq('store_id', store.id),
    adminClient.from('offer_images').select('storage_path').eq('store_id', store.id),
    adminClient.from('product_review_images').select('storage_path').eq('store_id', store.id),
  ]);
  const storageQueryError = productImageRows.error ?? productVideoRows.error ?? offerImageRows.error ?? reviewImageRows.error;
  if (storageQueryError) {
    return jsonResponse({ error: `No se pudieron consultar todos los archivos de la empresa: ${storageQueryError.message}` }, 500, cors);
  }

  const storeAssetPaths = new Set<string>();
  for (const value of Object.values(store)) {
    const path = storagePathFromPublicUrl(value, 'store-assets');
    if (path) storeAssetPaths.add(path);
  }
  for (const row of productImageRows.data ?? []) {
    if (row.storage_path) storeAssetPaths.add(row.storage_path);
  }
  for (const row of offerImageRows.data ?? []) {
    if (row.storage_path) storeAssetPaths.add(row.storage_path);
  }
  for (const row of reviewImageRows.data ?? []) {
    if (row.storage_path) storeAssetPaths.add(row.storage_path);
  }
  const videoStoragePaths = new Set<string>();
  for (const row of productVideoRows.data ?? []) {
    if (row.storage_path) videoStoragePaths.add(row.storage_path);
  }

  const assetPrefixes = new Set<string>();
  for (const userId of candidateUserIds) {
    assetPrefixes.add(`${userId}/stores/${store.id}`);
    assetPrefixes.add(`${userId}/stores/${store.slug}`);
  }
  // If a user has no remaining company or membership, it is safe to clean
  // their complete stores namespace, including old slug/draft folders.
  for (const userId of removableUserIds) assetPrefixes.add(`${userId}/stores`);
  for (const prefix of assetPrefixes) {
    for (const path of await listFilesRecursively(adminClient, 'store-assets', prefix)) storeAssetPaths.add(path);
  }
  const reviewAssetPaths = await listFilesRecursively(adminClient, 'store-assets', `reviews/${store.id}`);
  const videoPaths = new Set(videoStoragePaths);
  for (const prefix of assetPrefixes) {
    for (const path of await listFilesRecursively(adminClient, 'store-videos', prefix)) videoPaths.add(path);
  }

  try {
    const [assetsRemoved, reviewAssetsRemoved, videosRemoved] = await Promise.all([
      removeStorageFiles(adminClient, 'store-assets', storeAssetPaths),
      removeStorageFiles(adminClient, 'store-assets', reviewAssetPaths),
      removeStorageFiles(adminClient, 'store-videos', videoPaths),
    ]);

    // Delete orphaned company users first. If the owner is exclusive to this
    // company, Auth cascades the company rows; otherwise the explicit store
    // delete below removes only this company's data.
    for (const userId of removableUserIds.filter((id) => id !== store.owner_id)) {
      const { error } = await adminClient.auth.admin.deleteUser(userId, false);
      if (error && !error.message.toLowerCase().includes('not found')) {
        throw new Error(`No se pudo eliminar el usuario de autenticación: ${error.message}`);
      }
    }

    const { error: storeDeleteError } = await adminClient.from('stores').delete().eq('id', store.id);
    if (storeDeleteError) throw new Error(`No se pudo eliminar la empresa: ${storeDeleteError.message}`);

    if (removableUserIds.includes(store.owner_id)) {
      const { error } = await adminClient.auth.admin.deleteUser(store.owner_id, false);
      if (error && !error.message.toLowerCase().includes('not found')) {
        throw new Error(`La empresa fue eliminada, pero no se pudo eliminar el acceso del propietario: ${error.message}`);
      }
    }

    return jsonResponse({
      deleted: true,
      storeId: store.id,
      deletedUserCount: removableUserIds.length,
      deletedStorageFileCount: assetsRemoved + reviewAssetsRemoved + videosRemoved,
    }, 200, cors);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'No se pudo completar la eliminación.' }, 500, cors);
  }
});
