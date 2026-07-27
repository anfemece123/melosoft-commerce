import type { CSSProperties, ReactNode } from 'react';
import { isLikelyPngAsset } from '@/lib/images/imageFormat';
import { ImagePlaceholder } from '@/components/ui/ImagePlaceholder';

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
  /** Above-the-fold images (active gallery photo, hero) should load eagerly. */
  priority?: boolean;
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
  priority = false,
}: StorefrontMediaFrameProps) {
  const isPng = isLikelyPngAsset(src);

  return (
    <ImagePlaceholder
      src={src}
      alt={alt}
      fallback={fallback}
      priority={priority}
      className={`${aspectClassName} ${roundedClassName} ${className}`.trim()}
      style={style}
      imgClassName={isPng ? pngImageClassName : imageClassName}
    />
  );
}
