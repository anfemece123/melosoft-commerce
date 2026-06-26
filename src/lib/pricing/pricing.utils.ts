export function hasActiveDiscount(
  regularPrice: number,
  salePrice: number | null | undefined
): salePrice is number {
  return (
    salePrice !== null &&
    salePrice !== undefined &&
    salePrice >= 0 &&
    salePrice < regularPrice
  );
}

export function getActivePrice(
  regularPrice: number,
  salePrice: number | null | undefined
): number {
  return hasActiveDiscount(regularPrice, salePrice) ? salePrice : regularPrice;
}

export function calculateDiscountPercentage(regularPrice: number, salePrice: number): number {
  if (regularPrice <= 0) return 0;
  return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
}

export function calculateDiscountAmount(regularPrice: number, salePrice: number): number {
  return regularPrice - salePrice;
}

export function calculateSalePriceFromPercentage(
  regularPrice: number,
  percentage: number
): number {
  return Math.round(regularPrice * (1 - percentage / 100));
}

export function calculateSalePriceFromFixedAmount(
  regularPrice: number,
  fixedAmount: number
): number {
  return regularPrice - fixedAmount;
}
