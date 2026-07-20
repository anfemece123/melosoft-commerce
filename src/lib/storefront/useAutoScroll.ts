import { useEffect, useRef, type RefObject } from 'react';

const STEP_PX = 0.6;
const INTERVAL_MS = 16;

/** Continuously nudges `ref`'s `scrollLeft` to the right, wrapping back to
 * 0 once it reaches the end — a light "marquee" effect for the `band`/
 * `logos` Beneficios layouts (never used by the paged `carousel` layout,
 * where continuous motion would fight the owner's own arrow/dot paging).
 * Pauses while the pointer is over the element so a visitor can still
 * read/click an item without it sliding out from under them, and cleans
 * up its interval on unmount/`enabled` toggle — no extra dependency. */
export function useAutoScroll(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const pausedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    function handleEnter() {
      pausedRef.current = true;
    }
    function handleLeave() {
      pausedRef.current = false;
    }
    el.addEventListener('pointerenter', handleEnter);
    el.addEventListener('pointerleave', handleLeave);

    const interval = setInterval(() => {
      if (pausedRef.current) return;
      const node = ref.current;
      if (!node) return;
      const maxScroll = node.scrollWidth - node.clientWidth;
      if (maxScroll <= 0) return;
      const next = node.scrollLeft + STEP_PX;
      node.scrollLeft = next >= maxScroll ? 0 : next;
    }, INTERVAL_MS);

    return () => {
      clearInterval(interval);
      el.removeEventListener('pointerenter', handleEnter);
      el.removeEventListener('pointerleave', handleLeave);
    };
  }, [ref, enabled]);
}
