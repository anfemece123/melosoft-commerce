import type { CatalogType, CommerceMode } from '@/types/common.types';

export interface PublicCommerceConfig {
  catalogType: CatalogType | null;
  commerceMode: CommerceMode | null;
  allowsPickup: boolean | null;
  allowsLocalDelivery: boolean | null;
  allowsNationalShipping: boolean | null;
  whatsappCheckoutEnabled: boolean | null;
  webOrderEnabled: boolean | null;
  cashOnDeliveryEnabled: boolean | null;
  onlineCheckoutEnabled: boolean | null;
  localDeliveryNotes: string | null;
  shippingNotes: string | null;
}

export function getCatalogLabel(config: PublicCommerceConfig): string {
  if (config.catalogType === 'menu') return 'Menú';
  if (config.catalogType === 'services') return 'Servicios';
  return 'Productos';
}

export function getItemLabel(config: PublicCommerceConfig): string {
  if (config.catalogType === 'menu') return 'plato';
  if (config.catalogType === 'services') return 'servicio';
  return 'producto';
}

export function getCatalogSearchPlaceholder(config: PublicCommerceConfig): string {
  if (config.catalogType === 'menu') return 'Busca tu plato favorito';
  if (config.catalogType === 'services') return 'Busca un servicio';
  return 'Busca un producto';
}

export function canUseWhatsappCheckout(config: PublicCommerceConfig): boolean {
  return config.whatsappCheckoutEnabled === true;
}

/** Web-based order form with cart + COD — enabled when webOrderEnabled. NOT Wompi. */
export function canUseWebOrders(config: PublicCommerceConfig): boolean {
  return config.webOrderEnabled === true;
}

/** Cash on delivery is active for web orders */
export function isCashOnDeliveryActive(config: PublicCommerceConfig): boolean {
  return config.cashOnDeliveryEnabled === true;
}

/** Wompi online payment — always false until Fase 7 */
export function canUseOnlineCheckout(_config: PublicCommerceConfig): boolean {
  return false;
}

export function hasAnyPurchaseMethod(config: PublicCommerceConfig): boolean {
  return canUseWhatsappCheckout(config) || canUseWebOrders(config) || canUseOnlineCheckout(config);
}

export function getProductCardCtaLabel(config: PublicCommerceConfig): string {
  if (!hasAnyPurchaseMethod(config)) return 'Ver detalle';
  if (canUseWebOrders(config)) {
    if (config.catalogType === 'services') return 'Ver servicio';
    return 'Agregar al pedido';
  }
  if (config.catalogType === 'menu') return 'Pedir ahora';
  if (config.catalogType === 'services') return 'Ver servicio';
  return 'Ver y pedir';
}

export interface ProductPageCtaConfig {
  show: boolean;
  label: string;
  variant: 'whatsapp' | 'primary' | 'outline';
  isComingSoon: boolean;
  /** True when both WhatsApp and web orders are active (mixed mode) */
  showSecondaryWhatsapp: boolean;
}

export function getProductPageCtaConfig(
  config: PublicCommerceConfig,
  hasWhatsappNumber: boolean
): ProductPageCtaConfig {
  const webOrders = canUseWebOrders(config);
  const whatsapp = canUseWhatsappCheckout(config) && hasWhatsappNumber;

  if (webOrders) {
    const label = config.catalogType === 'menu' ? 'Agregar al pedido' : 'Agregar al pedido';
    return { show: true, label, variant: 'primary', isComingSoon: false, showSecondaryWhatsapp: false };
  }

  if (whatsapp) {
    const label = config.catalogType === 'menu' ? 'Pedir por WhatsApp' : 'Consultar por WhatsApp';
    return { show: true, label, variant: 'whatsapp', isComingSoon: false, showSecondaryWhatsapp: false };
  }

  if (canUseOnlineCheckout(config)) {
    return {
      show: true,
      label: 'Checkout online (próximamente)',
      variant: 'primary',
      isComingSoon: true,
      showSecondaryWhatsapp: false,
    };
  }

  return { show: false, label: '', variant: 'outline', isComingSoon: false, showSecondaryWhatsapp: false };
}

export interface DeliveryBadgeInfo {
  label: string;
  notes: string | null;
  icon: 'pickup' | 'local' | 'national';
}

export function getDeliveryBadges(config: PublicCommerceConfig): DeliveryBadgeInfo[] {
  const badges: DeliveryBadgeInfo[] = [];
  if (config.allowsPickup) {
    badges.push({ label: 'Retiro en local', notes: null, icon: 'pickup' });
  }
  if (config.allowsLocalDelivery) {
    badges.push({ label: 'Domicilio local', notes: config.localDeliveryNotes ?? null, icon: 'local' });
  }
  if (config.allowsNationalShipping) {
    badges.push({ label: 'Envío nacional', notes: config.shippingNotes ?? null, icon: 'national' });
  }
  return badges;
}

export function getCatalogEmptyMessage(config: PublicCommerceConfig): string {
  if (config.catalogType === 'menu') return 'El menú está vacío por el momento.';
  if (config.catalogType === 'services') return 'No hay servicios disponibles por el momento.';
  return 'Aún no hay productos disponibles.';
}

export function getNoPurchaseMethodMessage(config: PublicCommerceConfig): string | null {
  if (hasAnyPurchaseMethod(config)) return null;
  return 'Esta tienda muestra su catálogo. Contacta al negocio para más información.';
}
