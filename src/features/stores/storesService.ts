import { supabase } from '@/lib/supabase';
import type {
  Store,
  StoreInsert,
  StoreUpdate,
  StoreTheme,
  StoreThemeInsert,
  StoreThemeUpdate,
  StorePolicies,
  StorePoliciesInsert,
  StorePoliciesUpdate,
  StoreHeroSlide,
  StoreHeroSlideInsert,
  StoreMember,
  StoreMemberInsert,
  StoreMemberUpdate,
  StoreLimit,
  StoreLimitUpdate,
  StoreLocation,
  StoreLocationInsert,
  StoreLocationUpdate,
  StoreBusinessHour,
  CreateStoreWithOwnerInput,
  CreateStoreWithOwnerResponse,
  SlugAvailabilityResult,
  SlugAvailabilityReason,
} from './stores.types';
import type { PublicStoreHeroSlide, PublicStorePage } from '@/types/common.types';
import {
  mapStoreRowToStore,
  mapStoreInsertToRow,
  mapStoreUpdateToRow,
  mapStoreThemeRowToStoreTheme,
  mapStoreThemeInsertToRow,
  mapStoreThemeUpdateToRow,
  mapStorePoliciesRowToStorePolicies,
  mapStorePoliciesInsertToRow,
  mapStorePoliciesUpdateToRow,
  mapStoreHeroSlideRowToStoreHeroSlide,
  mapStoreHeroSlideInsertToRow,
  mapPublicStoreHeroSlideRowToPublicStoreHeroSlide,
  mapPublicStorePageRowToPublicStorePage,
  mapStoreMemberRowToStoreMember,
  mapStoreMemberInsertToRow,
  mapStoreLimitRowToStoreLimit,
  mapStoreLimitUpdateToRow,
  mapStoreLocationRowToStoreLocation,
  mapStoreLocationInsertToRow,
  mapStoreLocationUpdateToRow,
  mapStoreBusinessHourRowToStoreBusinessHour,
} from './stores.mapper';

async function getOwnerId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

// supabase-js reports a non-2xx Edge Function response as a generic
// FunctionsHttpError whose .message is not the JSON body the function
// actually returned. The real { error: "..." } payload lives on
// error.context (a Response) — extract it so the superadmin sees
// "Esta dirección ya está en uso" instead of a generic HTTP message.
interface FunctionErrorWithContext extends Error {
  context?: Response;
}

function hasResponseContext(error: unknown): error is FunctionErrorWithContext {
  if (!(error instanceof Error) || typeof error !== 'object' || error === null) return false;
  return 'context' in error && (error as FunctionErrorWithContext).context instanceof Response;
}

async function extractFunctionErrorMessage(error: Error): Promise<string> {
  if (hasResponseContext(error) && error.context) {
    try {
      const payload = await error.context.clone().json() as { error?: string };
      if (payload.error) return payload.error;
    } catch {
      // Fall back to the SDK error message below if the response is not JSON.
    }
  }
  return error.message;
}

