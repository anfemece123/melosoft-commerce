export interface CommerceDefaults {
  business_category: string;
  catalog_type: string;
  commerce_mode: string;
  delivery_mode: string;
  allows_pickup: boolean;
  allows_local_delivery: boolean;
  allows_national_shipping: boolean;
  whatsapp_checkout_enabled: boolean;
  web_order_enabled: boolean;
  online_checkout_enabled: boolean;
  cash_on_delivery_enabled: boolean;
  default_order_method: string;
  order_flow_type: string;
  has_inventory: boolean;
  has_variants: boolean;
  has_leads: boolean;
}

export function getStoreCreationCommerceDefaults(businessVertical: string): CommerceDefaults {
  switch (businessVertical) {
    case 'food_restaurant':
      return {
        business_category: 'restaurant',
        catalog_type: 'menu',
        commerce_mode: 'local_delivery_and_pickup',
        delivery_mode: 'local_delivery',
        allows_pickup: true,
        allows_local_delivery: true,
        allows_national_shipping: false,
        whatsapp_checkout_enabled: true,
        web_order_enabled: true,
        online_checkout_enabled: false,
        cash_on_delivery_enabled: true,
        default_order_method: 'whatsapp',
        order_flow_type: 'restaurant',
        has_inventory: false,
        has_variants: false,
        has_leads: false,
      };
    case 'catalog_quote':
      return {
        business_category: 'other',
        catalog_type: 'physical_products',
        commerce_mode: 'catalog_only',
        delivery_mode: 'none',
        allows_pickup: false,
        allows_local_delivery: false,
        allows_national_shipping: false,
        whatsapp_checkout_enabled: true,
        web_order_enabled: false,
        online_checkout_enabled: false,
        cash_on_delivery_enabled: false,
        default_order_method: 'whatsapp',
        order_flow_type: 'quote',
        has_inventory: false,
        has_variants: false,
        has_leads: true,
      };
    case 'real_estate':
      return {
        business_category: 'other',
        catalog_type: 'physical_products',
        commerce_mode: 'catalog_only',
        delivery_mode: 'none',
        allows_pickup: false,
        allows_local_delivery: false,
        allows_national_shipping: false,
        whatsapp_checkout_enabled: true,
        web_order_enabled: false,
        online_checkout_enabled: false,
        cash_on_delivery_enabled: false,
        default_order_method: 'whatsapp',
        order_flow_type: 'lead',
        has_inventory: false,
        has_variants: false,
        has_leads: true,
      };
    default:
      return {
        business_category: 'retail',
        catalog_type: 'physical_products',
        commerce_mode: 'national_shipping',
        delivery_mode: 'national_shipping',
        allows_pickup: true,
        allows_local_delivery: true,
        allows_national_shipping: true,
        whatsapp_checkout_enabled: true,
        web_order_enabled: true,
        online_checkout_enabled: false,
        cash_on_delivery_enabled: false,
        default_order_method: 'whatsapp',
        order_flow_type: 'ecommerce',
        has_inventory: true,
        has_variants: false,
        has_leads: false,
      };
  }
}
