import { supabase } from '@/lib/supabase';
import { assertImageReadyForUpload } from '@/lib/images/imageFile.utils';
import type { PublicCategoryExperience } from '@/types/common.types';
import type { PublicStoreCategoryExperienceRow } from '@/types/database.types';
import {
  mapExperienceInsertToRow,
  mapExperienceUpdateToRow,
  mapPublicCategoryExperienceRow,
  mapStoreCategoryExperienceRowToExperience,
} from './categoryExperiences.mapper';
import type {
  StoreCategoryExperience,
  StoreCategoryExperienceCreateInput,
  StoreCategoryExperienceUpdateInput,
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

  async uploadExperienceLogo(storeId: string, experienceId: string, file: File): Promise<string> {
    assertImageReadyForUpload(file, 'store_logo');
    const ownerId = await getOwnerId();
    const extension = extensionForFile(file);
    const folder = `${ownerId}/stores/${storeId}/category-experiences/${experienceId}`;
    const storagePath = `${folder}/logo.${extension}`;
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
      .filter((item) => item.name !== `logo.${extension}`)
      .map((item) => `${folder}/${item.name}`);
    if (obsoletePaths.length > 0) {
      await supabase.storage.from('store-assets').remove(obsoletePaths);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('store-assets')
      .getPublicUrl(storagePath);
    return `${publicUrl}?v=${crypto.randomUUID()}`;
  },

  async deleteExperience(id: string): Promise<void> {
    const { error } = await supabase
      .from('store_category_experiences')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },
};
