import type {
  BusinessCategory,
  BusinessType,
  BusinessVertical,
  CatalogType,
  CommerceMode,
  DeliveryMode,
  OrderFlowType,
  OrderMethod,
} from '@/types/common.types';
import type { StoreCommerceSettings, StoreCommerceSettingsUpdate } from './storeCommerce.types';

export interface CommerceProfile {
  category: BusinessCategory;
  label: string;
  description: string;
  lockedCatalogType?: CatalogType;
  allowedCatalogTypes: CatalogType[];
  allowedCommerceModes: CommerceMode[];
  allowedDeliveryModes: DeliveryMode[];
  allowPickup: boolean;
  allowLocalDelivery: boolean;
  allowNationalShipping: boolean;
  allowWhatsappOrders: boolean;
  allowWebsiteOrders: boolean;
  allowCashOnDelivery: boolean;
}

export const COMMERCE_PROFILES: Record<BusinessCategory, CommerceProfile> = {
  restaurant: {
    category: 'restaurant',
    label: 'Restaurante',
    description: 'Menú local con pedidos por WhatsApp o desde la web. No maneja envíos nacionales.',
    lockedCatalogType: 'menu',
    allowedCatalogTypes: ['menu'],
    allowedCommerceModes: ['catalog_only', 'local_orders', 'local_delivery_and_pickup'],
    allowedDeliveryModes: ['none', 'pickup_only', 'local_delivery'],
    allowPickup: true,
    allowLocalDelivery: true,
    allowNationalShipping: false,
    allowWhatsappOrders: true,
    allowWebsiteOrders: true,
    allowCashOnDelivery: true,
  },
  retail: {
    category: 'retail',
    label: 'Venta de productos',
    description: 'Catálogo de productos con carrito, checkout y opciones de envío local y nacional.',
    allowedCatalogTypes: ['physical_products'],
    allowedCommerceModes: ['catalog_only', 'local_orders', 'local_delivery_and_pickup', 'national_shipping', 'mixed'],
    allowedDeliveryModes: ['none', 'pickup_only', 'local_delivery', 'national_shipping', 'local_and_national'],
    allowPickup: true,
    allowLocalDelivery: true,
    allowNationalShipping: true,
    allowWhatsappOrders: true,
    allowWebsiteOrders: true,
    allowCashOnDelivery: true,
  },
  fashion: {
    category: 'fashion',
    label: 'Moda',
    description: 'Productos físicos con retiro, domicilio local y envíos nacionales.',
    allowedCatalogTypes: ['physical_products'],
    allowedCommerceModes: ['catalog_only', 'local_orders', 'local_delivery_and_pickup', 'national_shipping', 'mixed'],
    allowedDeliveryModes: ['none', 'pickup_only', 'local_delivery', 'national_shipping', 'local_and_national'],
    allowPickup: true,
    allowLocalDelivery: true,
    allowNationalShipping: true,
    allowWhatsappOrders: true,
    allowWebsiteOrders: true,
    allowCashOnDelivery: true,
  },
  beauty: {
    category: 'beauty',
    label: 'Belleza',
    description: 'Venta de productos de belleza y cosméticos. Domicilio y recogida en tienda.',
    allowedCatalogTypes: ['physical_products'],
    allowedCommerceModes: ['catalog_only', 'local_orders', 'local_delivery_and_pickup'],
    allowedDeliveryModes: ['none', 'pickup_only', 'local_delivery'],
    allowPickup: true,
    allowLocalDelivery: true,
    allowNationalShipping: false,
    allowWhatsappOrders: true,
    allowWebsiteOrders: true,
    allowCashOnDelivery: true,
  },
  technology: {
    category: 'technology',
    label: 'Tecnología',
    description: 'Productos físicos con operación local y nacional.',
    allowedCatalogTypes: ['physical_products'],
    allowedCommerceModes: ['catalog_only', 'local_orders', 'local_delivery_and_pickup', 'national_shipping', 'mixed'],
    allowedDeliveryModes: ['none', 'pickup_only', 'local_delivery', 'national_shipping', 'local_and_national'],
    allowPickup: true,
    allowLocalDelivery: true,
    allowNationalShipping: true,
    allowWhatsappOrders: true,
    allowWebsiteOrders: true,
    allowCashOnDelivery: true,
  },
  pets: {
    category: 'pets',
    label: 'Mascotas',
    description: 'Catálogo de productos locales o nacionales.',
    allowedCatalogTypes: ['physical_products'],
    allowedCommerceModes: ['catalog_only', 'local_orders', 'local_delivery_and_pickup', 'national_shipping', 'mixed'],
    allowedDeliveryModes: ['none', 'pickup_only', 'local_delivery', 'national_shipping', 'local_and_national'],
    allowPickup: true,
    allowLocalDelivery: true,
    allowNationalShipping: true,
    allowWhatsappOrders: true,
    allowWebsiteOrders: true,
    allowCashOnDelivery: true,
  },
  home: {
    category: 'home',
    label: 'Hogar',
    description: 'Productos físicos con entrega local y envíos nacionales.',
    allowedCatalogTypes: ['physical_products'],
    allowedCommerceModes: ['catalog_only', 'local_orders', 'local_delivery_and_pickup', 'national_shipping', 'mixed'],
    allowedDeliveryModes: ['none', 'pickup_only', 'local_delivery', 'national_shipping', 'local_and_national'],
    allowPickup: true,
    allowLocalDelivery: true,
    allowNationalShipping: true,
    allowWhatsappOrders: true,
    allowWebsiteOrders: true,
    allowCashOnDelivery: true,
  },
  services: {
    // Legacy: kept for DB compatibility with stores created before 034 migration.
    // New stores do NOT use this category.
    category: 'services',
    label: 'Catálogo',
    description: 'Solo catálogo público. Los clientes contactan por WhatsApp.',
    lockedCatalogType: 'services',
    allowedCatalogTypes: ['services'],
    allowedCommerceModes: ['catalog_only'],
    allowedDeliveryModes: ['none'],
    allowPickup: false,
    allowLocalDelivery: false,
    allowNationalShipping: false,
    allowWhatsappOrders: true,
    allowWebsiteOrders: false,
    allowCashOnDelivery: false,
  },
  other: {
    category: 'other',
    label: 'General',
    description: 'Configuración flexible para negocios no clasificados.',
    allowedCatalogTypes: ['physical_products', 'services'],
    allowedCommerceModes: ['catalog_only', 'local_orders', 'local_delivery_and_pickup', 'national_shipping', 'mixed'],
    allowedDeliveryModes: ['none', 'pickup_only', 'local_delivery', 'national_shipping', 'local_and_national'],
    allowPickup: true,
    allowLocalDelivery: true,
    allowNationalShipping: true,
    allowWhatsappOrders: true,
    allowWebsiteOrders: true,
    allowCashOnDelivery: true,
  },
};