export const storesService = {
  async getStores(): Promise<Store[]> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreRowToStore);
  },

  async getStoreById(id: string): Promise<Store | null> {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapStoreRowToStore(data);
  },

  async createStore(payload: StoreInsert): Promise<Store> {
    const ownerId = await getOwnerId();
    const row = mapStoreInsertToRow(payload, ownerId);
    const { data, error } = await supabase
      .from('stores')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after insert');
    return mapStoreRowToStore(data);
  },

  async updateStore(id: string, payload: StoreUpdate): Promise<Store> {
    const row = mapStoreUpdateToRow(payload);
    const { data, error } = await supabase
      .from('stores')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapStoreRowToStore(data);
  },

  async uploadStoreLogo(storeKey: string, file: File): Promise<string> {
    return storesService.uploadStoreBrandingAsset(storeKey, file, 'logo');
  },

  async uploadStoreFavicon(storeKey: string, file: File): Promise<string> {
    return storesService.uploadStoreBrandingAsset(storeKey, file, 'favicon');
  },

  async uploadStoreHeroImage(storeKey: string, file: File): Promise<string> {
    return storesService.uploadStoreBrandingAsset(storeKey, file, 'hero-image');
  },

  async uploadStoreHeroBackground(storeKey: string, file: File): Promise<string> {
    return storesService.uploadStoreBrandingAsset(storeKey, file, 'hero-background');
  },

  async uploadStoreHeroBadge(storeKey: string, file: File): Promise<string> {
    return storesService.uploadStoreBrandingAsset(storeKey, file, 'hero-badge');
  },

  async uploadStoreBrandingAsset(
    storeKey: string,
    file: File,
    assetKind: 'logo' | 'favicon' | 'hero-image' | 'hero-background' | 'hero-badge'
  ): Promise<string> {
    const ownerId = await getOwnerId();
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
    const safeStoreKey = storeKey.trim().toLowerCase().replace(/[^a-z0-9-_/]/g, '-') || 'draft';
    const storagePath = `${ownerId}/stores/${safeStoreKey}/branding/${assetKind}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('store-assets')
      .upload(storagePath, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from('store-assets')
      .getPublicUrl(storagePath);

    return publicUrl;
  },

  async archiveStore(id: string): Promise<Store> {
    return storesService.updateStore(id, { status: 'archived' });
  },

  // Theme
  async getStoreTheme(storeId: string): Promise<StoreTheme | null> {
    const { data, error } = await supabase
      .from('store_theme_settings')
      .select('*')
      .eq('store_id', storeId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapStoreThemeRowToStoreTheme(data);
  },

  async upsertStoreTheme(payload: StoreThemeInsert): Promise<StoreTheme> {
    const row = mapStoreThemeInsertToRow(payload);
    const { data, error } = await supabase
      .from('store_theme_settings')
      .upsert(row, { onConflict: 'store_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after upsert');
    return mapStoreThemeRowToStoreTheme(data);
  },

  async updateStoreTheme(storeId: string, payload: StoreThemeUpdate): Promise<StoreTheme> {
    const row = mapStoreThemeUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_theme_settings')
      .update(row)
      .eq('store_id', storeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapStoreThemeRowToStoreTheme(data);
  },

  // Policies
  async getStorePolicies(storeId: string): Promise<StorePolicies | null> {
    const { data, error } = await supabase
      .from('store_policies')
      .select('*')
      .eq('store_id', storeId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapStorePoliciesRowToStorePolicies(data);
  },

  async upsertStorePolicies(payload: StorePoliciesInsert): Promise<StorePolicies> {
    const row = mapStorePoliciesInsertToRow(payload);
    const { data, error } = await supabase
      .from('store_policies')
      .upsert(row, { onConflict: 'store_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after upsert');
    return mapStorePoliciesRowToStorePolicies(data);
  },

  async updateStorePolicies(storeId: string, payload: StorePoliciesUpdate): Promise<StorePolicies> {
    const row = mapStorePoliciesUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_policies')
      .update(row)
      .eq('store_id', storeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapStorePoliciesRowToStorePolicies(data);
  },

  async getStoreHeroSlides(storeId: string): Promise<StoreHeroSlide[]> {
    const { data, error } = await supabase
      .from('store_hero_slides')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreHeroSlideRowToStoreHeroSlide);
  },

  async replaceStoreHeroSlides(storeId: string, slides: StoreHeroSlideInsert[]): Promise<StoreHeroSlide[]> {
    if (slides.length === 0) {
      const { error } = await supabase
        .from('store_hero_slides')
        .delete()
        .eq('store_id', storeId);
      if (error) throw new Error(error.message);
      return [];
    }

    const normalized = slides.map((slide, index) => ({
      ...slide,
      id: slide.id || crypto.randomUUID(),
      storeId,
      sortOrder: index + 1,
    }));

    const { data, error } = await supabase
      .from('store_hero_slides')
      .upsert(normalized.map(mapStoreHeroSlideInsertToRow), { onConflict: 'store_id,sort_order' })
      .select('*');
    if (error) throw new Error(error.message);

    const { error: cleanupError } = await supabase
      .from('store_hero_slides')
      .delete()
      .eq('store_id', storeId)
      .gt('sort_order', normalized.length);
    if (cleanupError) throw new Error(cleanupError.message);

    return (data ?? [])
      .map(mapStoreHeroSlideRowToStoreHeroSlide)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },

  // Members
  async getMyMemberships(): Promise<StoreMember[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const { data, error } = await supabase
      .from('store_members')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'active');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreMemberRowToStoreMember);
  },

  async getStoreMembers(storeId: string): Promise<StoreMember[]> {
    const { data, error } = await supabase
      .from('store_members')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreMemberRowToStoreMember);
  },

  async addStoreMember(payload: StoreMemberInsert): Promise<StoreMember> {
    const invitedBy = await getOwnerId();
    const row = mapStoreMemberInsertToRow({ ...payload, invitedBy });
    const { data, error } = await supabase
      .from('store_members')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after insert');
    return mapStoreMemberRowToStoreMember(data);
  },

  async updateStoreMemberRole(memberId: string, payload: StoreMemberUpdate): Promise<StoreMember> {
    const { data, error } = await supabase
      .from('store_members')
      .update(payload)
      .eq('id', memberId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapStoreMemberRowToStoreMember(data);
  },

  async deactivateStoreMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('store_members')
      .update({ status: 'inactive' })
      .eq('id', memberId);
    if (error) throw new Error(error.message);
  },

  // Limits
  async getStoreLimits(storeId: string): Promise<StoreLimit | null> {
    const { data, error } = await supabase
      .from('store_limits')
      .select('*')
      .eq('store_id', storeId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapStoreLimitRowToStoreLimit(data);
  },

  async updateStoreLimits(storeId: string, payload: StoreLimitUpdate): Promise<StoreLimit> {
    const row = mapStoreLimitUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_limits')
      .update(row)
      .eq('store_id', storeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapStoreLimitRowToStoreLimit(data);
  },

  // Location
  async getStoreLocation(storeId: string): Promise<StoreLocation | null> {
    const { data, error } = await supabase
      .from('store_locations')
      .select('*')
      .eq('store_id', storeId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapStoreLocationRowToStoreLocation(data);
  },

  async upsertStoreLocation(payload: StoreLocationInsert): Promise<StoreLocation> {
    const row = mapStoreLocationInsertToRow(payload);
    const { data, error } = await supabase
      .from('store_locations')
      .upsert(row, { onConflict: 'store_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after upsert');
    return mapStoreLocationRowToStoreLocation(data);
  },

  async updateStoreLocation(storeId: string, payload: StoreLocationUpdate): Promise<StoreLocation> {
    const row = mapStoreLocationUpdateToRow(payload);
    const { data, error } = await supabase
      .from('store_locations')
      .update(row)
      .eq('store_id', storeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapStoreLocationRowToStoreLocation(data);
  },

  // Business hours
  async getStoreBusinessHours(storeId: string): Promise<StoreBusinessHour[]> {
    const { data, error } = await supabase
      .from('store_business_hours')
      .select('*')
      .eq('store_id', storeId)
      .order('day_of_week', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreBusinessHourRowToStoreBusinessHour);
  },

  // Edge Function: create complete store with owner
  async createStoreWithOwner(payload: CreateStoreWithOwnerInput): Promise<CreateStoreWithOwnerResponse> {
    const { data, error } = await supabase.functions.invoke<CreateStoreWithOwnerResponse>(
      'create-store-with-owner',
      { body: payload }
    );
    if (error) throw new Error(await extractFunctionErrorMessage(error));
    if (!data) throw new Error('No response from Edge Function');
    return data;
  },

  // platform_admin-only. Returns availability + reason only — never
  // store_id, name or owner of a conflicting store. Final authority for
  // uniqueness is still the DB constraint checked again at creation time.
  async checkSlugAvailability(rawSlug: string): Promise<SlugAvailabilityResult> {
    const { data, error } = await supabase.rpc('check_store_slug_availability', {
      p_slug: rawSlug,
    });
    if (error) throw new Error(error.message);
    const row = data?.[0] as { available: boolean; normalized_slug: string; reason: string } | undefined;
    if (!row) throw new Error('No se pudo verificar la disponibilidad.');
    return {
      available: row.available,
      normalizedSlug: row.normalized_slug,
      reason: row.reason as SlugAvailabilityReason,
    };
  },

  // Public
  async getPublicStoreBySlug(storeSlug: string): Promise<PublicStorePage | null> {
    const { data, error } = await supabase
      .from('public_store_pages')
      .select('*')
      .eq('store_slug', storeSlug)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapPublicStorePageRowToPublicStorePage(data);
  },

  async getPublicStoreHeroSlides(storeId: string): Promise<PublicStoreHeroSlide[]> {
    const { data, error } = await supabase
      .from('public_store_hero_slides')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapPublicStoreHeroSlideRowToPublicStoreHeroSlide);
  },
};
