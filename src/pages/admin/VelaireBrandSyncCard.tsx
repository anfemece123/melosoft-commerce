import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { productsService } from '@/features/products/productsService';
import { facetsService } from '@/features/facets/facetsService';
import { buildVelaireCatalogSlugs } from '@/features/products/velaireImport/velaireCatalogSlugs';
import {
  BRAND_FACET_SLUG,
  inferBrandFromProductName,
  normalizeVelaireBrand,
  rankVelaireBrands,
} from '@/features/products/velaireImport/velaireBrands';
import { notify } from '@/lib/notifications';
import type { VelaireCatalogRow } from '@/features/products/velaireImport/velaireImport.types';
import type { StoreFacet } from '@/features/facets/facets.types';

interface VelaireBrandSyncCardProps {
  storeId: string;
  catalog: VelaireCatalogRow[];
}

interface SyncSummary {
  updated: number;
  unchanged: number;
  withoutBrand: string[];
  errors: string[];
}

/** Creates the "Marca" filter and assigns each Velaire perfume its house
 * (Lattafa, Armaf, Dior…), so customers can see every perfume of one
 * brand from the catalog filters, the header menu or the product page.
 * Only the brand assignment changes — Género, Concentración, Acordes and
 * any other filter stay as they are. Safe to repeat. */
export function VelaireBrandSyncCard({ storeId, catalog }: VelaireBrandSyncCardProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  async function ensureBrandFacet(): Promise<StoreFacet> {
    const facets = await facetsService.getStoreFacets(storeId);
    const existing = facets.find((facet) => facet.slug === BRAND_FACET_SLUG);
    const brandFacet = existing
      ? await facetsService.updateFacet(existing.id, {
          name: 'Marca',
          inputType: 'single_select',
          showInProductForm: true,
          showInCatalogFilters: true,
          showInMegaMenu: true,
          appliesToAllCategories: true,
          isActive: true,
        })
      : await facetsService.createFacet({
          storeId,
          name: 'Marca',
          slug: BRAND_FACET_SLUG,
          inputType: 'single_select',
          showInProductForm: true,
          showInCatalogFilters: true,
          showInMegaMenu: true,
          appliesToAllCategories: true,
          sortOrder: 0,
        });

    // On creation Marca goes first, keeping the relative order of the other
    // filters. Afterwards the owner's order (Productos → Filtros) is kept.
    if (!existing) {
      const others = facets.sort((a, b) => a.sortOrder - b.sortOrder);
      for (let i = 0; i < others.length; i++) {
        if (others[i].sortOrder !== i + 1) await facetsService.updateFacet(others[i].id, { sortOrder: i + 1 });
      }
    }
    return brandFacet;
  }

  async function runSync() {
    setRunning(true);
    setProgress(0);
    setSummary(null);
    const result: SyncSummary = { updated: 0, unchanged: 0, withoutBrand: [], errors: [] };

    try {
      const brandFacet = await ensureBrandFacet();
      const ranked = rankVelaireBrands(catalog);
      const knownBrands = ranked.map((entry) => entry.brand);

      const valueIdByBrand = new Map<string, string>();
      for (let i = 0; i < ranked.length; i++) {
        const value = await facetsService.findOrCreateFacetValue(storeId, brandFacet.id, ranked[i].brand);
        if (value.sortOrder !== i || !value.isActive) {
          await facetsService.updateFacetValue(value.id, { sortOrder: i, isActive: true });
        }
        valueIdByBrand.set(ranked[i].brand, value.id);
      }
      const allBrandValueIds = new Set(
        (await facetsService.getFacetValues(brandFacet.id)).map((value) => value.id),
      );

      const products = await productsService.getProductsByStore(storeId);
      const productBySlug = new Map(products.map((product) => [product.slug, product]));
      const slugByCatalogId = buildVelaireCatalogSlugs(catalog);

      for (let i = 0; i < catalog.length; i++) {
        const row = catalog[i];
        const label = `${row.brand} ${row.name}`;
        try {
          const product = productBySlug.get(slugByCatalogId.get(row.id) ?? '');
          if (!product) {
            result.errors.push(`${label}: no se encontró el producto`);
          } else {
            const brand = normalizeVelaireBrand(row.brand) ?? inferBrandFromProductName(product.name, knownBrands);
            const targetValueId = brand ? valueIdByBrand.get(brand) : undefined;
            const currentIds = await facetsService.getProductFacetValueIds(product.id);
            const currentBrandIds = currentIds.filter((id) => allBrandValueIds.has(id));

            if (!targetValueId) {
              // Unknown house: a brand the owner assigned by hand is kept.
              if (currentBrandIds.length === 0) result.withoutBrand.push(product.name);
              result.unchanged += 1;
            } else if (currentBrandIds.length === 1 && currentBrandIds[0] === targetValueId) {
              result.unchanged += 1;
            } else {
              const nextIds = [...currentIds.filter((id) => !allBrandValueIds.has(id)), targetValueId];
              await facetsService.setProductFacetValues(product.id, nextIds);
              result.updated += 1;
            }
          }
        } catch (err) {
          result.errors.push(`${label}: ${err instanceof Error ? err.message : 'error desconocido'}`);
        }
        setProgress(i + 1);
      }

      notify.success(`Marcas asignadas: ${result.updated} perfumes actualizados.`);
    } catch (err) {
      notify.fromError(err, 'No se pudieron asignar las marcas.');
    } finally {
      setSummary(result);
      setRunning(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-gray-900">Filtro por marca</h3>
      <p className="mt-1 text-sm text-gray-600">
        Crea el filtro "Marca" y asigna a cada perfume su casa (Lattafa, Armaf, Dior…). Las líneas de una misma casa
        se agrupan (Rave → Lattafa, Paco Rabanne → Rabanne). Aparece primero en los filtros del catálogo y en el menú
        de la tienda (el orden se cambia en Productos → Filtros). Los demás filtros no se tocan. Se puede repetir sin riesgo.
      </p>

      <Button className="mt-4" onClick={() => void runSync()} disabled={running} isLoading={running}>
        {running ? `Asignando… ${progress}/${catalog.length}` : 'Crear / actualizar filtro de marca'}
      </Button>

      {summary && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="success">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Actualizados: {summary.updated}
            </Badge>
            <Badge variant="neutral">Ya estaban bien: {summary.unchanged}</Badge>
            <Badge variant="danger">
              <XCircle className="mr-1 inline h-3.5 w-3.5" /> Errores: {summary.errors.length}
            </Badge>
          </div>
          {summary.withoutBrand.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold">
                Sin marca identificada ({summary.withoutBrand.length}) — asígnala desde la ficha del producto:
              </p>
              <p className="mt-1">{summary.withoutBrand.join(' · ')}</p>
            </div>
          )}
          {summary.errors.length > 0 && (
            <div className="max-h-60 space-y-1 overflow-y-auto text-xs text-gray-600">
              {summary.errors.map((message) => <p key={message}>{message}</p>)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
