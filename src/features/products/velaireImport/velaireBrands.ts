import type { VelaireCatalogRow } from './velaireImport.types';

export { BRAND_FACET_SLUG } from '@/lib/storefront/brandFacet';

/** The supplier PDF names a few houses inconsistently (old/new brand
 * name, sub-lines written as "Line / House"). Customers browse by the
 * house, so every spelling of one house maps to a single filter value. */
const BRAND_ALIASES: Record<string, string> = {
  'Rave / Lattafa': 'Lattafa',
  'Paco Rabanne': 'Rabanne',
  'Orientica Premium': 'Orientica',
  'Paris Corner / Emir': 'Paris Corner',
  'Hinode / HND': 'Hinode',
};

/** Placeholder the catalog uses when the PDF didn't identify the house. */
const UNKNOWN_BRAND = 'Por confirmar';

/** Canonical brand for a catalog row, or null when the catalog doesn't
 * know it. A null brand is never guessed from the perfume name alone. */
export function normalizeVelaireBrand(brand: string): string | null {
  const trimmed = brand.trim();
  if (!trimmed || trimmed === UNKNOWN_BRAND) return null;
  return BRAND_ALIASES[trimmed] ?? trimmed;
}

/** Every canonical brand with how many catalog references it has, most
 * references first (then A→Z). That order becomes the filter's value
 * order, so the header menu and the collapsed filter list show the
 * houses with the most perfumes first. */
export function rankVelaireBrands(catalog: VelaireCatalogRow[]): { brand: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of catalog) {
    const brand = normalizeVelaireBrand(row.brand);
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  return Array.from(counts, ([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, 'es'));
}

/** Resolves the brand for a catalog row whose house the PDF didn't name,
 * using the product's current name in the store: if the owner already
 * renamed it to start with a known brand ("Emper Haya Crush"), that
 * brand is used. Otherwise null — it stays out of the brand filter. */
export function inferBrandFromProductName(productName: string, knownBrands: string[]): string | null {
  const name = productName.trim().toLowerCase();
  const match = [...knownBrands]
    .sort((a, b) => b.length - a.length)
    .find((brand) => name === brand.toLowerCase() || name.startsWith(`${brand.toLowerCase()} `));
  return match ?? null;
}
