import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { isLikelyPngAsset } from '@/lib/images/imageFormat';

interface ProductImageZoomProps {
  /** Always the already-resolved "active" image — general product photo,
   * a controlsMedia option value's own image, or a variant's exact
   * `imageUrl`, whichever `resolveVariantGalleryImages` picked upstream.
   * This component has zero awareness of variants/options; it only ever
   * zooms whatever URL it's handed, so it can never diverge from the
   * gallery's own resolution logic. */
  src: string | null;
  alt: string;
  fallback: ReactNode;
  className?: string;
}

const ZOOM_SCALE = 2.2;

/** Professional cursor-following hover-zoom for the PDP's main image — no
 * library, just a CSS `transform: scale()` with a `transformOrigin` that
 * tracks the pointer, GPU-composited and smooth. Desktop/mouse-only by
 * construction: `matchMedia('(hover: hover) and (pointer: fine)')` is
 * checked once at mount (pure CSR app, no SSR to reconcile) and every
 * mouse handler is entirely unattached when it's false — so touch devices
 * get exactly the plain, un-zoomed image with zero event listeners, never
 * a broken half-triggered zoom from a tap. */
export function ProductImageZoom({ src, alt, fallback, className = '' }: ProductImageZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isZooming, setIsZooming] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [hoverCapable] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  }

  if (!src) {
    return <div className={`relative h-full w-full overflow-hidden ${className}`}>{fallback}</div>;
  }

  const isPng = isLikelyPngAsset(src);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={alt}
      className={`relative h-full w-full overflow-hidden ${hoverCapable ? 'cursor-zoom-in' : ''} ${className}`}
      onMouseEnter={hoverCapable ? () => setIsZooming(true) : undefined}
      onMouseMove={hoverCapable ? handleMouseMove : undefined}
      onMouseLeave={hoverCapable ? () => setIsZooming(false) : undefined}
    >
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-cover ${isPng ? 'p-0 drop-shadow-[0_10px_14px_rgba(15,23,42,0.08)]' : ''}`}
        style={{
          transform: isZooming ? `scale(${ZOOM_SCALE})` : 'scale(1)',
          transformOrigin: `${origin.x}% ${origin.y}%`,
          transition: 'transform 150ms ease-out',
        }}
      />
    </div>
  );
}
