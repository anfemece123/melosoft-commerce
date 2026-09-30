import { buildWhatsAppContactUrl } from '@/lib/whatsapp/whatsappUrl';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';

/** "Catálogo con consulta por WhatsApp" — a platform-admin switch
 * (store_limits.whatsapp_inquiry_mode) for businesses without fixed
 * prices. The storefront hides prices, cart and checkout, and every
 * product gets a button that opens WhatsApp with a ready-made inquiry.
 * Stock is not shown either: these stores confirm availability in the
 * chat, so an untracked stock of 0 must never read as "Agotado". */

export const WHATSAPP_INQUIRY_CTA_LABEL = 'Consultar precio';
export const WHATSAPP_INQUIRY_PRODUCT_CTA_LABEL = 'Consultar precio por WhatsApp';

export interface ProductInquiryMessageInput {
  storeName: string | null | undefined;
  productName: string;
  /** e.g. "Tamaño: 100 ml" — only when the customer already picked a variant. */
  variantLabel?: string | null;
  productUrl?: string | null;
}

export function buildProductInquiryMessage({
  storeName,
  productName,
  variantLabel,
  productUrl,
}: ProductInquiryMessageInput): string {
  const greeting = storeName?.trim() ? `¡Hola, ${storeName.trim()}! 👋` : '¡Hola! 👋';
  return [
    greeting,
    '',
    'Me interesa este producto:',
    `*${productName.trim()}*`,
    ...(variantLabel?.trim() ? [variantLabel.trim()] : []),
    '',
    '¿Me podrías indicar el precio, la disponibilidad y las presentaciones que manejan?',
    ...(productUrl ? ['', `Lo vi aquí: ${productUrl}`] : []),
    '',
    '¡Gracias!',
  ].join('\n');
}

/** Absolute storefront URL of a product, valid on both the platform
 * path (/s/:slug/p/...) and the store's own subdomain/custom domain. */
export function buildAbsoluteProductUrl(storeSlug: string, productSlug: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URL(buildStorefrontPath(storeSlug, `/p/${productSlug}`), window.location.origin).toString();
}

export function buildProductInquiryUrl(
  whatsappNumber: string | null | undefined,
  input: ProductInquiryMessageInput,
): string | null {
  return buildWhatsAppContactUrl(whatsappNumber, buildProductInquiryMessage(input));
}

export function openWhatsappInquiry(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer');
}
