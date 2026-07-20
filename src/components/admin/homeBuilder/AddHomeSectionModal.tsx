import { createPortal } from 'react-dom';
import {
  X,
  Megaphone,
  Package,
  LayoutGrid,
  MessageSquareQuote,
  ImageIcon,
  ShieldCheck,
  Images,
  Boxes,
  type LucideIcon,
} from 'lucide-react';
import type { HomeSectionType } from '@/types/common.types';
import { AVAILABLE_SECTION_TYPES, HOME_SECTION_TYPE_LABELS, HOME_SECTION_TYPE_DESCRIPTIONS } from '@/features/homeSections/homeSections.types';

interface AddHomeSectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (sectionType: HomeSectionType) => void;
}

const SECTION_ICONS: Partial<Record<HomeSectionType, LucideIcon>> = {
  promo_banners: Megaphone,
  featured_products: Package,
  catalog_products: Boxes,
  featured_categories: LayoutGrid,
  testimonials: MessageSquareQuote,
  image_text: ImageIcon,
  benefits: ShieldCheck,
  gallery: Images,
};

export function AddHomeSectionModal({ open, onClose, onSelect }: AddHomeSectionModalProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Agregar sección</h2>
            <p className="mt-0.5 text-sm text-gray-500">Elige qué quieres agregar al inicio de tu tienda.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
          {AVAILABLE_SECTION_TYPES.map((type) => {
            const Icon = SECTION_ICONS[type] ?? Package;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onSelect(type)}
                className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{HOME_SECTION_TYPE_LABELS[type]}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{HOME_SECTION_TYPE_DESCRIPTIONS[type]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
