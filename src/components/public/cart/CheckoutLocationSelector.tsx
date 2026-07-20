import { MapPin } from 'lucide-react';
import type { StorefrontTheme } from '../storefront/storefrontTheme';
import type { PublicStoreLocation } from '@/features/locations/locations.types';

interface CheckoutLocationSelectorProps {
  theme: StorefrontTheme;
  locations: PublicStoreLocation[];
  selectedLocation: PublicStoreLocation | null;
  disabled: boolean;
  title?: string;
  helperText?: string | null;
  onSelectLocation: (location: PublicStoreLocation) => void;
}

// Returns unique {city, department} pairs from active locations
function getUniqueCities(locations: PublicStoreLocation[]): { city: string; department: string | null }[] {
  const seen = new Set<string>();
  const result: { city: string; department: string | null }[] = [];
  for (const loc of locations) {
    if (!loc.city) continue;
    if (!seen.has(loc.city)) {
      seen.add(loc.city);
      result.push({ city: loc.city, department: loc.department });
    }
  }
  return result;
}

export function CheckoutLocationSelector({
  theme,
  locations,
  selectedLocation,
  disabled,
  title = 'Sede de atención',
  helperText = null,
  onSelectLocation,
}: CheckoutLocationSelectorProps) {
  const uniqueCities = getUniqueCities(locations);
  const hasMultipleCities = uniqueCities.length > 1;
  const hasMultipleLocations = locations.length > 1;
  const locationsForSelectedCity = hasMultipleCities
    ? locations.filter((l) => l.city === selectedLocation?.city)
    : locations;

  function handleCityChange(city: string) {
    const loc = locations.find((l) => l.city === city);
    if (loc) onSelectLocation(loc);
  }

  function handleLocationChange(locationId: string) {
    const loc = locationsForSelectedCity.find((l) => l.locationId === locationId);
    if (loc) onSelectLocation(loc);
  }

  return (
    <div className="space-y-2">
      {title ? (
        <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
          {title}
        </p>
      ) : null}
      {helperText ? (
        <p className="text-xs leading-5" style={{ color: theme.mutedText }}>
          {helperText}
        </p>
      ) : null}

      {/* Case 3: multiple cities → city selector */}
      {hasMultipleCities && (
        <div className="space-y-1">
          <label className="block text-xs" style={{ color: theme.mutedText }}>
            Ciudad
          </label>
          <select
            value={selectedLocation?.city ?? ''}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none appearance-none disabled:opacity-60"
            style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
          >
            {uniqueCities.map((c) => (
              <option key={c.city} value={c.city}>{c.city}</option>
            ))}
          </select>
          <p className="text-xs opacity-50" style={{ color: theme.mutedText }}>
            Esta tienda solo atiende en las ciudades donde tiene sucursales activas.
          </p>
        </div>
      )}

      {/* Cases 2 & 3: multiple locations → location selector */}
      {hasMultipleLocations && (
        <div className="space-y-1">
          <label className="block text-xs" style={{ color: theme.mutedText }}>
            Sede
          </label>
          <select
            value={selectedLocation?.locationId ?? ''}
            onChange={(e) => handleLocationChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none appearance-none disabled:opacity-60"
            style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
          >
            {locationsForSelectedCity.map((loc) => (
              <option key={loc.locationId} value={loc.locationId}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Location badge: always shown */}
      {selectedLocation ? (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: `${theme.primary}10` }}
        >
          <MapPin className="w-4 h-4 shrink-0" style={{ color: theme.primary }} />
          <div className="min-w-0">
            {!hasMultipleLocations && (
              <p className="text-sm font-medium" style={{ color: theme.text }}>
                {selectedLocation.name}
              </p>
            )}
            {(selectedLocation.city || selectedLocation.department) && (
              <p className="text-xs" style={{ color: theme.mutedText }}>
                {[selectedLocation.city, selectedLocation.department]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs" style={{ color: theme.primary }}>Selecciona una sede para continuar.</p>
      )}
    </div>
  );
}
