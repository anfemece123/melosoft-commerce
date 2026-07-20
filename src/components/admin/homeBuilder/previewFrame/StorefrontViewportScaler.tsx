import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface StorefrontViewportScalerProps {
  children: ReactNode;
  backgroundColor?: string;
}

/** Desktop-mode preview shell — shared by the wizard's live preview and the
 * canvas's per-section cards. The public section renderers use
 * viewport-relative Tailwind breakpoints (`md:grid-cols-4`, `sm:inline-flex`,
 * …) and assume they own a full-width page; dropped directly into a narrow
 * admin panel, a "4 columns" grid would still resolve `md:grid-cols-4`
 * (that media query checks the browser's real viewport, not this panel) but
 * lay those 4 columns out inside a few-hundred-px box, squishing every card
 * into a sliver.
 *
 * The fix is the standard "device preview" trick: render the content at
 * its natural desktop width in a fixed-width inner box (so Grid/Flex
 * compute real, well-proportioned column widths), then visually shrink
 * that whole box with `transform: scale()` to fit the panel. CSS
 * transforms are paint-only — `scrollHeight`/`clientWidth` measurements
 * are unaffected — so the ResizeObserver below always reads true,
 * unscaled layout sizes.
 *
 * This only works because the browser's real viewport (the admin's own
 * window) is already desktop-sized, so `md:`/`lg:` correctly apply in the
 * first place — see StorefrontMobileFrame for why mobile needs a
 * fundamentally different approach (an iframe), not just a smaller scale
 * of this same component. */
const NATURAL_WIDTH = 1080;

export function StorefrontViewportScaler({ children, backgroundColor }: StorefrontViewportScalerProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

  // useLayoutEffect (not useEffect) so the first, synchronous `measure()`
  // call below sets the real scale/height before the browser paints —
  // otherwise the first frame would flash the content at scale(1), full
  // NATURAL_WIDTH, clipped by the panel's overflow-hidden.
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // `outer`'s own height is *set from* scaledHeight, which this same
    // measurement computes — observing `outer` is necessary (its width
    // can genuinely change from outside, e.g. a window resize or the
    // wizard's mobile/desktop tab toggling the panel's layout), but that
    // makes this a self-referential loop: measure -> setState -> outer's
    // box changes -> ResizeObserver fires again -> measure. Floating-point
    // rounding means two passes are rarely bit-for-bit identical, so
    // without rounding + a change check this never converges — the
    // "screen freezes" symptom. Rounding to whole pixels / 3 decimals
    // collapses that jitter, and skipping setState when the rounded value
    // hasn't moved is what actually breaks the loop.
    function measure() {
      if (!outer || !inner) return;
      const nextScale = Math.round((outer.clientWidth / NATURAL_WIDTH) * 1000) / 1000;
      const nextHeight = Math.round(inner.scrollHeight * nextScale);
      setScale((prev) => (prev === nextScale ? prev : nextScale));
      setScaledHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    }

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(outer);
    resizeObserver.observe(inner);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="overflow-hidden rounded-lg"
      style={{ height: scaledHeight, backgroundColor }}
    >
      <div
        ref={innerRef}
        style={{ width: NATURAL_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  );
}