// ── Legacy business_type → business_category mapping ─────────
// Only used as fallback in StoreSettingsPage for stores without
// store_commerce_settings. New stores always use business_vertical.

export function mapBusinessTypeToBusinessCategory(businessType: BusinessType | null | undefined): BusinessCategory {
  switch (businessType) {
    case 'restaurante':
      return 'restaurant';
    case 'moda':
      return 'fashion';
    case 'belleza':
      return 'beauty';
    case 'tecnologia':
      return 'technology';
    case 'mascotas':
      return 'pets';
    case 'hogar':
      return 'home';
    // barberia and salud mapped to retail — services vertical is no longer assigned to these
    case 'salud':
    case 'barberia':
      return 'retail';
    default:
      return 'other';
  }
}

export function getCommerceProfile(category: BusinessCategory): CommerceProfile {
  return COMMERCE_PROFILES[category] ?? COMMERCE_PROFILES.other;
}

// ── Business vertical presets ────────────────────────────────

export interface BusinessVerticalPreset {
  businessCategory: BusinessCategory;
  catalogType: CatalogType;
  commerceMode: CommerceMode;
  deliveryMode: DeliveryMode;
  webOrderEnabled: boolean;
  onlineCheckoutEnabled: boolean;
  cashOnDeliveryEnabled: boolean;
  whatsappCheckoutEnabled: boolean;
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  allowsNationalShipping: boolean;
  orderFlowType: OrderFlowType;
  hasInventory: boolean;
  hasVariants: boolean;
  hasLeads: boolean;
}

