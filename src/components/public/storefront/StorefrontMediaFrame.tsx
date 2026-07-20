import type { CSSProperties, ReactNode } from 'react';
import { isLikelyPngAsset } from '@/lib/images/imageFormat';

interface StorefrontMediaFrameProps {
  src: string | null;
  alt: string;
  fallback: ReactNode;
  aspectClassName: string;
  roundedClassName?: string;
  imageClassName?: string;
  pngImageClassName?: string;
  className?: string;
  style?: CSSProperties;
}

export function StorefrontMediaFrame({
  src,
  alt,
  fallback,
  aspectClassName,
  roundedClassName = 'rounded-xl',
  imageClassName = 'h-full w-full object-cover',
  pngImageClassName = 'h-full w-full object-cover p-0 drop-shadow-[0_10px_14px_rgba(15,23,42,0.08)]',
  className = '',
  style,
}: StorefrontMediaFrameProps) {
  const isPng = isLikelyPngAsset(src);

  return (
    <div
      className={`relative overflow-hidden ${aspectClassName} ${roundedClassName} ${className}`.trim()}
      style={style}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={isPng ? pngImageClassName : imageClassName}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
