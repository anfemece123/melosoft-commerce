import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { StorefrontTheme } from '../storefrontTheme';

interface StorefrontCategoryCoverCarouselProps {
  items: ReactNode[];
  itemKeys: string[];
  theme: StorefrontTheme;
}

/** Horizontal category-cover rail used when the section has more cards than
 * fit comfortably in a responsive grid. It keeps the first card prominent on
 * mobile while still exposing a clear next-card affordance. */
export function StorefrontCategoryCoverCarousel({
  items,
  itemKeys,
  theme,
}: StorefrontCategoryCoverCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activePage, setActivePage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(items.length / 4));

  function updateScrollState() {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollLeft(track.scrollLeft > 4);
    setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
    setActivePage(Math.min(Math.round(track.scrollLeft / (track.clientWidth || 1)), pageCount - 1));
  }

  useEffect(() => {
    updateScrollState();
    const track = trackRef.current;
    if (!track) return;
    const handleScroll = () => updateScrollState();
    track.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      track.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
    // The track is stable; item count is the only value that changes its
    // scroll geometry in this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' });
  }

  function scrollToPage(page: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: page * track.clientWidth, behavior: 'smooth' });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Ver categorías anteriores"
          onClick={() => scrollByPage(-1)}
          className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white p-2.5 shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 sm:flex"
        >
          <ChevronLeft className="h-5 w-5" style={{ color: theme.text }} />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          aria-label="Ver más categorías"
          onClick={() => scrollByPage(1)}
          className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white p-2.5 shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 sm:flex"
        >
          <ChevronRight className="h-5 w-5" style={{ color: theme.text }} />
        </button>
      )}

      <div
        ref={trackRef}
        role="group"
        aria-label="Categorías con portada"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-1 focus:outline-none sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {items.map((item, index) => (
          <div
            key={itemKeys[index]}
            className="w-[86%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.75rem)]"
          >
            {item}
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {Array.from({ length: pageCount }).map((_, page) => (
            <button
              key={page}
              type="button"
              aria-label={`Ir a la página ${page + 1} de categorías`}
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
