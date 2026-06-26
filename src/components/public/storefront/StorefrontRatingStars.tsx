import { Star } from 'lucide-react';
import type { StorefrontTheme } from './storefrontTheme';

interface StorefrontRatingStarsProps {
  theme: StorefrontTheme;
  rating?: number;
  count?: number;
}

export function StorefrontRatingStars({
  theme,
  rating = 5,
  count = 0,
}: StorefrontRatingStarsProps) {
  const normalized = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className="h-3 w-3"
            style={{
              color: index < normalized ? '#fbbf24' : theme.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.16)',
              fill: index < normalized ? '#fbbf24' : 'transparent',
            }}
          />
        ))}
      </div>
      <span className="text-[11px]" style={{ color: theme.mutedText }}>
        ({count})
      </span>
    </div>
  );
}
