export type OrderEmailEvent =
  | 'merchant_new_order'
  | 'customer_order_received'
  | 'customer_order_confirmed'
  | 'customer_order_ready_for_pickup'
  | 'customer_order_shipped'
  | 'customer_order_delivered'
  | 'customer_order_cancelled';

export interface OrderEmailItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantLabel: string | null;
}

export interface OrderEmailData {
  eventType: OrderEmailEvent;
  storeName: string;
  storeLogoUrl: string | null;
  supportEmail: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  orderNumber: string;
  createdAt: string;
  currency: string;
  subtotal: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  fulfillmentMethod: string;
  shippingAddress: string | null;
  city: string | null;
  department: string | null;
  deliveryNeighborhood: string | null;
  deliveryReference: string | null;
  notes: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  reviewUrl?: string | null;
  items: OrderEmailItem[];
}

export interface RenderedOrderEmail {
  subject: string;
  previewText: string;
  html: string;
  text: string;
}

interface EventCopy {
  eyebrow: string;
  title: string;
  message: string;
  accent: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || 'COP'} ${Math.round(amount).toLocaleString('es-CO')}`;
  }
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatEstimatedDate(value: string | null): string | null {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
  } catch {
    return value;
  }
}

function paymentLabel(method: string, status: string): string {
  if (status === 'paid') return 'Pagado';
  if (method === 'online') return 'Pago en línea pendiente';
  return 'Pago contraentrega';
}

function fulfillmentLabel(method: string): string {
  if (method === 'pickup') return 'Recogida en tienda';
  if (method === 'national_shipping') return 'Envío nacional';
  return 'Domicilio local';
}

function destinationLabel(data: OrderEmailData): string {
  if (data.fulfillmentMethod === 'pickup') return 'Recogida en la sede seleccionada';
  return [
    data.shippingAddress,
    data.deliveryNeighborhood,
    data.city,
    data.department,
  ].filter(Boolean).join(', ') || 'Dirección registrada en el pedido';
}

function getEventCopy(data: OrderEmailData): EventCopy {
  const store = data.storeName;
  switch (data.eventType) {
    case 'merchant_new_order':
      return {
        eyebrow: 'NUEVO PEDIDO',
        title: `Recibiste el pedido #${data.orderNumber}`,
        message: `${data.customerName} acaba de realizar un pedido en ${store}. Revisa los productos, el pago y los datos de entrega antes de confirmarlo.`,
        accent: '#4f46e5',
      };
    case 'customer_order_received':
      return {
        eyebrow: 'PEDIDO RECIBIDO',
        title: `Recibimos tu pedido, ${data.customerName}`,
        message: `${store} ya recibió el pedido #${data.orderNumber}. Te avisaremos cuando sea confirmado y en cada hito importante de la entrega.`,
        accent: '#4f46e5',
      };
    case 'customer_order_confirmed':
      return {
        eyebrow: 'PEDIDO CONFIRMADO',
        title: 'Tu pedido fue confirmado',
        message: `${store} confirmó el pedido #${data.orderNumber} y comenzará a gestionarlo.`,
        accent: '#2563eb',
      };
    case 'customer_order_ready_for_pickup':
      return {
        eyebrow: 'LISTO PARA RECOGER',
        title: 'Tu pedido ya está listo',
        message: `Puedes recoger el pedido #${data.orderNumber}. Ten este número a la mano cuando llegues.`,
        accent: '#059669',
      };
    case 'customer_order_shipped':
      return {
        eyebrow: data.fulfillmentMethod === 'national_shipping' ? 'PEDIDO DESPACHADO' : 'PEDIDO EN CAMINO',
        title: data.fulfillmentMethod === 'national_shipping' ? 'Tu pedido fue despachado' : 'Tu pedido va en camino',
        message: data.trackingNumber
          ? `El pedido #${data.orderNumber} ya está en manos de ${data.shippingCarrier || 'la transportadora'}. Usa la guía para consultar su recorrido.`
          : `El pedido #${data.orderNumber} salió hacia la dirección registrada.`,
        accent: '#0891b2',
      };
    case 'customer_order_delivered':
      return {
        eyebrow: data.fulfillmentMethod === 'pickup' ? 'PEDIDO RECOGIDO' : 'PEDIDO ENTREGADO',
        title: data.fulfillmentMethod === 'pickup' ? 'Tu pedido fue recogido' : 'Tu pedido fue entregado',
        message: `El pedido #${data.orderNumber} quedó completado. Gracias por comprar en ${store}.`,
        accent: '#16a34a',
      };
    case 'customer_order_cancelled':
      return {
        eyebrow: 'PEDIDO CANCELADO',
        title: 'Tu pedido fue cancelado',
        message: `El pedido #${data.orderNumber} fue cancelado. Si tienes preguntas, responde a este correo para contactar a ${store}.`,
        accent: '#dc2626',
      };
  }
}

