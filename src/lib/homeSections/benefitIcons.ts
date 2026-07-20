import { Truck, ShieldCheck, MessageCircle, BadgeCheck, CreditCard, Clock, PackageCheck, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type BenefitIconKey = 'truck' | 'shield' | 'whatsapp' | 'badge' | 'card' | 'clock' | 'package' | 'heart';

export const BENEFIT_ICONS: Record<BenefitIconKey, { label: string; icon: LucideIcon }> = {
  truck: { label: 'Envíos', icon: Truck },
  shield: { label: 'Pago seguro', icon: ShieldCheck },
  whatsapp: { label: 'Atención por WhatsApp', icon: MessageCircle },
  badge: { label: 'Garantía', icon: BadgeCheck },
  card: { label: 'Pagos', icon: CreditCard },
  clock: { label: 'Tiempo/entrega', icon: Clock },
  package: { label: 'Empaque', icon: PackageCheck },
  heart: { label: 'Satisfacción', icon: Heart },
};

export function resolveBenefitIcon(key: string | null): LucideIcon {
  if (key && key in BENEFIT_ICONS) return BENEFIT_ICONS[key as BenefitIconKey].icon;
  return Truck;
}
