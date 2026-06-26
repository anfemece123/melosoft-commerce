import type {
  OfferRow,
  OfferRowInsert,
  OfferRowUpdate,
  OfferImageRow,
  PublicOfferPageRow,
  PublicStoreCampaignOfferRow,
} from '@/types/database.types';
import type {
  OfferStatus,
  CountdownMode,
  PublicOfferPage,
  StoreCampaignOffer,
  TemplateKey,
  ThemeMode,
} from '@/types/common.types';
import type { Offer, OfferImage, OfferInsert, OfferUpdate } from './offers.types';

// ── Row → App model ─────────────────────────────────────────

export function mapOfferRowToOffer(row: OfferRow): Offer {
  return {
    id: row.id,
    storeId: row.store_id,
    ownerId: row.owner_id,
    productId: row.product_id,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    description: row.description,
    regularPrice: Number(row.regular_price),
    offerPrice: Number(row.offer_price),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    durationMinutes: row.duration_minutes,
    countdownMode: row.countdown_mode as CountdownMode,
    showCountdown: row.show_countdown,
    isVisibleInStore: row.is_visible_in_store,
    sortOrder: row.sort_order,
    status: row.status as OfferStatus,
    whatsappNumber: row.whatsapp_number,
    whatsappMessage: row.whatsapp_message,
    ctaLabel: row.cta_label,
    heroImageUrl: row.hero_image_url,
    termsAndConditions: row.terms_and_conditions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOfferImageRowToOfferImage(row: OfferImageRow): OfferImage {
  return {
    id: row.id,
    storeId: row.store_id,
    offerId: row.offer_id,
    ownerId: row.owner_id,
    imageUrl: row.image_url,
    storagePath: row.storage_path,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export function mapPublicOfferPageRowToPublicOfferPage(row: PublicOfferPageRow): PublicOfferPage {
  return {
    storeSlug: row.store_slug,
    storeName: row.store_name,
    storeWhatsappNumber: row.store_whatsapp_number,
    logoUrl: row.logo_url,
    themeMode: row.theme_mode as ThemeMode | null,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    buttonRadius: row.button_radius,
    templateKey: row.template_key as TemplateKey | null,
    offerId: row.offer_id,
    offerSlug: row.offer_slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    regularPrice: Number(row.regular_price),
    offerPrice: Number(row.offer_price),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    durationMinutes: row.duration_minutes,
    countdownMode: row.countdown_mode as CountdownMode,
    showCountdown: row.show_countdown,
    isVisibleInStore: row.is_visible_in_store,
    sortOrder: row.sort_order,
    status: row.status as OfferStatus,
    offerWhatsappNumber: row.offer_whatsapp_number,
    whatsappMessage: row.whatsapp_message,
    ctaLabel: row.cta_label,
    heroImageUrl: row.hero_image_url,
    termsAndConditions: row.terms_and_conditions,
    productName: row.product_name,
    productSlug: row.product_slug,
    productMainImageUrl: row.product_main_image_url,
  };
}

export function mapStoreCampaignOfferRowToStoreCampaignOffer(
  row: PublicStoreCampaignOfferRow
): StoreCampaignOffer {
  return {
    id: row.id,
    storeId: row.store_id,
    storeSlug: row.store_slug,
    offerSlug: row.offer_slug,
    title: row.title,
    subtitle: row.subtitle,
    offerPrice: Number(row.offer_price),
    regularPrice: Number(row.regular_price),
    countdownMode: row.countdown_mode as CountdownMode,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    durationMinutes: row.duration_minutes,
    showCountdown: row.show_countdown,
    sortOrder: row.sort_order,
    heroImageUrl: row.hero_image_url,
    productName: row.product_name,
    productSlug: row.product_slug,
    productMainImageUrl: row.product_main_image_url,
  };
}

// ── App model → Insert row ───────────────────────────────────

export function mapOfferInsertToRow(data: OfferInsert, ownerId: string): OfferRowInsert {
  return {
    store_id: data.storeId,
    owner_id: ownerId,
    product_id: data.productId ?? null,
    title: data.title,
    slug: data.slug,
    subtitle: data.subtitle ?? null,
    description: data.description,
    regular_price: data.regularPrice,
    offer_price: data.offerPrice,
    starts_at: data.startsAt ?? null,
    ends_at: data.endsAt ?? null,
    duration_minutes: data.durationMinutes ?? null,
    countdown_mode: data.countdownMode,
    show_countdown: data.showCountdown,
    is_visible_in_store: data.isVisibleInStore,
    sort_order: data.sortOrder,
    status: data.status,
    whatsapp_number: data.whatsappNumber ?? null,
    whatsapp_message: data.whatsappMessage ?? null,
    cta_label: data.ctaLabel,
    hero_image_url: data.heroImageUrl ?? null,
    terms_and_conditions: data.termsAndConditions ?? null,
  };
}

// ── App model → Update row ───────────────────────────────────

export function mapOfferUpdateToRow(data: OfferUpdate): OfferRowUpdate {
  const row: OfferRowUpdate = {};
  if (data.productId !== undefined) row.product_id = data.productId ?? null;
  if (data.title !== undefined) row.title = data.title;
  if (data.slug !== undefined) row.slug = data.slug;
  if (data.subtitle !== undefined) row.subtitle = data.subtitle ?? null;
  if (data.description !== undefined) row.description = data.description;
  if (data.regularPrice !== undefined) row.regular_price = data.regularPrice;
  if (data.offerPrice !== undefined) row.offer_price = data.offerPrice;
  if (data.startsAt !== undefined) row.starts_at = data.startsAt ?? null;
  if (data.endsAt !== undefined) row.ends_at = data.endsAt ?? null;
  if (data.durationMinutes !== undefined) row.duration_minutes = data.durationMinutes ?? null;
  if (data.countdownMode !== undefined) row.countdown_mode = data.countdownMode;
  if (data.showCountdown !== undefined) row.show_countdown = data.showCountdown;
  if (data.isVisibleInStore !== undefined) row.is_visible_in_store = data.isVisibleInStore;
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
  if (data.status !== undefined) row.status = data.status;
  if (data.whatsappNumber !== undefined) row.whatsapp_number = data.whatsappNumber ?? null;
  if (data.whatsappMessage !== undefined) row.whatsapp_message = data.whatsappMessage ?? null;
  if (data.ctaLabel !== undefined) row.cta_label = data.ctaLabel;
  if (data.heroImageUrl !== undefined) row.hero_image_url = data.heroImageUrl ?? null;
  if (data.termsAndConditions !== undefined) row.terms_and_conditions = data.termsAndConditions ?? null;
  return row;
}
