import type {
  AsyncStatus,
  OrderStatus,
  PaymentStatus,
  FulfillmentMethod,
  OrderSource,
  OrderPaymentMethod,
} from '@/types/common.types';

// Snapshot of a priced modifier/adición on a placed order — text columns
// are the source of truth for display (product_option_groups/items rows
// get replaced wholesale on every catalog edit, so an id can go stale
// the moment an owner edits their menu). ids are traceability-only.
export interface OrderItemCustomization {
  id: string;
  orderItemId: string;
  optionGroupId: string | null;
  optionItemId: string | null;
  optionGroupName: string;
  optionItemLabel: string;
  priceDelta: number;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  offerId: string | null;
  productNameSnapshot: string | null;
  productSlugSnapshot: string | null;
  productImageUrlSnapshot: string | null;
  variantLabelSnapshot: string | null;
  variantSkuSnapshot: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customerNote: string | null;
  customizations: OrderItemCustomization[];
  createdAt: string;
}

export interface Order {
  id: string;
  storeId: string;
  storeLocationId: string | null;
  orderNumber: string | null;
  source: OrderSource;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  customerDocument: string | null;
  shippingAddress: string | null;
  city: string | null;
  department: string | null;
  deliveryNeighborhood: string | null;
  deliveryReference: string | null;
  subtotal: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: OrderPaymentMethod;
  fulfillmentMethod: FulfillmentMethod;
  notes: string | null;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type OrderInsert = Omit<Order, 'id' | 'items' | 'createdAt' | 'updatedAt'>;
export type OrderUpdate = Partial<Omit<OrderInsert, 'storeId'>>;

export type OrderItemInsert = Omit<OrderItem, 'id' | 'createdAt'>;

export interface OrdersState {
  items: Order[];
  current: Order | null;
  status: AsyncStatus;
  error: string | null;
}

// Web checkout flow types

// Only ids are sent for pricing purposes — the server re-resolves and
// re-prices every modifier from product_option_groups/items, it never
// trusts a client-sent label or price_delta.
export interface WebOrderCartItemCustomization {
  optionGroupId: string;
  optionItemId: string;
}

export interface WebOrderCartItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  customizationNotes: string | null;
  customizations: WebOrderCartItemCustomization[];
}

export interface CreateWebOrderPayload {
  storeSlug: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  fulfillmentMethod: FulfillmentMethod;
  shippingAddress: string | null;
  city: string | null;
  department: string | null;
  deliveryNeighborhood: string | null;
  deliveryReference: string | null;
  notes: string | null;
  storeLocationId?: string | null;
  paymentMethod?: 'cash_on_delivery' | 'online';
  items: WebOrderCartItem[];
}

export interface WebOrderResult {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: 'cash_on_delivery' | 'online';
  status: string;
}