export const BUSINESS_VERTICAL_PRESETS: Record<BusinessVertical, BusinessVerticalPreset> = {
  food_restaurant: {
    businessCategory: 'restaurant',
    catalogType: 'menu',
    commerceMode: 'local_delivery_and_pickup',
    deliveryMode: 'local_delivery',
    webOrderEnabled: true,
    onlineCheckoutEnabled: false,
    cashOnDeliveryEnabled: true,
    whatsappCheckoutEnabled: true,
    allowsPickup: true,
    allowsLocalDelivery: true,
    allowsNationalShipping: false,
    orderFlowType: 'restaurant',
    hasInventory: false,
    hasVariants: false,
    hasLeads: false,
  },
  retail_products: {
    businessCategory: 'retail',
    catalogType: 'physical_products',
    commerceMode: 'national_shipping',
    deliveryMode: 'national_shipping',
    webOrderEnabled: true,
    onlineCheckoutEnabled: false,
    cashOnDeliveryEnabled: false,
    whatsappCheckoutEnabled: true,
    allowsPickup: true,
    allowsLocalDelivery: true,
    allowsNationalShipping: true,
    orderFlowType: 'ecommerce',
    hasInventory: true,
    hasVariants: false,
    hasLeads: false,
  },
  catalog_quote: {
    businessCategory: 'other',
    catalogType: 'physical_products',
    commerceMode: 'catalog_only',
    deliveryMode: 'none',
    webOrderEnabled: false,
    onlineCheckoutEnabled: false,
    cashOnDeliveryEnabled: false,
    whatsappCheckoutEnabled: true,
    allowsPickup: false,
    allowsLocalDelivery: false,
    allowsNationalShipping: false,
    orderFlowType: 'quote',
    hasInventory: false,
    hasVariants: false,
    hasLeads: true,
  },
  real_estate: {
    businessCategory: 'other',
    catalogType: 'physical_products',
    commerceMode: 'catalog_only',
    deliveryMode: 'none',
    webOrderEnabled: false,
    onlineCheckoutEnabled: false,
    cashOnDeliveryEnabled: false,
    whatsappCheckoutEnabled: true,
    allowsPickup: false,
    allowsLocalDelivery: false,
    allowsNationalShipping: false,
    orderFlowType: 'lead',
    hasInventory: false,
    hasVariants: false,
    hasLeads: true,
  },
};

// ── Order flow type resolution ───────────────────────────────

export function getOrderFlowType(settings: StoreCommerceSettings | null): OrderFlowType {
  if (!settings) return 'ecommerce';
  if (settings.orderFlowType) return settings.orderFlowType;
  // Fallback for stores that pre-date the 034 migration
  return settings.businessCategory === 'restaurant' || settings.catalogType === 'menu'
    ? 'restaurant'
    : 'ecommerce';
}

// ── Default hero CTA by vertical ────────────────────────────

export function getDefaultHeroCta(vertical: BusinessVertical | null | undefined): string {
  switch (vertical) {
    case 'food_restaurant': return 'Ver menú';
    case 'retail_products': return 'Ver productos';
    case 'catalog_quote': return 'Ver catálogo';
    case 'real_estate': return 'Ver propiedades';
    default: return 'Ver productos';
  }
}

// ── Commerce settings normalization ─────────────────────────

export interface NormalizableCommerceSettings {
  businessCategory: BusinessCategory;
  catalogType: CatalogType;
  commerceMode: CommerceMode;
  deliveryMode: DeliveryMode;
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  allowsNationalShipping: boolean;
  whatsappCheckoutEnabled: boolean;
  webOrderEnabled: boolean;
  onlineCheckoutEnabled: boolean;
  cashOnDeliveryEnabled: boolean;
  defaultOrderMethod: OrderMethod;
  localDeliveryNotes?: string | null;
  shippingNotes?: string | null;
  localDeliveryBaseFee?: number | null;
  localDeliveryFreeFrom?: number | null;
  nationalShippingBaseFee?: number | null;
  nationalShippingFreeFrom?: number | null;
}

export function deriveDeliveryModeFromCapabilities(input: {
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  allowsNationalShipping: boolean;
}): DeliveryMode {
  if (input.allowsLocalDelivery && input.allowsNationalShipping) return 'local_and_national';
  if (input.allowsNationalShipping) return 'national_shipping';
  if (input.allowsLocalDelivery) return 'local_delivery';
  if (input.allowsPickup) return 'pickup_only';
  return 'none';
}

export function deriveCommerceModeFromCapabilities(input: {
  sellingEnabled: boolean;
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  allowsNationalShipping: boolean;
}): CommerceMode {
  if (!input.sellingEnabled) return 'catalog_only';
  if (input.allowsNationalShipping && (input.allowsPickup || input.allowsLocalDelivery)) return 'mixed';
  if (input.allowsNationalShipping) return 'national_shipping';
  if (input.allowsPickup && input.allowsLocalDelivery) return 'local_delivery_and_pickup';
  if (input.allowsPickup || input.allowsLocalDelivery) return 'local_orders';
  return 'local_orders';
}

