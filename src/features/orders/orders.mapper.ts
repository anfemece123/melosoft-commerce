import type {
  OrderRow, OrderRowInsert, OrderRowUpdate, OrderItemRow, OrderItemRowInsert,
  OrderItemCustomizationRow,
} from '@/types/database.types';

type OrderItemRowWithCustomizations = OrderItemRow & { order_item_customizations?: OrderItemCustomizationRow[] };
type OrderRowWithItems = OrderRow & { order_items?: OrderItemRowWithCustomizations[] };
import type { OrderStatus, PaymentStatus, FulfillmentMethod, OrderSource, OrderPaymentMethod } from '@/types/common.types';
import type { Order, OrderItem, OrderItemCustomization, OrderInsert, OrderUpdate, OrderItemInsert } from './orders.types';

// ── Row → App model ─────────────────────────────────────────

export function mapOrderRowToOrder(row: OrderRowWithItems): Order {
  return {
    id: row.id,
    storeId: row.store_id,
    storeLocationId: row.store_location_id ?? null,
    orderNumber: row.order_number ?? null,
    source: (row.source as OrderSource) ?? 'web',
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerDocument: row.customer_document,
    shippingAddress: row.shipping_address,
    city: row.city,
    department: row.department,
    deliveryNeighborhood: row.delivery_neighborhood ?? null,
    deliveryReference: row.delivery_reference ?? null,
    subtotal: Number(row.subtotal),
    shippingAmount: Number(row.shipping_amount),
    discountAmount: Number(row.discount_amount),
    partnerCode: row.partner_code ?? null,
    partnerName: row.partner_name ?? null,
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: (row.payment_method as OrderPaymentMethod) ?? 'cash_on_delivery',
    fulfillmentMethod: (row.fulfillment_method as FulfillmentMethod) ?? 'local_delivery',
    shippingCarrier: row.shipping_carrier ?? null,
    trackingNumber: row.tracking_number ?? null,
    trackingUrl: row.tracking_url ?? null,
    estimatedDeliveryAt: row.estimated_delivery_at ?? null,
    shippedAt: row.shipped_at ?? null,
    deliveredAt: row.delivered_at ?? null,
    notes: row.notes,
    items: row.order_items ? row.order_items.map(mapOrderItemRowToOrderItem) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOrderItemCustomizationRowToOrderItemCustomization(
  row: OrderItemCustomizationRow
): OrderItemCustomization {
  return {
    id: row.id,
    orderItemId: row.order_item_id,
    optionGroupId: row.option_group_id ?? null,
    optionItemId: row.option_item_id ?? null,
    optionGroupName: row.option_group_name,
    optionItemLabel: row.option_item_label,
    priceDelta: Number(row.price_delta),
    createdAt: row.created_at,
  };
}

export function mapOrderItemRowToOrderItem(row: OrderItemRowWithCustomizations): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    variantId: row.variant_id ?? null,
    offerId: row.offer_id,
    productNameSnapshot: row.product_name_snapshot ?? null,
    productSlugSnapshot: row.product_slug_snapshot ?? null,
    productImageUrlSnapshot: row.product_image_url_snapshot ?? null,
    variantLabelSnapshot: row.variant_label_snapshot ?? null,
    variantSkuSnapshot: row.variant_sku_snapshot ?? null,
    name: row.name,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
    customerNote: row.customer_note,
    customizations: (row.order_item_customizations ?? []).map(mapOrderItemCustomizationRowToOrderItemCustomization),
    createdAt: row.created_at,
  };
}

// ── App model → Insert row ───────────────────────────────────

