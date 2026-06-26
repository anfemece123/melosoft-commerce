import type {
  BusinessCategory,
  BusinessType,
  CatalogType,
  CommerceMode,
  DeliveryMode,
  OrderMethod,
} from '@/types/common.types';
import type { StoreCommerceSettingsUpdate } from './storeCommerce.types';

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
  services: {
    category: 'services',
    label: 'Servicios',
    description: 'Venta por contacto directo. La contratación se concreta por WhatsApp, sin checkout ni envíos.',
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
  retail: {
    category: 'retail',
    label: 'Productos físicos',
    description: 'Catálogo de productos con operación local y/o nacional.',
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
    description: 'Puede vender productos físicos o agendar servicios por WhatsApp.',
    allowedCatalogTypes: ['physical_products', 'services'],
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

export function mapBusinessTypeToBusinessCategory(businessType: BusinessType | null | undefined): BusinessCategory {
  switch (businessType) {
    case 'restaurante':
      return 'restaurant';
    case 'moda':
      return 'fashion';
    case 'belleza':
    case 'barberia':
      return 'beauty';
    case 'tecnologia':
      return 'technology';
    case 'mascotas':
      return 'pets';
    case 'hogar':
      return 'home';
    case 'salud':
      return 'services';
    default:
      return 'other';
  }
}

export function getCommerceProfile(category: BusinessCategory): CommerceProfile {
  return COMMERCE_PROFILES[category] ?? COMMERCE_PROFILES.other;
}

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
}

export function normalizeCommerceSettings<T extends NormalizableCommerceSettings>(values: T): T {
  const profile = getCommerceProfile(values.businessCategory);
  const catalogType = profile.lockedCatalogType
    ?? (profile.allowedCatalogTypes.includes(values.catalogType) ? values.catalogType : profile.allowedCatalogTypes[0]);
  const commerceMode = profile.allowedCommerceModes.includes(values.commerceMode)
    ? values.commerceMode
    : profile.allowedCommerceModes[0];
  const deliveryMode = profile.allowedDeliveryModes.includes(values.deliveryMode)
    ? values.deliveryMode
    : profile.allowedDeliveryModes[0];

  const allowsPickup = profile.allowPickup ? values.allowsPickup : false;
  const allowsLocalDelivery = profile.allowLocalDelivery ? values.allowsLocalDelivery : false;
  const allowsNationalShipping = profile.allowNationalShipping ? values.allowsNationalShipping : false;
  let whatsappCheckoutEnabled = profile.allowWhatsappOrders ? values.whatsappCheckoutEnabled : false;
  let webOrderEnabled = profile.allowWebsiteOrders ? values.webOrderEnabled : false;
  // online_checkout_enabled is reserved for Wompi (Fase 7) — always false here
  const onlineCheckoutEnabled = false;
  const cashOnDeliveryEnabled = profile.allowCashOnDelivery && webOrderEnabled
    ? values.cashOnDeliveryEnabled
    : false;

  // Allow both to be false only in explicit catalog_only mode
  if (!whatsappCheckoutEnabled && !webOrderEnabled && commerceMode !== 'catalog_only') {
    if (profile.allowWhatsappOrders) whatsappCheckoutEnabled = true;
    else if (profile.allowWebsiteOrders) webOrderEnabled = true;
  }

  let defaultOrderMethod: OrderMethod;
  if (webOrderEnabled) {
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
  };
}
