import { MapPin, ChevronDown } from 'lucide-react';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { useLocationChangeWithCheck } from '@/lib/locations/useLocationChangeWithCheck';
import { LocationConflictModal } from './LocationConflictModal';
import { Skeleton } from '@/components/ui/Skeleton';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';

interface Props {
  theme: StorefrontTheme;
  storeId: string;
}

export function LocationSelector({ theme, storeId: _storeId }: Props) {
  const { locations, selectedLocation, isLoading } = useSelectedLocation();
  const { requestLocationChange, confirmLocationChange, cancelLocationChange, pendingChange, checking } =
    useLocationChangeWithCheck();

  // While the locations list is still resolving we don't yet know whether
  // this store even has more than one sede — show a small placeholder
  // instead of rendering nothing and then popping the real selector in
  // once it turns out there are multiple locations.
  if (isLoading) {
    return <Skeleton className="h-6 w-32 rounded-lg" style={{ backgroundColor: theme.surfaceAlt }} />;
  }

  if (locations.length <= 1) return null;

  return (
    <>
      <div className="relative inline-flex items-center gap-1.5">
        <MapPin className="w-4 h-4 shrink-0" style={{ color: theme.primary }} />
        <div className="relative">
          <select
            value={selectedLocation?.locationId ?? ''}
            onChange={e => {
              const loc = locations.find(l => l.locationId === e.target.value);
              if (loc) void requestLocationChange(loc);
            }}
            disabled={checking}
            className="appearance-none text-sm font-medium pr-6 pl-1 py-0.5 rounded-lg outline-none cursor-pointer border disabled:opacity-60"
            style={{
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border,
            }}
          >
            {locations.map(loc => (
              <option key={loc.locationId} value={loc.locationId}>
                {loc.name}{loc.city ? ` · ${loc.city}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: theme.mutedText }}
          />
        </div>
      </div>

      {pendingChange && (
        <LocationConflictModal
          theme={theme}
          targetLocation={pendingChange.location}
          result={pendingChange.result}
          onCancel={cancelLocationChange}
          onConfirm={confirmLocationChange}
        />
      )}
    </>
  );
}
