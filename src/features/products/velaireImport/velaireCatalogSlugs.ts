import { slugify } from '@/utils/slugify';
import type { VelaireCatalogRow } from './velaireImport.types';

/** Rebuilds the exact slug each catalog row got in VelaireImportPage
 * (brand + name, `-2`, `-3`… for repeated names in catalog order) so a
 * row can be matched to the product it created even after the owner
 * renamed it. */
export function buildVelaireCatalogSlugs(catalog: VelaireCatalogRow[]): Map<number, string> {
  const used = new Set<string>();
  const slugs = new Map<number, string>();
  for (const row of catalog) {
    const baseSlug = slugify(`${row.brand} ${row.name}`);
    let slug = baseSlug;
    let suffix = 2;
    while (used.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    used.add(slug);
    slugs.set(row.id, slug);
  }
  return slugs;
}
