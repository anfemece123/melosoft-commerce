import { supabase } from '@/lib/supabase';
import type { Offer, OfferInsert, OfferUpdate } from './offers.types';
import type { PublicOfferPage, StoreCampaignOffer, CampaignOfferSession } from '@/types/common.types';
import {
  mapOfferRowToOffer,
  mapOfferInsertToRow,
  mapOfferUpdateToRow,
  mapPublicOfferPageRowToPublicOfferPage,
  mapStoreCampaignOfferRowToStoreCampaignOffer,
} from './offers.mapper';

async function getOwnerId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
}

interface RpcSessionRow {
  id: string;
  offer_id: string;
  visitor_token: string;
  first_seen_at: string;
  expires_at: string;
  claim_code: string;
  created_at: string;
  updated_at: string;
  error?: string;
}

export const offersService = {
  async getOffersByStore(storeId: string): Promise<Offer[]> {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapOfferRowToOffer);
  },

  async getOfferById(id: string): Promise<Offer | null> {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapOfferRowToOffer(data);
  },

  async getPublicOfferBySlug(storeSlug: string, offerSlug: string): Promise<PublicOfferPage | null> {
    const { data, error } = await supabase
      .from('public_offer_pages')
      .select('*')
      .eq('store_slug', storeSlug)
      .eq('offer_slug', offerSlug)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapPublicOfferPageRowToPublicOfferPage(data);
  },

  async getPublicStoreCampaignOffers(storeSlug: string): Promise<StoreCampaignOffer[]> {
    const { data, error } = await supabase
      .from('public_store_campaign_offers')
      .select('*')
      .eq('store_slug', storeSlug)
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStoreCampaignOfferRowToStoreCampaignOffer);
  },

  async getOrCreateVisitorSession(
    offerId: string,
    visitorToken: string
  ): Promise<CampaignOfferSession> {
    const { data, error } = await supabase.rpc('get_or_create_campaign_offer_session', {
      p_offer_id: offerId,
      p_visitor_token: visitorToken,
    });
    if (error) throw new Error(error.message);
    const row = data as unknown as RpcSessionRow;
    if (row.error) throw new Error(row.error);
    return {
      id: row.id,
      offerId: row.offer_id,
      visitorToken: row.visitor_token,
      firstSeenAt: row.first_seen_at,
      expiresAt: row.expires_at,
      claimCode: row.claim_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async createOffer(payload: OfferInsert): Promise<Offer> {
    const ownerId = await getOwnerId();
    const row = mapOfferInsertToRow(payload, ownerId);
    const { data, error } = await supabase
      .from('offers')
      .insert(row)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after insert');
    return mapOfferRowToOffer(data);
  },

  async updateOffer(id: string, payload: OfferUpdate): Promise<Offer> {
    const row = mapOfferUpdateToRow(payload);
    const { data, error } = await supabase
      .from('offers')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned after update');
    return mapOfferRowToOffer(data);
  },

  async uploadOfferImage(
    ownerId: string,
    storeId: string,
    offerId: string,
    file: File
  ): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${ownerId}/stores/${storeId}/offers/${offerId}/hero.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('store-assets')
      .upload(path, file, { upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from('store-assets').getPublicUrl(path);
    return data.publicUrl;
  },

  async archiveOffer(id: string): Promise<Offer> {
    return offersService.updateOffer(id, { status: 'archived' });
  },

  async pauseOffer(id: string): Promise<Offer> {
    return offersService.updateOffer(id, { status: 'paused' });
  },

  async activateOffer(id: string): Promise<Offer> {
    return offersService.updateOffer(id, { status: 'active' });
  },

  async deleteOffer(id: string): Promise<void> {
    const { error } = await supabase.from('offers').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
