import type { OrderRow, OrderRowInsert, OrderRowUpdate, OrderItemRow, OrderItemRowInsert } from '@/types/database.types';

type OrderRowWithItems = OrderRow & { order_items?: OrderItemRow[] };
import type { OrderStatus, PaymentStatus, FulfillmentMethod, OrderSource, OrderPaymentMethod } from '@/types/common.types';
import type { Order, OrderItem, OrderInsert, OrderUpdate, OrderItemInsert } from './orders.types';

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
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: (row.payment_method as OrderPaymentMethod) ?? 'cash_on_delivery',
    fulfillmentMethod: (row.fulfillment_method as FulfillmentMethod) ?? 'delivery',
    notes: row.notes,
    items: row.order_items ? row.order_items.map(mapOrderItemRowToOrderItem) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOrderItemRowToOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    offerId: row.offer_id,
    productNameSnapshot: row.product_name_snapshot ?? null,
    productSlugSnapshot: row.product_slug_snapshot ?? null,
    productImageUrlSnapshot: row.product_image_url_snapshot ?? null,
    name: row.name,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
    customerNote: row.customer_note,
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
    total_amount: data.totalAmount,
    currency: data.currency,
    status: data.status,
    payment_status: data.paymentStatus,
    payment_method: data.paymentMethod,
    fulfillment_method: data.fulfillmentMethod,
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
  if (data.totalAmount !== undefined) row.total_amount = data.totalAmount;
  if (data.currency !== undefined) row.currency = data.currency;
  if (data.status !== undefined) row.status = data.status;
  if (data.paymentStatus !== undefined) row.payment_status = data.paymentStatus;
  if (data.paymentMethod !== undefined) row.payment_method = data.paymentMethod;
  if (data.fulfillmentMethod !== undefined) row.fulfillment_method = data.fulfillmentMethod;
  if (data.notes !== undefined) row.notes = data.notes ?? null;
  return row;
}

export function mapOrderItemInsertToRow(data: OrderItemInsert): OrderItemRowInsert {
  return {
    order_id: data.orderId,
    product_id: data.productId ?? null,
    offer_id: data.offerId ?? null,
    product_name_snapshot: data.productNameSnapshot ?? null,
    product_slug_snapshot: data.productSlugSnapshot ?? null,
    name: data.name,
    quantity: data.quantity,
    unit_price: data.unitPrice,
    total_price: data.totalPrice,
    customer_note: data.customerNote ?? null,
  };
}
