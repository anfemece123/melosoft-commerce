import { useEffect } from 'react';

/** Freezes the page behind an open sheet/drawer. `overflow: hidden` alone
 * is ignored by iOS Safari (the page still scrolls under the finger and
 * the toolbar collapses, moving fixed panels), so the body is pinned with
 * `position: fixed` at the current offset and restored on unlock. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      htmlOverflow: documentElement.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      documentElement.style.overflow = previous.htmlOverflow;
      window.scrollTo({ top: scrollY, behavior: 'instant' });
    };
  }, [active]);
}
