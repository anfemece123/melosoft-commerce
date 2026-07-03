import type {
  BusinessCategory,
  CatalogType,
  CommerceMode,
  DeliveryMode,
  OrderFlowType,
  OrderMethod,
} from '@/types/common.types';

export interface StoreCommerceSettings {
  id: string;
  storeId: string;
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
  localDeliveryNotes: string | null;
  shippingNotes: string | null;
  orderFlowType: OrderFlowType;
  hasInventory: boolean;
  hasVariants: boolean;
  hasLeads: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StoreCommerceSettingsUpdate = Partial<
  Omit<StoreCommerceSettings, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>
>;
