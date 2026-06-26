import { X, MapPin, AlertTriangle } from 'lucide-react';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { PublicStoreLocation } from '@/features/locations/locations.types';
import type { LocationCompatibilityResult } from '@/lib/locations/locationCompatibility';

interface LocationConflictModalProps {
  theme: StorefrontTheme;
  targetLocation: PublicStoreLocation;
  result: LocationCompatibilityResult;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LocationConflictModal({
  theme,
  targetLocation,
  result,
  onCancel,
  onConfirm,
}: LocationConflictModalProps) {
  const isTotal = result.noneAvailable;
  const count = result.unavailableCount;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 shadow-xl"
        style={{ backgroundColor: theme.surface }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            <h3 className="font-semibold text-sm leading-snug" style={{ color: theme.text }}>
              {isTotal
                ? 'Tu pedido no está disponible en esta sede'
                : 'Algunos productos no están disponibles'}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 rounded-lg p-1 hover:opacity-70 transition-opacity"
            style={{ color: theme.mutedText }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs mb-3" style={{ color: theme.mutedText }}>
          {isTotal
            ? `Ninguno de los productos de tu pedido está disponible en ${targetLocation.name}. ¿Deseas cambiar y vaciar tu pedido?`
            : `Para cambiar a ${targetLocation.name} debes quitar ${count === 1 ? 'este producto' : `estos ${count} productos`} de tu pedido.`}
        </p>

        <ul className="mb-3 space-y-2.5">
          {result.unavailableItems.map(item => (
            <li key={item.productId}>
              <p className="text-sm font-medium" style={{ color: theme.text }}>{item.productName}</p>
              {item.availableInLocations.length > 0 ? (
                <p className="text-xs mt-0.5" style={{ color: theme.primary }}>
                  Disponible en: {item.availableInLocations.map(l => l.name).join(', ')}
                </p>
              ) : (
                <p className="text-xs mt-0.5" style={{ color: theme.mutedText }}>
                  No disponible en ninguna otra sede activa
                </p>
              )}
            </li>
          ))}
        </ul>

        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 mb-4 text-xs"
          style={{ backgroundColor: `${theme.primary}10`, color: theme.mutedText }}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: theme.primary }} />
          <span>
            Cambiando a <strong style={{ color: theme.text }}>{targetLocation.name}</strong>
            {targetLocation.city ? ` · ${targetLocation.city}` : ''}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }}
          >
            Conservar sede
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: isTotal ? '#ef4444' : theme.primary }}
          >
            {isTotal
              ? 'Cambiar y vaciar pedido'
              : `Cambiar y quitar ${count === 1 ? '1 producto' : `${count} productos`}`}
          </button>
        </div>
      </div>
    </div>
  );
}
