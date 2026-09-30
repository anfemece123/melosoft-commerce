import type { StoreLimit } from './stores.types';

/** Admin areas that only make sense when the store sells with prices:
 * orders/cart, Wompi payments, priced offers with countdown and partner
 * discount codes (applied at checkout). A "Catálogo con consulta por
 * WhatsApp" store has none of them, so its panel hides them. Data is kept;
 * turning the mode off shows them again. */
const HIDDEN_ADMIN_SECTIONS = ['orders', 'payments', 'offers', 'partners'] as const;

const HIDDEN_ADMIN_PATH = new RegExp(`^/admin/stores/[^/]+/(${HIDDEN_ADMIN_SECTIONS.join('|')})(/|$)`);

export function isWhatsappInquiryMode(limits: StoreLimit | null | undefined): boolean {
  return limits?.whatsappInquiryMode === true;
}

export function isAdminPathHiddenByInquiryMode(
  limits: StoreLimit | null | undefined,
  path: string,
): boolean {
  return isWhatsappInquiryMode(limits) && HIDDEN_ADMIN_PATH.test(path);
}
