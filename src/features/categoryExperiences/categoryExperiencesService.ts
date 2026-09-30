import { supabase } from '@/lib/supabase';
import { assertImageReadyForUpload } from '@/lib/images/imageFile.utils';
import type { PublicCategoryExperience, PublicExperienceGateway } from '@/types/common.types';
import type { PublicStoreCategoryExperienceRow } from '@/types/database.types';
import {
  mapExperienceInsertToRow,
  mapPublicExperienceGatewayRow,
  mapStoreExperienceGatewayRow,
  mapExperienceUpdateToRow,
  mapPublicCategoryExperienceRow,
  mapStoreCategoryExperienceRowToExperience,
} from './categoryExperiences.mapper';
import type {
  StoreCategoryExperience,
  StoreCategoryExperienceCreateInput,
  StoreCategoryExperienceUpdateInput,
  StoreExperienceGateway,
  StoreExperienceGatewayInput,
} from './categoryExperiences.types';

async function getOwnerId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay una sesión activa.');
  return session.user.id;
}

function extensionForFile(file: File): string {
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/avif') return 'avif';
  if (file.type === 'image/png') return 'png';
  return 'jpg';
}

type ExperienceAssetName = 'logo' | 'cover' | 'background';

/** Uploads one named asset of an experience, removing stale copies with a
 * different extension, and returns a cache-busted public URL. */
async function uploadExperienceAsset(
  storeId: string,
  experienceId: string,
  file: File,
  name: ExperienceAssetName,
): Promise<string> {
  const ownerId = await getOwnerId();
  const extension = extensionForFile(file);
  const folder = `${ownerId}/stores/${storeId}/category-experiences/${experienceId}`;
  const storagePath = `${folder}/${name}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('store-assets')
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '31536000',
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: siblings } = await supabase.storage.from('store-assets').list(folder);
  const obsoletePaths = (siblings ?? [])
    .filter((item) => item.name.startsWith(`${name}.`) && item.name !== `${name}.${extension}`)
    .map((item) => `${folder}/${item.name}`);
  if (obsoletePaths.length > 0) {
    await supabase.storage.from('store-assets').remove(obsoletePaths);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('store-assets')
    .getPublicUrl(storagePath);
  return `${publicUrl}?v=${crypto.randomUUID()}`;
}

export const categoryExperiencesService = {
  async getStoreExperiences(storeId: string): Promise<StoreCategoryExperience[]> {
    const { data, error } = await supabase
      .from('store_category_experiences')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreCategoryExperienceRowToExperience);
  },

  async getPublicExperiences(storeSlug: string): Promise<PublicCategoryExperience[]> {
    const { data, error } = await supabase
      .from('public_store_category_experiences')
      .select('*')
      .eq('store_slug', storeSlug)
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: PublicStoreCategoryExperienceRow) => mapPublicCategoryExperienceRow(row));
  },

  async createExperience(input: StoreCategoryExperienceCreateInput): Promise<StoreCategoryExperience> {
    const ownerId = await getOwnerId();
    const { data, error } = await supabase
      .from('store_category_experiences')
      .insert(mapExperienceInsertToRow(input, ownerId))
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No se recibió la experiencia creada.');
    return mapStoreCategoryExperienceRowToExperience(data);
  },

  async updateExperience(id: string, input: StoreCategoryExperienceUpdateInput): Promise<StoreCategoryExperience> {
    const { data, error } = await supabase
      .from('store_category_experiences')
      .update(mapExperienceUpdateToRow(input))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No se recibió la experiencia actualizada.');
    return mapStoreCategoryExperienceRowToExperience(data);
  },

  uploadExperienceLogo(storeId: string, experienceId: string, file: File): Promise<string> {
    assertImageReadyForUpload(file, 'store_logo');
    return uploadExperienceAsset(storeId, experienceId, file, 'logo');
  },

  uploadExperienceCover(storeId: string, experienceId: string, file: File): Promise<string> {
    assertImageReadyForUpload(file, 'store_hero_background');
    return uploadExperienceAsset(storeId, experienceId, file, 'cover');
  },

  uploadExperienceBackground(storeId: string, experienceId: string, file: File): Promise<string> {
    assertImageReadyForUpload(file, 'store_hero_background');
    return uploadExperienceAsset(storeId, experienceId, file, 'background');
  },

  async getGateway(storeId: string): Promise<StoreExperienceGateway | null> {
    const { data, error } = await supabase
      .from('store_experience_gateways')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapStoreExperienceGatewayRow(data) : null;
  },

  async saveGateway(storeId: string, input: StoreExperienceGatewayInput): Promise<StoreExperienceGateway> {
    const row = {
      store_id: storeId,
      is_enabled: input.isEnabled,
      placement: input.placement,
      title: input.title?.trim() || null,
      subtitle: input.subtitle?.trim() || null,
    };
    const existing = await this.getGateway(storeId);
    const query = existing
      ? supabase.from('store_experience_gateways').update(row).eq('store_id', storeId)
      : supabase.from('store_experience_gateways').insert(row);
    const { data, error } = await query.select('*').single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No se recibió la configuración del selector.');
    return mapStoreExperienceGatewayRow(data);
  },

  async getPublicGateway(storeSlug: string): Promise<PublicExperienceGateway | null> {
    const { data, error } = await supabase
      .from('public_store_experience_gateways')
      .select('*')
      .eq('store_slug', storeSlug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapPublicExperienceGatewayRow(data) : null;
  },

  async deleteExperience(id: string): Promise<void> {
    const { error } = await supabase
      .from('store_category_experiences')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },
};
