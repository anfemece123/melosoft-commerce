import { buildWhatsAppContactUrl } from '@/lib/whatsapp/whatsappUrl';

export function buildWhatsAppUrl(phoneNumber: string, message: string): string | null {
  return buildWhatsAppContactUrl(phoneNumber, message);
}