function renderItemsHtml(data: OrderEmailData): string {
  if (data.items.length === 0) {
    return '<p style="margin:0;color:#64748b;font-size:14px">El detalle de productos estará disponible en la administración del pedido.</p>';
  }

  return data.items.map((item) => {
    const variant = item.variantLabel
      ? `<div style="margin-top:3px;color:#64748b;font-size:12px">${escapeHtml(item.variantLabel)}</div>`
      : '';
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top">
        <div style="font-size:14px;font-weight:600;color:#0f172a">${item.quantity}&nbsp;×&nbsp;${escapeHtml(item.name)}</div>
        ${variant}
        <div style="margin-top:3px;color:#94a3b8;font-size:12px">${escapeHtml(formatMoney(item.unitPrice, data.currency))} c/u</div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:top;font-size:14px;font-weight:600;color:#0f172a">${escapeHtml(formatMoney(item.totalPrice, data.currency))}</td>
    </tr>`;
  }).join('');
}

function renderTotalsHtml(data: OrderEmailData): string {
  const discount = data.discountAmount > 0
    ? `<tr><td style="padding:4px 0;color:#64748b;font-size:13px">Descuento</td><td style="padding:4px 0;text-align:right;color:#16a34a;font-size:13px">−${escapeHtml(formatMoney(data.discountAmount, data.currency))}</td></tr>`
    : '';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td style="padding:4px 0;color:#64748b;font-size:13px">Subtotal</td><td style="padding:4px 0;text-align:right;color:#334155;font-size:13px">${escapeHtml(formatMoney(data.subtotal, data.currency))}</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;font-size:13px">Envío</td><td style="padding:4px 0;text-align:right;color:#334155;font-size:13px">${escapeHtml(formatMoney(data.shippingAmount, data.currency))}</td></tr>
    ${discount}
    <tr><td style="padding:10px 0 0;color:#0f172a;font-size:16px;font-weight:700">Total</td><td style="padding:10px 0 0;text-align:right;color:#0f172a;font-size:18px;font-weight:800">${escapeHtml(formatMoney(data.totalAmount, data.currency))}</td></tr>
  </table>`;
}

function renderTrackingHtml(data: OrderEmailData): string {
  if (!data.trackingNumber && !data.shippingCarrier && !data.estimatedDeliveryAt) return '';
  const trackingUrl = safeHttpUrl(data.trackingUrl);
  const estimated = formatEstimatedDate(data.estimatedDeliveryAt);
  const button = trackingUrl
    ? `<a href="${escapeHtml(trackingUrl)}" style="display:inline-block;margin-top:14px;padding:11px 18px;border-radius:9px;background:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700">Rastrear envío</a>`
    : '';
  return `<div style="margin:20px 0 0;padding:18px;border-radius:12px;background:#f0f9ff;border:1px solid #bae6fd">
    <div style="margin-bottom:10px;color:#0369a1;font-size:12px;font-weight:800;letter-spacing:.08em">INFORMACIÓN DE ENVÍO</div>
    ${data.shippingCarrier ? `<div style="margin:4px 0;color:#334155;font-size:14px"><strong>Transportadora:</strong> ${escapeHtml(data.shippingCarrier)}</div>` : ''}
    ${data.trackingNumber ? `<div style="margin:4px 0;color:#334155;font-size:14px"><strong>Número de guía:</strong> <span style="font-family:monospace">${escapeHtml(data.trackingNumber)}</span></div>` : ''}
    ${estimated ? `<div style="margin:4px 0;color:#334155;font-size:14px"><strong>Entrega estimada:</strong> ${escapeHtml(estimated)}</div>` : ''}
    ${button}
  </div>`;
}

function renderReviewInvitationHtml(data: OrderEmailData): string {
  if (data.eventType !== 'customer_order_delivered') return '';
  const reviewUrl = safeHttpUrl(data.reviewUrl ?? null);
  if (!reviewUrl) return '';
  return `<div style="margin:20px 0 0;padding:18px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;text-align:center">
    <div style="color:#3730a3;font-size:12px;font-weight:800;letter-spacing:.08em">¿CÓMO FUE TU COMPRA?</div>
    <p style="margin:8px 0 0;color:#475569;font-size:13px;line-height:1.55">Califica únicamente los productos de este pedido. No necesitas crear una cuenta.</p>
    <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;margin-top:14px;padding:11px 18px;border-radius:9px;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700">Compartir mi opinión</a>
  </div>`;
}

function renderText(data: OrderEmailData, copy: EventCopy): string {
  const itemLines = data.items.length > 0
    ? data.items.map((item) => `- ${item.quantity} x ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''}: ${formatMoney(item.totalPrice, data.currency)}`).join('\n')
    : '- Consulta el detalle del pedido con la tienda.';
  const trackingLines = [
    data.shippingCarrier ? `Transportadora: ${data.shippingCarrier}` : null,
    data.trackingNumber ? `Número de guía: ${data.trackingNumber}` : null,
    data.trackingUrl ? `Rastrear: ${data.trackingUrl}` : null,
    formatEstimatedDate(data.estimatedDeliveryAt) ? `Entrega estimada: ${formatEstimatedDate(data.estimatedDeliveryAt)}` : null,
  ].filter(Boolean).join('\n');

  return `${copy.title}\n\n${copy.message}\n\nPedido #${data.orderNumber}\nFecha: ${formatDate(data.createdAt)}\nCliente: ${data.customerName}\nTeléfono: ${data.customerPhone}\nEntrega: ${fulfillmentLabel(data.fulfillmentMethod)}\nDestino: ${destinationLabel(data)}\nPago: ${paymentLabel(data.paymentMethod, data.paymentStatus)}\n\nProductos\n${itemLines}\n\nSubtotal: ${formatMoney(data.subtotal, data.currency)}\nEnvío: ${formatMoney(data.shippingAmount, data.currency)}${data.discountAmount > 0 ? `\nDescuento: -${formatMoney(data.discountAmount, data.currency)}` : ''}\nTotal: ${formatMoney(data.totalAmount, data.currency)}${trackingLines ? `\n\n${trackingLines}` : ''}${data.reviewUrl && data.eventType === 'customer_order_delivered' ? `\n\nComparte tu opinión: ${data.reviewUrl}` : ''}${data.notes ? `\n\nNotas: ${data.notes}` : ''}\n\n${data.supportEmail ? `¿Necesitas ayuda? Responde a este correo o escribe a ${data.supportEmail}.` : `¿Necesitas ayuda? Responde a este correo para contactar a ${data.storeName}.`}`;
}

export function renderOrderEmail(data: OrderEmailData): RenderedOrderEmail {
  const copy = getEventCopy(data);
  const logoUrl = safeHttpUrl(data.storeLogoUrl);
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(data.storeName)}" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:10px;object-fit:contain;border:1px solid #e2e8f0" />`
    : `<div style="width:44px;height:44px;border-radius:10px;background:#eef2ff;color:#4338ca;font-size:20px;font-weight:800;line-height:44px;text-align:center">${escapeHtml(data.storeName.slice(0, 1).toUpperCase())}</div>`;

  const notes = data.notes
    ? `<div style="margin-top:18px;padding:14px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:13px"><strong>Notas del pedido:</strong> ${escapeHtml(data.notes)}</div>`
    : '';
  const reference = data.deliveryReference
    ? `<div style="margin-top:4px;color:#64748b;font-size:12px">Referencia: ${escapeHtml(data.deliveryReference)}</div>`
    : '';
  const support = data.supportEmail
    ? `¿Necesitas ayuda? Responde este correo o escribe a <a href="mailto:${escapeHtml(data.supportEmail)}" style="color:#4f46e5;text-decoration:none">${escapeHtml(data.supportEmail)}</a>.`
    : `¿Necesitas ayuda? Responde a este correo para contactar a ${escapeHtml(data.storeName)}.`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(copy.message)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc"><tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <tr><td style="height:5px;background:${copy.accent}"></td></tr>
      <tr><td style="padding:24px 28px 18px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          <td width="56">${logo}</td>
          <td style="font-size:16px;font-weight:800;color:#0f172a">${escapeHtml(data.storeName)}</td>
          <td align="right" style="font-family:monospace;font-size:12px;color:#64748b">#${escapeHtml(data.orderNumber)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:10px 28px 24px">
        <div style="margin-bottom:8px;color:${copy.accent};font-size:11px;font-weight:800;letter-spacing:.12em">${copy.eyebrow}</div>
        <h1 style="margin:0 0 10px;font-size:25px;line-height:1.25;color:#0f172a">${escapeHtml(copy.title)}</h1>
        <p style="margin:0;color:#475569;font-size:15px;line-height:1.6">${escapeHtml(copy.message)}</p>
        ${renderTrackingHtml(data)}
        ${renderReviewInvitationHtml(data)}
      </td></tr>
      <tr><td style="padding:0 28px"><div style="border-top:1px solid #e2e8f0"></div></td></tr>
      <tr><td style="padding:22px 28px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
          <td style="vertical-align:top;padding-right:16px"><div style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.08em">FECHA</div><div style="margin-top:5px;color:#334155;font-size:13px">${escapeHtml(formatDate(data.createdAt))}</div></td>
          <td style="vertical-align:top"><div style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.08em">PAGO</div><div style="margin-top:5px;color:#334155;font-size:13px">${escapeHtml(paymentLabel(data.paymentMethod, data.paymentStatus))}</div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:0 28px 22px">
        <div style="margin-bottom:8px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.08em">ENTREGA</div>
        <div style="color:#0f172a;font-size:14px;font-weight:600">${escapeHtml(fulfillmentLabel(data.fulfillmentMethod))}</div>
        <div style="margin-top:4px;color:#475569;font-size:13px;line-height:1.5">${escapeHtml(destinationLabel(data))}</div>
        ${reference}
      </td></tr>
      <tr><td style="padding:0 28px"><div style="border-top:1px solid #e2e8f0"></div></td></tr>
      <tr><td style="padding:22px 28px">
        <div style="margin-bottom:8px;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:.08em">PRODUCTOS</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${renderItemsHtml(data)}</table>
        <div style="margin-top:14px">${renderTotalsHtml(data)}</div>
        ${notes}
      </td></tr>
      <tr><td style="padding:20px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;text-align:center">${support}<br>Este es un correo transaccional relacionado con tu pedido.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return {
    subject: `${copy.eyebrow === 'NUEVO PEDIDO' ? 'Nuevo pedido' : copy.title} #${data.orderNumber} · ${data.storeName}`,
    previewText: copy.message,
    html,
    text: renderText(data, copy),
  };
}
