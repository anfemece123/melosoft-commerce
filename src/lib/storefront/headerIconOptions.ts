import type { HeaderNavigationIconKey } from '@/types/common.types';

export const HEADER_NAVIGATION_ICON_OPTIONS: Array<{
  value: HeaderNavigationIconKey;
  label: string;
}> = [
  { value: 'home', label: 'Inicio' },
  { value: 'shopping-bag', label: 'Bolsa de compras' },
  { value: 'folder-tree', label: 'Categorías' },
  { value: 'layers', label: 'Colecciones' },
  { value: 'sliders', label: 'Filtros' },
  { value: 'sparkles', label: 'Destacados' },
  { value: 'badge-percent', label: 'Ofertas' },
  { value: 'star', label: 'Estrella' },
  { value: 'heart', label: 'Favoritos' },
  { value: 'tag', label: 'Etiqueta' },
  { value: 'dumbbell', label: 'Deportes' },
  { value: 'grid', label: 'Cuadrícula' },
];
