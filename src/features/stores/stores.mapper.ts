import type { Json } from '@/types/database.types';
import type {
  StoreRow,
  StoreRowInsert,
  StoreRowUpdate,
  StoreThemeRow,
  StoreThemeRowInsert,
  StoreThemeRowUpdate,
  StorePoliciesRow,
  StorePoliciesRowInsert,
  StorePoliciesRowUpdate,
  StoreHeroSlideRow,
  StoreHeroSlideRowInsert,
  StoreHeroSlideRowUpdate,
  PublicStorePageRow,
  PublicStoreHeroSlideRow,
  StoreMemberRow,
  StoreMemberRowInsert,
  StoreLimitRow,
  StoreLimitRowUpdate,
  StoreLocationRow,
  StoreLocationRowInsert,
  StoreLocationRowUpdate,
  StoreBusinessHourRow,
  StoreBusinessHourRowInsert,
} from '@/types/database.types';
import type {
  BusinessVertical,
  StoreStatus,
  ThemeMode,
  TemplateKey,
  PublicStorePage,
  StoreMemberRole,
  StoreMemberStatus,
  PlanKey,
  BusinessType,
  ThemePreset,
  CatalogType,
  CommerceMode,
  DeliveryMode,
  OrderMethod,
  PublicStoreHeroSlide,
  PublicHeaderSettings,
} from '@/types/common.types';
import type {
  Store,
  StoreTheme,
  StorePolicies,
  StoreInsert,
  StoreUpdate,
  StoreThemeInsert,
  StoreThemeUpdate,
  StorePoliciesInsert,
  StorePoliciesUpdate,
  StoreHeroSlide,
  StoreHeroSlideInsert,
  StoreHeroSlideUpdate,
  StoreMember,
  StoreMemberInsert,
  StoreLimit,
  StoreLimitUpdate,
  StoreLocation,
  StoreLocationInsert,
  StoreLocationUpdate,
  StoreBusinessHour,
  StoreBusinessHourInsert,
} from './stores.types';

// ── Row → App model ─────────────────────────────────────────

