import * as Yup from 'yup';
import type { BusinessCategory, CatalogType, CommerceMode, DeliveryMode, OrderMethod } from '@/types/common.types';

export interface StoreCommerceFormValues {
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
  localDeliveryNotes: string;
  shippingNotes: string;
}

const BUSINESS_CATEGORIES: BusinessCategory[] = ['restaurant', 'retail', 'fashion', 'beauty', 'technology', 'pets', 'home', 'services', 'other'];
const CATALOG_TYPES: CatalogType[] = ['menu', 'physical_products', 'services', 'mixed'];
const COMMERCE_MODES: CommerceMode[] = [
  'catalog_only', 'local_orders', 'local_delivery_and_pickup', 'national_shipping', 'mixed',
];
const DELIVERY_MODES: DeliveryMode[] = [
  'none', 'pickup_only', 'local_delivery', 'national_shipping', 'local_and_national',
];
const ORDER_METHODS: OrderMethod[] = ['whatsapp', 'web_order', 'online_checkout'];

export const storeCommerceSchema = Yup.object({
  businessCategory: Yup.mixed<BusinessCategory>().oneOf(BUSINESS_CATEGORIES).required('Requerido'),
  catalogType: Yup.mixed<CatalogType>().oneOf(CATALOG_TYPES).required('Requerido'),
  commerceMode: Yup.mixed<CommerceMode>().oneOf(COMMERCE_MODES).required('Requerido'),
  deliveryMode: Yup.mixed<DeliveryMode>().oneOf(DELIVERY_MODES).required('Requerido'),
  allowsPickup: Yup.boolean().required(),
  allowsLocalDelivery: Yup.boolean().required(),
  allowsNationalShipping: Yup.boolean().required(),
  whatsappCheckoutEnabled: Yup.boolean().required(),
  webOrderEnabled: Yup.boolean().required(),
  onlineCheckoutEnabled: Yup.boolean().required(),
  cashOnDeliveryEnabled: Yup.boolean().required(),
  defaultOrderMethod: Yup.mixed<OrderMethod>().oneOf(ORDER_METHODS).required('Requerido'),
  localDeliveryNotes: Yup.string(),
  shippingNotes: Yup.string(),
});
