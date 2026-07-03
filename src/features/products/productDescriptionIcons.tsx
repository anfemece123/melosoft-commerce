import React from 'react';
import {
  CheckCircle,
  Info,
  Star,
  Package,
  Truck,
  Shield,
  Wrench,
  ChefHat,
  Leaf,
  Award,
  MapPin,
  Clock,
  Users,
  Lightbulb,
  AlertCircle,
  FileText,
  Heart,
  Zap,
  Camera,
  Ruler,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type IconComponent = React.FC<LucideProps>;

const ICON_MAP: Record<string, IconComponent> = {
  checkCircle: CheckCircle,
  info: Info,
  star: Star,
  package: Package,
  truck: Truck,
  shield: Shield,
  wrench: Wrench,
  chefHat: ChefHat,
  leaf: Leaf,
  award: Award,
  mapPin: MapPin,
  clock: Clock,
  users: Users,
  lightbulb: Lightbulb,
  alertCircle: AlertCircle,
  fileText: FileText,
  heart: Heart,
  zap: Zap,
  camera: Camera,
  ruler: Ruler,
};

export function getProductIcon(key: string, props?: LucideProps): React.ReactElement {
  const Icon = ICON_MAP[key] ?? Info;
  return <Icon {...props} />;
}

export const PRODUCT_ICON_LIST: { key: string; label: string }[] = [
  { key: 'checkCircle', label: 'Incluye' },
  { key: 'info', label: 'Info' },
  { key: 'star', label: 'Destacado' },
  { key: 'package', label: 'Contenido' },
  { key: 'truck', label: 'Envío' },
  { key: 'shield', label: 'Garantía' },
  { key: 'wrench', label: 'Especificaciones' },
  { key: 'chefHat', label: 'Preparación' },
  { key: 'leaf', label: 'Ingredientes' },
  { key: 'award', label: 'Beneficios' },
  { key: 'mapPin', label: 'Origen' },
  { key: 'clock', label: 'Tiempo' },
  { key: 'users', label: 'Para quién' },
  { key: 'lightbulb', label: 'Tips' },
  { key: 'alertCircle', label: 'Advertencia' },
  { key: 'fileText', label: 'Instrucciones' },
  { key: 'heart', label: 'Cuidado' },
  { key: 'zap', label: 'Rendimiento' },
  { key: 'camera', label: 'Detalles' },
  { key: 'ruler', label: 'Medidas' },
];
