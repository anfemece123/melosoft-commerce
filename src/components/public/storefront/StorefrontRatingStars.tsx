import { Star } from 'lucide-react';
import type { StorefrontTheme } from './storefrontTheme';

interface StorefrontRatingStarsProps {
  theme: StorefrontTheme;
  rating: number;
  count: number;
  showEmpty?: boolean;
  size?: 'sm' | 'md';
}

export function StorefrontRatingStars({
  theme,
  rating,
  count,
  showEmpty = true,
  size = 'sm',
}: StorefrontRatingStarsProps) {
  const normalized = Math.max(0, Math.min(5, rating));

  if (count <= 0) {
    return showEmpty ? <span className="text-[11px]" style={{ color: theme.mutedText }}>Sin reseñas</span> : null;
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, index) => {
          const fill = Math.max(0, Math.min(1, normalized - index));
          const starClass = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
          return (
            <span key={index} className={`relative block ${starClass}`}>
              <Star className={`absolute inset-0 ${starClass}`} style={{ color: theme.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.16)' }} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`absolute inset-0 fill-amber-400 text-amber-400 ${starClass}`} />
              </span>
            </span>
          );
        })}
      </div>
      <span className="text-[11px]" style={{ color: theme.mutedText }}>
        {normalized.toFixed(1)} ({count})
      </span>
    </div>
  );
}
