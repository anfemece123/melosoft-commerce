import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StorefrontRatingStars } from './StorefrontRatingStars';
import { buildStorefrontTheme } from './storefrontTheme';

const theme = buildStorefrontTheme({});

describe('StorefrontRatingStars', () => {
  it('never invents a rating when a product has no verified reviews', () => {
    render(<StorefrontRatingStars theme={theme} rating={0} count={0} />);
    expect(screen.getByText('Sin reseñas')).not.toBeNull();
    expect(screen.queryByText(/5\.0/)).toBeNull();
  });

  it('shows the real fractional aggregate and count', () => {
    render(<StorefrontRatingStars theme={theme} rating={4.37} count={18} />);
    expect(screen.getByText('4.4 (18)')).not.toBeNull();
  });
});