export function normalizeCommerceSettings<T extends NormalizableCommerceSettings>(values: T): T {
  const profile = getCommerceProfile(values.businessCategory);
  const catalogType = profile.lockedCatalogType
    ?? (profile.allowedCatalogTypes.includes(values.catalogType) ? values.catalogType : profile.allowedCatalogTypes[0]);

  const allowsPickup = profile.allowPickup ? values.allowsPickup : false;
  const allowsLocalDelivery = profile.allowLocalDelivery ? values.allowsLocalDelivery : false;
  const allowsNationalShipping = profile.allowNationalShipping ? values.allowsNationalShipping : false;
  let whatsappCheckoutEnabled = profile.allowWhatsappOrders ? values.whatsappCheckoutEnabled : false;
  let webOrderEnabled = profile.allowWebsiteOrders ? values.webOrderEnabled : false;
  const onlineCheckoutEnabled = profile.allowWebsiteOrders && webOrderEnabled
    ? values.onlineCheckoutEnabled
    : false;
  const cashOnDeliveryEnabled = profile.allowCashOnDelivery && webOrderEnabled
    ? values.cashOnDeliveryEnabled
    : false;

  if (!whatsappCheckoutEnabled && !webOrderEnabled && values.commerceMode !== 'catalog_only') {
    if (profile.allowWhatsappOrders) whatsappCheckoutEnabled = true;
    else if (profile.allowWebsiteOrders) webOrderEnabled = true;
  }

  const deliveryMode = deriveDeliveryModeFromCapabilities({
    allowsPickup,
    allowsLocalDelivery,
    allowsNationalShipping,
  });
  const commerceMode = deriveCommerceModeFromCapabilities({
    sellingEnabled: whatsappCheckoutEnabled || webOrderEnabled,
    allowsPickup,
    allowsLocalDelivery,
    allowsNationalShipping,
  });

  let defaultOrderMethod: OrderMethod;
  if (webOrderEnabled && onlineCheckoutEnabled && !cashOnDeliveryEnabled) {
    defaultOrderMethod = 'online_checkout';
  } else if (webOrderEnabled) {
    defaultOrderMethod = 'web_order';
  } else {
    defaultOrderMethod = 'whatsapp';
  }

  return {
    ...values,
    businessCategory: profile.category,
    catalogType,
    commerceMode,
    deliveryMode,
    allowsPickup,
    allowsLocalDelivery,
    allowsNationalShipping,
    whatsappCheckoutEnabled,
    webOrderEnabled,
    onlineCheckoutEnabled,
    cashOnDeliveryEnabled,
    defaultOrderMethod,
    localDeliveryNotes: allowsLocalDelivery ? values.localDeliveryNotes ?? null : '',
    shippingNotes: allowsNationalShipping ? values.shippingNotes ?? null : '',
    localDeliveryBaseFee: allowsLocalDelivery ? Number(values.localDeliveryBaseFee ?? 0) : 0,
    localDeliveryFreeFrom: allowsLocalDelivery ? values.localDeliveryFreeFrom ?? null : null,
    nationalShippingBaseFee: allowsNationalShipping ? Number(values.nationalShippingBaseFee ?? 0) : 0,
    nationalShippingFreeFrom: allowsNationalShipping ? values.nationalShippingFreeFrom ?? null : null,
  };
}

export function buildCommerceUpdatePayload(values: NormalizableCommerceSettings): StoreCommerceSettingsUpdate {
  const normalized = normalizeCommerceSettings(values);
  return {
    businessCategory: normalized.businessCategory,
    catalogType: normalized.catalogType,
    commerceMode: normalized.commerceMode,
    deliveryMode: normalized.deliveryMode,
    allowsPickup: normalized.allowsPickup,
    allowsLocalDelivery: normalized.allowsLocalDelivery,
    allowsNationalShipping: normalized.allowsNationalShipping,
    whatsappCheckoutEnabled: normalized.whatsappCheckoutEnabled,
    webOrderEnabled: normalized.webOrderEnabled,
    onlineCheckoutEnabled: normalized.onlineCheckoutEnabled,
    cashOnDeliveryEnabled: normalized.cashOnDeliveryEnabled,
    defaultOrderMethod: normalized.defaultOrderMethod,
    localDeliveryNotes: normalized.localDeliveryNotes ?? null,
    shippingNotes: normalized.shippingNotes ?? null,
    localDeliveryBaseFee: Number(normalized.localDeliveryBaseFee ?? 0),
    localDeliveryFreeFrom: normalized.localDeliveryFreeFrom ?? null,
    nationalShippingBaseFee: Number(normalized.nationalShippingBaseFee ?? 0),
    nationalShippingFreeFrom: normalized.nationalShippingFreeFrom ?? null,
  };
}
