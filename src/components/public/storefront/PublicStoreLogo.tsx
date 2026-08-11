import type { CSSProperties } from 'react';

interface PublicStoreLogoProps {
  logoUrl: string | null;
  storeName: string;
  sizeClassName: string;
  fallbackColor: string;
  outerClassName?: string;
  outerStyle?: CSSProperties;
  imageClassName?: string;
  iconClassName?: string;
}

export function PublicStoreLogo({
  logoUrl,
  storeName,
  sizeClassName,
  fallbackColor,
  outerClassName = '',
  outerStyle,
  imageClassName = '',
}: PublicStoreLogoProps) {
  return (
    <div
      className={`overflow-hidden rounded-full ${sizeClassName} ${outerClassName}`.trim()}
      style={outerStyle}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={storeName}
          className={`h-full w-full rounded-full object-cover ${imageClassName}`.trim()}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ backgroundColor: fallbackColor, color: '#ffffff' }}
        >
          <span
            className="text-xl font-bold tracking-tight"
            aria-hidden="true"
          >
            {getStoreInitials(storeName)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * A missing store logo should never turn into a food-specific icon. A compact
 * monogram is deterministic, brand-neutral and still identifies the store
 * while the owner uploads a logo.
 */
function getStoreInitials(storeName: string): string {
  const words = storeName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'M';
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
