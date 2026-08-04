import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type {
  AdminProductReview,
  AdminReviewsPage,
  ProductReviewSummary,
  PublicProductReview,
  PublicReviewConfig,
  PublicReviewInvitation,
  ReviewDashboard,
  ReviewImage,
  ReviewInvitationAdmin,
  ReviewPublicationStatus,
  StoreReviewSettings,
  SubmitProductReviewInput,
  SubmittedReviewReference,
} from './reviews.types';

const client = supabase as unknown as SupabaseClient;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function firstRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return asRecord(value[0]);
  return asRecord(value);
}

function mapSettings(row: Record<string, unknown>): StoreReviewSettings {
  return {
    storeId: String(row.store_id),
    mode: row.mode === 'collect_only' || row.mode === 'public' ? row.mode : 'disabled',
    autoPublish: row.auto_publish !== false,
    showRatingOnCards: row.show_rating_on_cards !== false,
    showProductReviews: row.show_product_reviews !== false,
    showReviewPhotos: row.show_review_photos !== false,
    invitationExpiryDays: Number(row.invitation_expiry_days ?? 90),
    invitationMessage: String(row.invitation_message ?? ''),
  };
}

function mapImages(value: unknown): ReviewImage[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row = asRecord(entry);
    return {
      id: String(row.id),
      imageUrl: String(row.image_url),
      sortOrder: Number(row.sort_order ?? 0),
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

function mapAdminReview(value: unknown): AdminProductReview {
  const row = asRecord(value);
  const product = firstRecord(row.products);
  const order = firstRecord(row.orders);
  const reply = firstRecord(row.product_review_replies);
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    productId: String(row.product_id),
    productName: String(product.name ?? 'Producto'),
    productImageUrl: typeof product.main_image_url === 'string' ? product.main_image_url : null,
    orderNumber: typeof order.order_number === 'string' ? order.order_number : null,
    rating: Number(row.rating),
    title: typeof row.title === 'string' ? row.title : null,
    comment: typeof row.comment === 'string' ? row.comment : null,
    customerDisplayName: String(row.customer_display_name ?? 'Cliente verificado'),
    publicationStatus: row.publication_status as AdminProductReview['publicationStatus'],
    moderationStatus: row.moderation_status as AdminProductReview['moderationStatus'],
    ratingIncluded: row.rating_included !== false,
    hiddenReason: typeof row.hidden_reason === 'string' ? row.hidden_reason : null,
    reply: typeof reply.body === 'string' ? reply.body : null,
    replyUpdatedAt: typeof reply.updated_at === 'string' ? reply.updated_at : null,
    images: mapImages(row.product_review_images),
    createdAt: String(row.created_at),
  };
}

export interface GetAdminReviewsParams {
  status?: ReviewPublicationStatus | 'all';
  rating?: number | null;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const reviewsService = {
  async getSettings(storeId: string): Promise<StoreReviewSettings> {
    const { data, error } = await client.from('store_review_settings').select('*').eq('store_id', storeId).single();
    if (error) throw new Error(error.message);
    return mapSettings(asRecord(data));
  },

  async saveSettings(settings: StoreReviewSettings): Promise<StoreReviewSettings> {
    const { data, error } = await client.from('store_review_settings').upsert({
      store_id: settings.storeId,
      mode: settings.mode,
      auto_publish: settings.autoPublish,
      show_rating_on_cards: settings.showRatingOnCards,
      show_product_reviews: settings.showProductReviews,
      show_review_photos: settings.showReviewPhotos,
      invitation_expiry_days: settings.invitationExpiryDays,
      invitation_message: settings.invitationMessage.trim(),
    }, { onConflict: 'store_id' }).select().single();
    if (error) throw new Error(error.message);
    return mapSettings(asRecord(data));
  },

  async getDashboard(storeId: string): Promise<ReviewDashboard> {
    const { data, error } = await client.rpc('get_store_review_dashboard', { p_store_id: storeId });
    if (error) throw new Error(error.message);
    const row = asRecord(data);
    const mapInsights = (value: unknown) => Array.isArray(value) ? value.map((entry) => {
      const insight = asRecord(entry);
      return {
        productId: String(insight.product_id),
        productName: String(insight.product_name),
        average: Number(insight.average ?? 0),
        count: Number(insight.count ?? 0),
      };
    }) : [];
    return {
      total: Number(row.total ?? 0),
      average: Number(row.average ?? 0),
      published: Number(row.published ?? 0),
      pending: Number(row.pending ?? 0),
      hidden: Number(row.hidden ?? 0),
      removed: Number(row.removed ?? 0),
      withReply: Number(row.with_reply ?? 0),
      distribution: {
        1: Number(row.one ?? 0), 2: Number(row.two ?? 0), 3: Number(row.three ?? 0),
        4: Number(row.four ?? 0), 5: Number(row.five ?? 0),
      },
      bestProducts: mapInsights(row.best_products),
      attentionProducts: mapInsights(row.attention_products),
    };
  },

  async getAdminReviews(storeId: string, params: GetAdminReviewsParams = {}): Promise<AdminReviewsPage> {
    const page = Math.max(0, params.page ?? 0);
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
    let query = client.from('product_reviews').select(
      '*, products(name, main_image_url), orders(order_number), product_review_replies(body, created_at, updated_at), product_review_images(id, image_url, sort_order)',
      { count: 'exact' },
    ).eq('store_id', storeId).order('created_at', { ascending: false });
    if (params.status && params.status !== 'all') query = query.eq('publication_status', params.status);
    if (params.rating) query = query.eq('rating', params.rating);
    const search = params.search?.trim().replace(/[,%_().]/g, ' ');
    if (search) {
      query = query.or(`customer_display_name.ilike.%${search}%,title.ilike.%${search}%,comment.ilike.%${search}%`);
    }
    const { data, error, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    return { items: (data ?? []).map(mapAdminReview), total: count ?? 0 };
  },

  async setStatus(reviewId: string, status: 'published' | 'hidden' | 'removed', reason?: string): Promise<void> {
    const { error } = await client.rpc('set_product_review_status', {
      p_review_id: reviewId,
      p_status: status,
      p_reason: reason?.trim() || null,
    });
    if (error) throw new Error(error.message);
  },

  async saveReply(reviewId: string, body: string): Promise<void> {
    const { error } = await client.rpc('upsert_product_review_reply', { p_review_id: reviewId, p_body: body.trim() });
    if (error) throw new Error(error.message);
  },

  async ensureOrderInvitation(orderId: string): Promise<ReviewInvitationAdmin> {
    const { data, error } = await client.rpc('ensure_order_review_invitation', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    const row = asRecord(data);
    return {
      id: String(row.id),
      token: String(row.token),
      expiresAt: String(row.expires_at),
      submittedAt: typeof row.submitted_at === 'string' ? row.submitted_at : null,
      mode: row.mode === 'public' || row.mode === 'collect_only' ? row.mode : 'disabled',
      invitationMessage: String(row.invitation_message ?? ''),
    };
  },

  async getPublicInvitation(token: string): Promise<PublicReviewInvitation> {
    const { data, error } = await client.rpc('get_review_invitation', { p_token: token });
    if (error) throw new Error(error.message);
    const row = asRecord(data);
    const items = Array.isArray(row.items) ? row.items.map((item) => {
      const entry = asRecord(item);
      return {
        orderItemId: String(entry.order_item_id),
        productId: String(entry.product_id),
        productName: String(entry.product_name),
        variantLabel: typeof entry.variant_label === 'string' ? entry.variant_label : null,
        imageUrl: typeof entry.image_url === 'string' ? entry.image_url : null,
      };
    }) : [];
    return {
      state: String(row.state) as PublicReviewInvitation['state'],
      storeId: typeof row.store_id === 'string' ? row.store_id : null,
      storeSlug: typeof row.store_slug === 'string' ? row.store_slug : null,
      storeName: typeof row.store_name === 'string' ? row.store_name : null,
      logoUrl: typeof row.logo_url === 'string' ? row.logo_url : null,
      customerName: typeof row.customer_name === 'string' ? row.customer_name : null,
      orderNumber: typeof row.order_number === 'string' ? row.order_number : null,
      expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
      showReviewPhotos: row.show_review_photos !== false,
      items,
    };
  },

  async submitVerifiedReviews(token: string, reviews: SubmitProductReviewInput[]): Promise<SubmittedReviewReference[]> {
    const { data, error } = await client.rpc('submit_verified_product_reviews', {
      p_token: token,
      p_reviews: reviews.map((review) => ({
        product_id: review.productId,
        order_item_id: review.orderItemId,
        rating: review.rating,
        title: review.title?.trim() || null,
        comment: review.comment?.trim() || null,
      })),
    });
    if (error) throw new Error(error.message);
    const payload = asRecord(data);
    return Array.isArray(payload.reviews) ? payload.reviews.map((entry) => {
      const row = asRecord(entry);
      return { productId: String(row.product_id), reviewId: String(row.review_id) };
    }) : [];
  },

  async uploadReviewImage(token: string, reviewId: string, file: File, sortOrder: number): Promise<ReviewImage> {
    const body = new FormData();
    body.append('token', token);
    body.append('reviewId', reviewId);
    body.append('sortOrder', String(sortOrder));
    body.append('file', file);
    const { data, error } = await supabase.functions.invoke('upload-review-image', { body });
    if (error) throw new Error(error.message);
    const row = asRecord(data);
    return { id: String(row.id), imageUrl: String(row.imageUrl), sortOrder: Number(row.sortOrder ?? sortOrder) };
  },

  async getPublicConfig(storeSlug: string): Promise<PublicReviewConfig> {
    const { data, error } = await client.from('public_store_review_settings').select('*').eq('store_slug', storeSlug).maybeSingle();
    if (error) throw new Error(error.message);
    const row = asRecord(data);
    return {
      mode: row.mode === 'public' || row.mode === 'collect_only' ? row.mode : 'disabled',
      showRatingOnCards: row.show_rating_on_cards !== false,
      showProductReviews: row.show_product_reviews !== false,
      showReviewPhotos: row.show_review_photos !== false,
    };
  },

  async getPublicSummaries(productIds: string[]): Promise<Map<string, ProductReviewSummary>> {
    const ids = Array.from(new Set(productIds.filter(Boolean)));
    if (ids.length === 0) return new Map();
    const batches = Array.from({ length: Math.ceil(ids.length / 200) }, (_, index) => ids.slice(index * 200, index * 200 + 200));
    const results = await Promise.all(batches.map((batch) => client.from('public_product_review_summaries').select('*').in('product_id', batch)));
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);
    const rows = results.flatMap((result) => result.data ?? []);
    return new Map(rows.map((value) => {
      const row = asRecord(value);
      const summary: ProductReviewSummary = {
        productId: String(row.product_id),
        averageRating: Number(row.average_rating ?? 0),
        reviewCount: Number(row.review_count ?? 0),
        distribution: {
          1: Number(row.one_count ?? 0), 2: Number(row.two_count ?? 0), 3: Number(row.three_count ?? 0),
          4: Number(row.four_count ?? 0), 5: Number(row.five_count ?? 0),
        },
      };
      return [summary.productId, summary];
    }));
  },

  async getPublicProductReviews(productId: string, limit = 50): Promise<PublicProductReview[]> {
    const { data, error } = await client.from('public_product_reviews').select('*').eq('product_id', productId)
      .order('created_at', { ascending: false }).limit(Math.min(100, Math.max(1, limit)));
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const ids = rows.map((value) => String(asRecord(value).id));
    const imagesByReview = new Map<string, ReviewImage[]>();
    if (ids.length > 0) {
      const imagesResult = await client.from('public_product_review_images').select('*').in('review_id', ids).order('sort_order');
      if (imagesResult.error) throw new Error(imagesResult.error.message);
      for (const value of imagesResult.data ?? []) {
        const row = asRecord(value);
        const reviewId = String(row.review_id);
        const images = imagesByReview.get(reviewId) ?? [];
        images.push({ id: String(row.id), imageUrl: String(row.image_url), sortOrder: Number(row.sort_order ?? 0) });
        imagesByReview.set(reviewId, images);
      }
    }
    return rows.map((value) => {
      const row = asRecord(value);
      return {
        id: String(row.id),
        productId: String(row.product_id),
        rating: Number(row.rating),
        title: typeof row.title === 'string' ? row.title : null,
        comment: typeof row.comment === 'string' ? row.comment : null,
        customerDisplayName: String(row.customer_display_name),
        createdAt: String(row.created_at),
        merchantReply: typeof row.merchant_reply === 'string' ? row.merchant_reply : null,
        merchantRepliedAt: typeof row.merchant_replied_at === 'string' ? row.merchant_replied_at : null,
        images: imagesByReview.get(String(row.id)) ?? [],
      };
    });
  },
};