export function mapStoreRowToStore(row: StoreRow): Store {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    slogan: row.slogan ?? null,
    businessType: (row.business_type as BusinessType) ?? null,
    businessVertical: (row.business_vertical as BusinessVertical) ?? null,
    businessSubcategory: row.business_subcategory ?? null,
    description: row.description,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    heroEnabled: row.hero_enabled ?? true,
    heroTitle: row.hero_title ?? null,
    heroSubtitle: row.hero_subtitle ?? null,
    heroCtaLabel: row.hero_cta_label ?? null,
    heroImageUrl: row.hero_image_url ?? null,
    heroBackgroundImageUrl: row.hero_background_image_url ?? null,
    whatsappNumber: row.whatsapp_number,
    supportEmail: row.support_email,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    tiktokUrl: row.tiktok_url,
    country: row.country,
    city: row.city,
    currency: row.currency,
    status: row.status as StoreStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreThemeRowToStoreTheme(row: StoreThemeRow): StoreTheme {
  return {
    id: row.id,
    storeId: row.store_id,
    mode: row.mode as ThemeMode,
    themePreset: (row.theme_preset as ThemePreset) ?? 'blue',
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    buttonRadius: row.button_radius,
    templateKey: row.template_key as TemplateKey,
    headerSettings: (row.header_settings as PublicHeaderSettings | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStorePoliciesRowToStorePolicies(row: StorePoliciesRow): StorePolicies {
  return {
    id: row.id,
    storeId: row.store_id,
    shippingPolicy: row.shipping_policy,
    returnsPolicy: row.returns_policy,
    warrantyPolicy: row.warranty_policy,
    privacyPolicy: row.privacy_policy,
    termsAndConditions: row.terms_and_conditions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPublicStorePageRowToPublicStorePage(row: PublicStorePageRow): PublicStorePage {
  return {
    storeId: row.store_id,
    storeSlug: row.store_slug,
    storeName: row.store_name,
    slogan: row.slogan,
    businessType: row.business_type,
    description: row.description,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    heroEnabled: row.hero_enabled,
    heroTitle: row.hero_title,
    heroSubtitle: row.hero_subtitle,
    heroCtaLabel: row.hero_cta_label,
    heroImageUrl: row.hero_image_url,
    heroBackgroundImageUrl: row.hero_background_image_url,
    whatsappNumber: row.whatsapp_number,
    supportEmail: row.support_email,
    country: row.country,
    city: row.city,
    currency: row.currency,
    themeMode: row.theme_mode as ThemeMode | null,
    themePreset: row.theme_preset as ThemePreset | null,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    buttonRadius: row.button_radius,
    templateKey: row.template_key as TemplateKey | null,
    shippingPolicy: row.shipping_policy,
    returnsPolicy: row.returns_policy,
    warrantyPolicy: row.warranty_policy,
    privacyPolicy: row.privacy_policy,
    termsAndConditions: row.terms_and_conditions,
    locationAddress: row.location_address,
    locationNeighborhood: row.location_neighborhood,
    locationCity: row.location_city,
    locationDepartment: row.location_department,
    locationCountry: row.location_country,
    locationLatitude: row.location_latitude,
    locationLongitude: row.location_longitude,
    catalogType: (row.catalog_type as CatalogType) ?? null,
    businessCategory: row.business_category ?? null,
    commerceMode: (row.commerce_mode as CommerceMode) ?? null,
    deliveryMode: (row.delivery_mode as DeliveryMode) ?? null,
    allowsPickup: row.allows_pickup ?? null,
    allowsLocalDelivery: row.allows_local_delivery ?? null,
    allowsNationalShipping: row.allows_national_shipping ?? null,
    whatsappCheckoutEnabled: row.whatsapp_checkout_enabled ?? null,
    webOrderEnabled: row.web_order_enabled ?? null,
    cashOnDeliveryEnabled: row.cash_on_delivery_enabled ?? null,
    onlineCheckoutEnabled: row.online_checkout_enabled ?? null,
    defaultOrderMethod: (row.default_order_method as OrderMethod) ?? null,
    localDeliveryNotes: row.local_delivery_notes ?? null,
    shippingNotes: row.shipping_notes ?? null,
    headerSettings: (row.header_settings as PublicHeaderSettings | null) ?? null,
  };
}

// ── App model → Insert row ───────────────────────────────────

export function mapStoreInsertToRow(data: StoreInsert, ownerId: string): StoreRowInsert {
  return {
    owner_id: ownerId,
    name: data.name,
    slug: data.slug,
    slogan: data.slogan ?? null,
    business_type: data.businessType ?? null,
    business_vertical: data.businessVertical ?? null,
    business_subcategory: data.businessSubcategory ?? null,
    description: data.description ?? null,
    logo_url: data.logoUrl ?? null,
    favicon_url: data.faviconUrl ?? null,
    hero_enabled: data.heroEnabled ?? true,
    hero_title: data.heroTitle ?? null,
    hero_subtitle: data.heroSubtitle ?? null,
    hero_cta_label: data.heroCtaLabel ?? null,
    hero_image_url: data.heroImageUrl ?? null,
    hero_background_image_url: data.heroBackgroundImageUrl ?? null,
    whatsapp_number: data.whatsappNumber ?? null,
    support_email: data.supportEmail ?? null,
    instagram_url: data.instagramUrl ?? null,
    facebook_url: data.facebookUrl ?? null,
    tiktok_url: data.tiktokUrl ?? null,
    country: data.country,
    city: data.city ?? null,
    currency: data.currency,
    status: data.status,
  };
}

export function mapStoreUpdateToRow(data: StoreUpdate): StoreRowUpdate {
  const row: StoreRowUpdate = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.slug !== undefined) row.slug = data.slug;
  if (data.slogan !== undefined) row.slogan = data.slogan ?? null;
  if (data.businessType !== undefined) row.business_type = data.businessType ?? null;
  if (data.businessVertical !== undefined) row.business_vertical = data.businessVertical ?? null;
  if (data.businessSubcategory !== undefined) row.business_subcategory = data.businessSubcategory ?? null;
  if (data.description !== undefined) row.description = data.description ?? null;
  if (data.logoUrl !== undefined) row.logo_url = data.logoUrl ?? null;
  if (data.faviconUrl !== undefined) row.favicon_url = data.faviconUrl ?? null;
  if (data.heroEnabled !== undefined) row.hero_enabled = data.heroEnabled;
  if (data.heroTitle !== undefined) row.hero_title = data.heroTitle ?? null;
  if (data.heroSubtitle !== undefined) row.hero_subtitle = data.heroSubtitle ?? null;
  if (data.heroCtaLabel !== undefined) row.hero_cta_label = data.heroCtaLabel ?? null;
  if (data.heroImageUrl !== undefined) row.hero_image_url = data.heroImageUrl ?? null;
  if (data.heroBackgroundImageUrl !== undefined) row.hero_background_image_url = data.heroBackgroundImageUrl ?? null;
  if (data.whatsappNumber !== undefined) row.whatsapp_number = data.whatsappNumber ?? null;
  if (data.supportEmail !== undefined) row.support_email = data.supportEmail ?? null;
  if (data.instagramUrl !== undefined) row.instagram_url = data.instagramUrl ?? null;
  if (data.facebookUrl !== undefined) row.facebook_url = data.facebookUrl ?? null;
  if (data.tiktokUrl !== undefined) row.tiktok_url = data.tiktokUrl ?? null;
  if (data.country !== undefined) row.country = data.country;
  if (data.city !== undefined) row.city = data.city ?? null;
  if (data.currency !== undefined) row.currency = data.currency;
  if (data.status !== undefined) row.status = data.status;
  return row;
}

export function mapStoreThemeInsertToRow(data: StoreThemeInsert): StoreThemeRowInsert {
  return {
    store_id: data.storeId,
    mode: data.mode,
    theme_preset: data.themePreset,
    primary_color: data.primaryColor ?? null,
    secondary_color: data.secondaryColor ?? null,
    accent_color: data.accentColor ?? null,
    background_color: data.backgroundColor ?? null,
    text_color: data.textColor ?? null,
    button_radius: data.buttonRadius ?? null,
    template_key: data.templateKey,
    header_settings: (data.headerSettings ?? null) as Json | null,
  };
}

export function mapStoreThemeUpdateToRow(data: StoreThemeUpdate): StoreThemeRowUpdate {
  const row: StoreThemeRowUpdate = {};
  if (data.mode !== undefined) row.mode = data.mode;
  if (data.themePreset !== undefined) row.theme_preset = data.themePreset;
  if (data.primaryColor !== undefined) row.primary_color = data.primaryColor ?? null;
  if (data.secondaryColor !== undefined) row.secondary_color = data.secondaryColor ?? null;
  if (data.accentColor !== undefined) row.accent_color = data.accentColor ?? null;
  if (data.backgroundColor !== undefined) row.background_color = data.backgroundColor ?? null;
  if (data.textColor !== undefined) row.text_color = data.textColor ?? null;
  if (data.buttonRadius !== undefined) row.button_radius = data.buttonRadius ?? null;
  if (data.templateKey !== undefined) row.template_key = data.templateKey;
  if (data.headerSettings !== undefined) row.header_settings = (data.headerSettings ?? null) as Json | null;
  return row;
}

export function mapStorePoliciesInsertToRow(data: StorePoliciesInsert): StorePoliciesRowInsert {
  return {
    store_id: data.storeId,
    shipping_policy: data.shippingPolicy ?? null,
    returns_policy: data.returnsPolicy ?? null,
    warranty_policy: data.warrantyPolicy ?? null,
    privacy_policy: data.privacyPolicy ?? null,
    terms_and_conditions: data.termsAndConditions ?? null,
  };
}

export function mapStorePoliciesUpdateToRow(data: StorePoliciesUpdate): StorePoliciesRowUpdate {
  const row: StorePoliciesRowUpdate = {};
  if (data.shippingPolicy !== undefined) row.shipping_policy = data.shippingPolicy ?? null;
  if (data.returnsPolicy !== undefined) row.returns_policy = data.returnsPolicy ?? null;
  if (data.warrantyPolicy !== undefined) row.warranty_policy = data.warrantyPolicy ?? null;
  if (data.privacyPolicy !== undefined) row.privacy_policy = data.privacyPolicy ?? null;
  if (data.termsAndConditions !== undefined) row.terms_and_conditions = data.termsAndConditions ?? null;
  return row;
}

export function mapStoreHeroSlideRowToStoreHeroSlide(row: StoreHeroSlideRow): StoreHeroSlide {
  return {
    id: row.id,
    storeId: row.store_id,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    showTitle: row.show_title,
    showSubtitle: row.show_subtitle,
    showCta: row.show_cta,
    showMainImage: row.show_main_image,
    showBadgeImage: row.show_badge_image,
    title: row.title,
    subtitle: row.subtitle,
    ctaLabel: row.cta_label,
    mainImageUrl: row.main_image_url,
    backgroundImageUrl: row.background_image_url,
    badgeImageUrl: row.badge_image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreHeroSlideInsertToRow(data: StoreHeroSlideInsert): StoreHeroSlideRowInsert {
  return {
    id: data.id,
    store_id: data.storeId,
    sort_order: data.sortOrder,
    is_active: data.isActive,
    show_title: data.showTitle,
    show_subtitle: data.showSubtitle,
    show_cta: data.showCta,
    show_main_image: data.showMainImage,
    show_badge_image: data.showBadgeImage,
    title: data.title ?? null,
    subtitle: data.subtitle ?? null,
    cta_label: data.ctaLabel ?? null,
    main_image_url: data.mainImageUrl ?? null,
    background_image_url: data.backgroundImageUrl ?? null,
    badge_image_url: data.badgeImageUrl ?? null,
  };
}

export function mapStoreHeroSlideUpdateToRow(data: StoreHeroSlideUpdate): StoreHeroSlideRowUpdate {
  const row: StoreHeroSlideRowUpdate = {};
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  if (data.showTitle !== undefined) row.show_title = data.showTitle;
  if (data.showSubtitle !== undefined) row.show_subtitle = data.showSubtitle;
  if (data.showCta !== undefined) row.show_cta = data.showCta;
  if (data.showMainImage !== undefined) row.show_main_image = data.showMainImage;
  if (data.showBadgeImage !== undefined) row.show_badge_image = data.showBadgeImage;
  if (data.title !== undefined) row.title = data.title ?? null;
  if (data.subtitle !== undefined) row.subtitle = data.subtitle ?? null;
  if (data.ctaLabel !== undefined) row.cta_label = data.ctaLabel ?? null;
  if (data.mainImageUrl !== undefined) row.main_image_url = data.mainImageUrl ?? null;
  if (data.backgroundImageUrl !== undefined) row.background_image_url = data.backgroundImageUrl ?? null;
  if (data.badgeImageUrl !== undefined) row.badge_image_url = data.badgeImageUrl ?? null;
  return row;
}

// ── StoreMember mappers ──────────────────────────────────────

export function mapStoreMemberRowToStoreMember(row: StoreMemberRow): StoreMember {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    role: row.role as StoreMemberRole,
    status: row.status as StoreMemberStatus,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreMemberInsertToRow(data: StoreMemberInsert): StoreMemberRowInsert {
  return {
    store_id: data.storeId,
    user_id: data.userId,
    role: data.role,
    status: data.status,
    invited_by: data.invitedBy ?? null,
  };
}

// ── StoreLimit mappers ───────────────────────────────────────

export function mapStoreLimitRowToStoreLimit(row: StoreLimitRow): StoreLimit {
  return {
    id: row.id,
    storeId: row.store_id,
    planKey: row.plan_key as PlanKey,
    maxProducts: row.max_products,
    maxStaff: row.max_staff,
    maxActiveOffers: row.max_active_offers,
    maxMonthlyOrders: row.max_monthly_orders,
    canUsePayments: row.can_use_payments,
    canUseCustomDomain: row.can_use_custom_domain,
    canUseAdvancedTheme: row.can_use_advanced_theme,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreLimitUpdateToRow(data: StoreLimitUpdate): StoreLimitRowUpdate {
  const row: StoreLimitRowUpdate = {};
  if (data.planKey !== undefined) row.plan_key = data.planKey;
  if (data.maxProducts !== undefined) row.max_products = data.maxProducts;
  if (data.maxStaff !== undefined) row.max_staff = data.maxStaff;
  if (data.maxActiveOffers !== undefined) row.max_active_offers = data.maxActiveOffers;
  if (data.maxMonthlyOrders !== undefined) row.max_monthly_orders = data.maxMonthlyOrders;
  if (data.canUsePayments !== undefined) row.can_use_payments = data.canUsePayments;
  if (data.canUseCustomDomain !== undefined) row.can_use_custom_domain = data.canUseCustomDomain;
  if (data.canUseAdvancedTheme !== undefined) row.can_use_advanced_theme = data.canUseAdvancedTheme;
  return row;
}

// ── StoreLocation mappers ────────────────────────────────────

export function mapStoreLocationRowToStoreLocation(row: StoreLocationRow): StoreLocation {
  return {
    id: row.id,
    storeId: row.store_id,
    addressLine: row.address_line,
    neighborhood: row.neighborhood,
    city: row.city,
    department: row.department,
    country: row.country,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreLocationInsertToRow(data: StoreLocationInsert): StoreLocationRowInsert {
  return {
    store_id: data.storeId,
    address_line: data.addressLine ?? null,
    neighborhood: data.neighborhood ?? null,
    city: data.city ?? null,
    department: data.department ?? null,
    country: data.country,
    postal_code: data.postalCode ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    is_public: data.isPublic,
  };
}

export function mapStoreLocationUpdateToRow(data: StoreLocationUpdate): StoreLocationRowUpdate {
  const row: StoreLocationRowUpdate = {};
  if (data.addressLine !== undefined) row.address_line = data.addressLine ?? null;
  if (data.neighborhood !== undefined) row.neighborhood = data.neighborhood ?? null;
  if (data.city !== undefined) row.city = data.city ?? null;
  if (data.department !== undefined) row.department = data.department ?? null;
  if (data.country !== undefined) row.country = data.country;
  if (data.postalCode !== undefined) row.postal_code = data.postalCode ?? null;
  if (data.latitude !== undefined) row.latitude = data.latitude ?? null;
  if (data.longitude !== undefined) row.longitude = data.longitude ?? null;
  if (data.isPublic !== undefined) row.is_public = data.isPublic;
  return row;
}

// ── StoreBusinessHour mappers ────────────────────────────────

export function mapStoreBusinessHourRowToStoreBusinessHour(row: StoreBusinessHourRow): StoreBusinessHour {
  return {
    id: row.id,
    storeId: row.store_id,
    dayOfWeek: row.day_of_week,
    isOpen: row.is_open,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    breakStartsAt: row.break_starts_at,
    breakEndsAt: row.break_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreBusinessHourInsertToRow(data: StoreBusinessHourInsert): StoreBusinessHourRowInsert {
  return {
    store_id: data.storeId,
    day_of_week: data.dayOfWeek,
    is_open: data.isOpen,
    opens_at: data.opensAt ?? null,
    closes_at: data.closesAt ?? null,
    break_starts_at: data.breakStartsAt ?? null,
    break_ends_at: data.breakEndsAt ?? null,
  };
}

export function mapPublicStoreHeroSlideRowToPublicStoreHeroSlide(
  row: PublicStoreHeroSlideRow,
): PublicStoreHeroSlide {
  return {
    id: row.id,
    storeId: row.store_id,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    showTitle: row.show_title,
    showSubtitle: row.show_subtitle,
    showCta: row.show_cta,
    showMainImage: row.show_main_image,
    showBadgeImage: row.show_badge_image,
    title: row.title,
    subtitle: row.subtitle,
    ctaLabel: row.cta_label,
    mainImageUrl: row.main_image_url,
    backgroundImageUrl: row.background_image_url,
    badgeImageUrl: row.badge_image_url,
  };
}