export function mapOrderInsertToRow(data: OrderInsert): OrderRowInsert {
  return {
    store_id: data.storeId,
    order_number: data.orderNumber ?? null,
    source: data.source,
    customer_name: data.customerName,
    customer_email: data.customerEmail ?? null,
    customer_phone: data.customerPhone,
    customer_document: data.customerDocument ?? null,
    shipping_address: data.shippingAddress ?? null,
    city: data.city ?? null,
    department: data.department ?? null,
    delivery_neighborhood: data.deliveryNeighborhood ?? null,
    delivery_reference: data.deliveryReference ?? null,
    subtotal: data.subtotal,
    shipping_amount: data.shippingAmount,
    discount_amount: data.discountAmount,
    partner_code: data.partnerCode ?? null,
    partner_name: data.partnerName ?? null,
    total_amount: data.totalAmount,
    currency: data.currency,
    status: data.status,
    payment_status: data.paymentStatus,
    payment_method: data.paymentMethod,
    fulfillment_method: data.fulfillmentMethod,
    shipping_carrier: data.shippingCarrier ?? null,
    tracking_number: data.trackingNumber ?? null,
    tracking_url: data.trackingUrl ?? null,
    estimated_delivery_at: data.estimatedDeliveryAt ?? null,
    shipped_at: data.shippedAt ?? null,
    delivered_at: data.deliveredAt ?? null,
    notes: data.notes ?? null,
  };
}

export function mapOrderUpdateToRow(data: OrderUpdate): OrderRowUpdate {
  const row: OrderRowUpdate = {};
  if (data.customerName !== undefined) row.customer_name = data.customerName;
  if (data.customerEmail !== undefined) row.customer_email = data.customerEmail ?? null;
  if (data.customerPhone !== undefined) row.customer_phone = data.customerPhone;
  if (data.customerDocument !== undefined) row.customer_document = data.customerDocument ?? null;
  if (data.shippingAddress !== undefined) row.shipping_address = data.shippingAddress ?? null;
  if (data.city !== undefined) row.city = data.city ?? null;
  if (data.department !== undefined) row.department = data.department ?? null;
  if (data.deliveryNeighborhood !== undefined) row.delivery_neighborhood = data.deliveryNeighborhood ?? null;
  if (data.deliveryReference !== undefined) row.delivery_reference = data.deliveryReference ?? null;
  if (data.subtotal !== undefined) row.subtotal = data.subtotal;
  if (data.shippingAmount !== undefined) row.shipping_amount = data.shippingAmount;
  if (data.discountAmount !== undefined) row.discount_amount = data.discountAmount;
  if (data.partnerCode !== undefined) row.partner_code = data.partnerCode ?? null;
  if (data.partnerName !== undefined) row.partner_name = data.partnerName ?? null;
  if (data.totalAmount !== undefined) row.total_amount = data.totalAmount;
  if (data.currency !== undefined) row.currency = data.currency;
  if (data.status !== undefined) row.status = data.status;
  if (data.paymentStatus !== undefined) row.payment_status = data.paymentStatus;
  if (data.paymentMethod !== undefined) row.payment_method = data.paymentMethod;
  if (data.fulfillmentMethod !== undefined) row.fulfillment_method = data.fulfillmentMethod;
  if (data.shippingCarrier !== undefined) row.shipping_carrier = data.shippingCarrier ?? null;
  if (data.trackingNumber !== undefined) row.tracking_number = data.trackingNumber ?? null;
  if (data.trackingUrl !== undefined) row.tracking_url = data.trackingUrl ?? null;
  if (data.estimatedDeliveryAt !== undefined) row.estimated_delivery_at = data.estimatedDeliveryAt ?? null;
  if (data.shippedAt !== undefined) row.shipped_at = data.shippedAt ?? null;
  if (data.deliveredAt !== undefined) row.delivered_at = data.deliveredAt ?? null;
  if (data.notes !== undefined) row.notes = data.notes ?? null;
  return row;
}

export function mapOrderItemInsertToRow(data: OrderItemInsert): OrderItemRowInsert {
  return {
    order_id: data.orderId,
    product_id: data.productId ?? null,
    variant_id: data.variantId ?? null,
    offer_id: data.offerId ?? null,
    product_name_snapshot: data.productNameSnapshot ?? null,
    product_slug_snapshot: data.productSlugSnapshot ?? null,
    variant_label_snapshot: data.variantLabelSnapshot ?? null,
    variant_sku_snapshot: data.variantSkuSnapshot ?? null,
    name: data.name,
    quantity: data.quantity,
    unit_price: data.unitPrice,
    total_price: data.totalPrice,
    customer_note: data.customerNote ?? null,
  };
}
