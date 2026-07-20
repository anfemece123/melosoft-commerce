import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const MOBILE_WIDTH = 390;
const BEZEL = 5;

export type MobileClipMode = 'fade' | 'scroll';

interface StorefrontMobileFrameProps {
  children: ReactNode;
  backgroundColor?: string;
  /** Visual shrink applied to the *whole* phone mockup (bezel included)
   * after the mobile layout is fully computed — this is purely cosmetic,
   * a "camera zoom" on an already-mobile render. It must never be
   * confused with "rendering narrower": the iframe underneath always
   * renders at MOBILE_WIDTH regardless of this value, which is what
   * keeps Tailwind's breakpoints resolving to real mobile classes. See
   * the component doc comment. */
  scale?: number;
  /** Caps the mockup's on-screen height (post-scale). What happens past
   * that cap depends on `clipMode`. */
  maxHeight?: number;
  /** 'fade' (canvas): hard-clip at maxHeight, no scrolling at all — a
   *  bottom gradient signals "there's more" instead of a scrollbar. The
   *  canvas is for organizing sections, not reading every product in one.
   *  'scroll' (wizard): scrollable past maxHeight so the owner can review
   *  the whole section, but the native scrollbar is hidden via CSS (still
   *  fully scrollable by wheel/touch/drag — just no visible bar, so the
   *  mockup doesn't look like a broken embedded webpage).
   * @default 'fade' */
  clipMode?: MobileClipMode;
}

/** Mobile-mode preview shell. Deliberately NOT "the desktop scaler at a
 * smaller size" — Tailwind's `sm:`/`md:`/`lg:` are `@media (min-width: …)`
 * queries that check the browser's actual viewport, which on an admin's
 * desktop is wide regardless of how narrow a div inside the page is. There
 * is no CSS trick that makes a `<div style="width: 390px">` stop matching
 * `@media (min-width: 768px)` — the *only* browser primitive that gives a
 * subtree its own, independent viewport for media-query purposes is an
 * iframe. So this renders the section into a real `<iframe>` sized to
 * MOBILE_WIDTH: inside that iframe's own document, `md:` genuinely does
 * not match, and every component falls back to its base (mobile-first)
 * Tailwind classes — true mobile layout, not a shrunk desktop one.
 * (Verified empirically before building this: a 4-column `md:` grid
 * rendered inside a 390px srcdoc iframe resolves to the 2-column base
 * class, while the same grid in the parent page at desktop width still
 * resolves to 4 columns.)
 *
 * The iframe itself never scrolls — its `height` is always set to its
 * content's exact natural height (`contentHeight`, from ResizeObserver),
 * so there is nothing to clip *inside* it. All clipping/scrolling happens
 * one level up, on the wrapper that also carries the visual `scale` — the
 * scrollbar the previous version showed came from that wrapper setting
 * `overflowY` without an explicit `overflowX`, and per the CSS spec, a
 * non-`visible` overflow-y forces overflow-x to compute as `auto` too —
 * hence a spurious horizontal bar alongside the intentional vertical one.
 * Both axes are set explicitly below to avoid that.
 *
 * Mechanics:
 * 1. `srcDoc` gives the iframe a blank same-origin document immediately,
 *    with `overflow-x: hidden` baked into its own html/body as a second,
 *    defensive layer — belt and suspenders alongside the explicit
 *    `overflowX: hidden` on the wrapper below.
 * 2. On load, the parent's stylesheets (Tailwind's compiled CSS — a
 *    `<link>` in production, `<style>` tags under Vite dev) are cloned
 *    into the iframe's `<head>` so utility classes resolve identically.
 * 3. React content is rendered into the iframe's document via
 *    `createPortal` — same fiber tree as the rest of the app (state/props
 *    flow in normally), just mounted in a different document.
 * 4. A capture-phase click/submit listener is registered directly on the
 *    iframe's OWN document (native DOM API, not a React prop) — React's
 *    synthetic event system is rooted in the *main* document and never
 *    sees native events that occur inside a different browsing context,
 *    so a `onClickCapture` on a wrapping element in the parent tree
 *    cannot stop a real `<a>` navigation happening in here. This listener
 *    is the one that actually matters for "no navegar" in mobile mode. */
export function StorefrontMobileFrame({
  children,
  backgroundColor,
  scale = 0.8,
  maxHeight,
  clipMode = 'fade',
}: StorefrontMobileFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [contentHeight, setContentHeight] = useState(300);

  function handleLoad() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      doc.head.appendChild(node.cloneNode(true));
    });

    const blockRealAction = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    doc.addEventListener('click', blockRealAction, true);
    doc.addEventListener('submit', blockRealAction, true);

    const container = doc.createElement('div');
    doc.body.appendChild(container);
    setMountNode(container);
  }

  useEffect(() => {
    if (!mountNode) return;
    // Same defensive guard as StorefrontViewportScaler — mountNode's own
    // height isn't set from this state (it lives inside the iframe's
    // independent document, unaffected by the outer iframe element's CSS
    // height), so this isn't self-referential the same way, but skipping
    // a no-op setState is cheap insurance against any reflow jitter.
    const resizeObserver = new ResizeObserver(() => {
      const next = Math.round(mountNode.scrollHeight);
      setContentHeight((prev) => (prev === next ? prev : next));
    });
    resizeObserver.observe(mountNode);
    return () => resizeObserver.disconnect();
  }, [mountNode]);

  const naturalWidth = MOBILE_WIDTH + BEZEL * 2;
  const naturalHeight = contentHeight + BEZEL * 2;
  const scaledWidth = naturalWidth * scale;
  const scaledHeight = naturalHeight * scale;
  const displayHeight = maxHeight ? Math.min(scaledHeight, maxHeight) : scaledHeight;
  const isClipped = Boolean(maxHeight && scaledHeight > maxHeight);

  return (
    <div className="mx-auto" style={{ width: scaledWidth }}>
      <div
        className={`relative ${clipMode === 'scroll' ? 'no-scrollbar' : ''}`}
        style={{
          width: scaledWidth,
          height: displayHeight,
          overflowX: 'hidden',
          overflowY: clipMode === 'scroll' ? 'auto' : 'hidden',
        }}
      >
        <div style={{ width: naturalWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div
            className="overflow-hidden rounded-[1.4rem] border-[5px] border-gray-800 bg-gray-800 shadow-md"
            style={{ width: naturalWidth }}
          >
            <div className="overflow-hidden rounded-2xl">
              <iframe
                ref={iframeRef}
                title="Vista previa móvil"
                srcDoc="<!doctype html><html style='overflow-x:hidden'><head></head><body style='margin:0;overflow-x:hidden;width:100%'></body></html>"
                onLoad={handleLoad}
                style={{ width: MOBILE_WIDTH, height: contentHeight, border: 'none', display: 'block', backgroundColor }}
              />
            </div>
          </div>
        </div>
        {mountNode ? createPortal(children, mountNode) : null}
        {clipMode === 'fade' && isClipped && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
            style={{ background: `linear-gradient(to top, ${backgroundColor ?? '#ffffff'}, transparent)` }}
          />
        )}
      </div>
    </div>
  );
}
