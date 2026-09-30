import type { BadgeVariant } from '@/types/common.types';

export const STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Activo', variant: 'success' },
  draft: { label: 'Borrador', variant: 'warning' },
  inactive: { label: 'Inactivo', variant: 'neutral' },
  archived: { label: 'Archivado', variant: 'neutral' },
};
