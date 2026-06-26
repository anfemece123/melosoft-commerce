import type { ReactNode } from 'react';
import { isLikelyPngAsset } from '@/lib/images/imageFormat';

interface StorefrontMediaFrameProps {
  src: string | null;
  alt: string;
  fallback: ReactNode;
  aspectClassName: string;
  roundedClassName?: string;
  imageClassName?: string;
  pngImageClassName?: string;
}

export function StorefrontMediaFrame({
  src,
  alt,
  fallback,
  aspectClassName,
  roundedClassName = 'rounded-xl',
  imageClassName = 'h-full w-full object-cover',
  pngImageClassName = 'h-full w-full object-contain p-3 drop-shadow-[0_16px_18px_rgba(0,0,0,0.22)]',
}: StorefrontMediaFrameProps) {
  const isPng = isLikelyPngAsset(src);

  return (
    <div
      className={`relative overflow-hidden ${aspectClassName} ${roundedClassName} ${isPng ? '' : 'bg-gray-100'}`.trim()}
      style={{
        background: isPng
          ? 'radial-gradient(circle at 50% 84%, rgba(15,23,42,0.16) 0, rgba(15,23,42,0.08) 16%, transparent 34%)'
          : undefined,
      }}
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
