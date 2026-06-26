import type { CSSProperties } from 'react';
import { Hamburger } from 'lucide-react';

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
  iconClassName = '',
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
        <div className="flex h-full w-full items-center justify-center bg-white">
          <Hamburger
            className={iconClassName || 'h-1/2 w-1/2'}
            style={{ color: fallbackColor }}
            strokeWidth={2.2}
          />
        </div>
      )}
    </div>
  );
}
