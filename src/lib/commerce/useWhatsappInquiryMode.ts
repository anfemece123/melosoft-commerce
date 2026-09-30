import { usePublicStoreBranding } from '@/components/layout/PublicStoreBrandingContext';

export interface WhatsappInquiryModeState {
  enabled: boolean;
  storeName: string | null;
  storeSlug: string | null;
  whatsappNumber: string | null;
}

/** Reads the store's "Catálogo con consulta por WhatsApp" switch from the
 * public branding already loaded by PublicLayout — no extra request. Outside
 * the storefront (e.g. admin previews) there is no branding, so it's off. */
export function useWhatsappInquiryMode(): WhatsappInquiryModeState {
  const { branding } = usePublicStoreBranding();
  return {
    enabled: branding?.whatsappInquiryMode === true,
    storeName: branding?.storeName ?? null,
    storeSlug: branding?.storeSlug ?? null,
    whatsappNumber: branding?.whatsappNumber ?? null,
  };
}
