import type { StoreCommerceSettingsRow, StoreCommerceSettingsRowUpdate } from '@/types/database.types';
import type {
  BusinessCategory,
  CatalogType,
  CommerceMode,
  DeliveryMode,
  OrderMethod,
} from '@/types/common.types';
import type { StoreCommerceSettings, StoreCommerceSettingsUpdate } from './storeCommerce.types';

export function mapStoreCommerceSettingsRowToStoreCommerceSettings(
  row: StoreCommerceSettingsRow
): StoreCommerceSettings {
  return {
    id: row.id,
    storeId: row.store_id,
    businessCategory: row.business_category as BusinessCategory,
    catalogType: row.catalog_type as CatalogType,
    commerceMode: row.commerce_mode as CommerceMode,
    deliveryMode: row.delivery_mode as DeliveryMode,
    allowsPickup: row.allows_pickup,
    allowsLocalDelivery: row.allows_local_delivery,
    allowsNationalShipping: row.allows_national_shipping,
    whatsappCheckoutEnabled: row.whatsapp_checkout_enabled,
    webOrderEnabled: row.web_order_enabled,
    onlineCheckoutEnabled: row.online_checkout_enabled,
    cashOnDeliveryEnabled: row.cash_on_delivery_enabled,
    defaultOrderMethod: row.default_order_method as OrderMethod,
    localDeliveryNotes: row.local_delivery_notes,
    shippingNotes: row.shipping_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStoreCommerceSettingsUpdateToRow(
  data: StoreCommerceSettingsUpdate
): StoreCommerceSettingsRowUpdate {
  const row: StoreCommerceSettingsRowUpdate = {};
  if (data.businessCategory !== undefined) row.business_category = data.businessCategory;
  if (data.catalogType !== undefined) row.catalog_type = data.catalogType;
  if (data.commerceMode !== undefined) row.commerce_mode = data.commerceMode;
  if (data.deliveryMode !== undefined) row.delivery_mode = data.deliveryMode;
  if (data.allowsPickup !== undefined) row.allows_pickup = data.allowsPickup;
  if (data.allowsLocalDelivery !== undefined) row.allows_local_delivery = data.allowsLocalDelivery;
  if (data.allowsNationalShipping !== undefined) row.allows_national_shipping = data.allowsNationalShipping;
  if (data.whatsappCheckoutEnabled !== undefined) row.whatsapp_checkout_enabled = data.whatsappCheckoutEnabled;
  if (data.webOrderEnabled !== undefined) row.web_order_enabled = data.webOrderEnabled;
  if (data.onlineCheckoutEnabled !== undefined) row.online_checkout_enabled = data.onlineCheckoutEnabled;
  if (data.cashOnDeliveryEnabled !== undefined) row.cash_on_delivery_enabled = data.cashOnDeliveryEnabled;
  if (data.defaultOrderMethod !== undefined) row.default_order_method = data.defaultOrderMethod;
  if (data.localDeliveryNotes !== undefined) row.local_delivery_notes = data.localDeliveryNotes;
  if (data.shippingNotes !== undefined) row.shipping_notes = data.shippingNotes;
  return row;
}
