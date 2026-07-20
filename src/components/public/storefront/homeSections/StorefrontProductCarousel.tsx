import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { StorefrontTheme } from '../storefrontTheme';

interface StorefrontProductCarouselProps {
  /** One rendered card per entry — the carousel only owns layout/scroll/
   * arrows/dots, never card content, so it works identically for
   * "Productos destacados" and "Catálogo de productos". */
  items: ReactNode[];
  itemKeys: string[];
  columnsDesktop: number;
  visibleMobile: number;
  theme: StorefrontTheme;
  /** Both default `true` — every existing caller (featured_products,
   * catalog_products) keeps its current arrows+dots behavior unchanged.
   * Benefits is the first consumer to actually turn either off (e.g. a
   * "banda de confianza" that should feel like a continuous strip, not a
   * paged carousel). */
  showArrows?: boolean;
  showDots?: boolean;
}

const MOBILE_BASIS: Record<number, string> = {
  1: 'basis-[86%]',
  2: 'basis-[46%]',
};

const DESKTOP_BASIS: Record<number, string> = {
  2: 'md:basis-[calc(50%-0.5rem)]',
  3: 'md:basis-[calc(33.333%-0.667rem)]',
  4: 'md:basis-[calc(25%-0.75rem)]',
  5: 'md:basis-[calc(20%-0.8rem)]',
};

/** CSS scroll-snap + refs, no extra dependency — a full page (one visible
 * "screen" of cards) per arrow click, so desktop nav feels like paging
 * through columnsDesktop cards at a time instead of nudging by one. Dots
 * reflect the same page count and are clickable. Arrows self-hide at each
 * end instead of disabling, so the row never shows a dead-looking button. */
export function StorefrontProductCarousel({
  items,
  itemKeys,
  columnsDesktop,
  visibleMobile,
  theme,
  showArrows = true,
  showDots = true,
}: StorefrontProductCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activePage, setActivePage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(items.length / columnsDesktop));

  function updateScrollState() {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    const page = Math.round(el.scrollLeft / (el.clientWidth || 1));
    setActivePage(Math.min(page, pageCount - 1));
  }

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => updateScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function scrollToPage(page: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: page * el.clientWidth, behavior: 'smooth' });
  }

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollByPage(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollByPage(-1);
    }
  }

  return (
    <div className="relative">
      {showArrows && canScrollLeft && (
        <button
          type="button"
          aria-label="Ver productos anteriores"
          onClick={() => scrollByPage(-1)}
          className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white p-2 shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 sm:flex"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: theme.text }} />
        </button>
      )}
      {showArrows && canScrollRight && (
        <button
          type="button"
          aria-label="Ver más productos"
          onClick={() => scrollByPage(1)}
          className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white p-2 shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 sm:flex"
        >
          <ChevronRight className="h-5 w-5" style={{ color: theme.text }} />
        </button>
      )}

      <div
        ref={trackRef}
        role="group"
        aria-label="Carrusel de productos"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-1 focus:outline-none"
      >
        {items.map((item, index) => (
          <div
            key={itemKeys[index]}
            className={`shrink-0 snap-start ${MOBILE_BASIS[visibleMobile] ?? MOBILE_BASIS[1]} ${DESKTOP_BASIS[columnsDesktop] ?? DESKTOP_BASIS[4]}`}
          >
            {item}
          </div>
        ))}
      </div>

      {showDots && pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {Array.from({ length: pageCount }).map((_, page) => (
            <button
              key={page}
              type="button"
              aria-label={`Ir a la página ${page + 1} de productos`}
              onClick={() => scrollToPage(page)}
              className="rounded-full transition-all"
              style={{
                width: page === activePage ? '1.25rem' : '0.4rem',
                height: '0.4rem',
                backgroundColor: page === activePage ? theme.primary : theme.border,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
