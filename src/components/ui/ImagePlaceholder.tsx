import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref, type MouseEventHandler } from 'react';
import { Skeleton } from './Skeleton';
import { cn } from '@/utils/cn';

interface ImagePlaceholderProps {
  src: string | null | undefined;
  alt: string;
  /** Shown when `src` is empty, or once the image fails to load. */
  fallback: ReactNode;
  /** Classes for the outer wrapper — put aspect-ratio/rounded/size here. */
  className?: string;
  style?: CSSProperties;
  /** Classes for the `<img>` itself (object-fit, etc). */
  imgClassName?: string;
  /**
   * Extra inline style merged onto the `<img>` — for dynamic per-frame
   * values (e.g. a hover-zoom `transform`/`transformOrigin`). Must NOT set
   * `transition` here: the fade-in transition is class-based (so
   * `motion-reduce:` can disable it); add any extra transition as a
   * Tailwind class on `imgClassName` (e.g. `transition-transform`) instead,
   * not as an inline `transition` shorthand, which would silently override
   * the fade's own transition property.
   */
  imgStyle?: Omit<CSSProperties, 'transition'>;
  /**
   * Above-the-fold images (product gallery main image, store hero) should
   * load eagerly so they aren't delayed behind the browser's lazy-load
   * heuristics. Defaults to `false` (lazy) since most call sites are
   * below-the-fold grid/thumbnail images.
   */
  priority?: boolean;
  /** Only needed by interactive viewers (e.g. hover-zoom) that must attach
   * pointer handlers/ref to the wrapper without duplicating the loading
   * state machine above. */
  containerRef?: Ref<HTMLDivElement>;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseMove?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  role?: string;
  'aria-label'?: string;
}

/**
 * Reserves its box (via `className`) immediately, shows a shimmer while the
 * image bytes are in flight, fades the real image in once loaded, and
 * swaps to `fallback` on a missing/broken `src` — never the browser's
 * native broken-image icon.
 */
export function ImagePlaceholder({
  src,
  alt,
  fallback,
  className,
  style,
  imgClassName = 'h-full w-full object-cover',
  imgStyle,
  priority = false,
  containerRef,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  role,
  'aria-label': ariaLabel,
}: ImagePlaceholderProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!src) {
      setStatus('error');
      return;
    }
    // A cached (or otherwise already-available) image can finish loading
    // before this effect attaches `onLoad`/`onError` below, so that event
    // is never seen and `status` would stay stuck on 'loading' forever —
    // opacity-0 forever — even though the image is really there. Check the
    // element's own `complete`/`naturalWidth` here as the source of truth
    // for that case instead of relying solely on the load/error events.
    const el = imgRef.current;
    if (el && el.complete) {
      setStatus(el.naturalWidth > 0 ? 'loaded' : 'error');
    } else {
      setStatus('loading');
    }
  }, [src]);

  const showFallback = status === 'error';

  return (
    <div
      ref={containerRef}
      role={role}
      aria-label={ariaLabel}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={cn('relative overflow-hidden', className)}
      style={style}
    >
      {showFallback ? (
        fallback
      ) : (
        <>
          {status === 'loading' ? <Skeleton className="absolute inset-0" /> : null}
          {src ? (
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setStatus('loaded')}
              onError={() => setStatus('error')}
              style={imgStyle}
              className={cn(
                imgClassName,
                'transition-opacity duration-300 motion-reduce:transition-none',
                status === 'loaded' ? 'opacity-100' : 'opacity-0'
              )}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
