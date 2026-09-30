import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { productsService } from '@/features/products/productsService';
import { facetsService } from '@/features/facets/facetsService';
import { buildVelaireCatalogSlugs } from '@/features/products/velaireImport/velaireCatalogSlugs';
import { notify } from '@/lib/notifications';
import type { VelaireCatalogRow } from '@/features/products/velaireImport/velaireImport.types';

/** Only these three values remain in the "Género" filter. */
const GENDER_VALUES = ['Mujer', 'Hombre', 'Unisex'] as const;

interface VelaireGenderSyncCardProps {
  storeId: string;
  catalog: VelaireCatalogRow[];
}

interface SyncSummary {
  updated: number;
  unchanged: number;
  errors: string[];
}

/** Aligns every Velaire product's "Género" with the reviewed catalog.
 * Only the gender assignment changes — Concentración, Acordes and any
 * other filter the owner set stay exactly as they are. Any extra gender
 * value (e.g. the old "Mujer / Niña") is deactivated afterwards so the
 * public filter shows just Mujer / Hombre / Unisex. Safe to repeat. */
export function VelaireGenderSyncCard({ storeId, catalog }: VelaireGenderSyncCardProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  async function runSync() {
    setRunning(true);
    setProgress(0);
    setSummary(null);
    const result: SyncSummary = { updated: 0, unchanged: 0, errors: [] };

    try {
      const facets = await facetsService.getStoreFacets(storeId);
      const generoFacet = facets.find((facet) => facet.slug === 'genero');
      if (!generoFacet) throw new Error('La tienda no tiene el filtro "Género".');

      const valueIdByGender = new Map<string, string>();
      for (const gender of GENDER_VALUES) {
        const value = await facetsService.findOrCreateFacetValue(storeId, generoFacet.id, gender);
        valueIdByGender.set(gender, value.id);
      }
      const allGenderValueIds = new Set(
        (await facetsService.getFacetValues(generoFacet.id)).map((value) => value.id),
      );

      const products = await productsService.getProductsByStore(storeId);
      const productBySlug = new Map(products.map((product) => [product.slug, product]));
      const slugByCatalogId = buildVelaireCatalogSlugs(catalog);

      for (let i = 0; i < catalog.length; i++) {
        const row = catalog[i];
        const label = `${row.brand} ${row.name}`;
        try {
          const product = productBySlug.get(slugByCatalogId.get(row.id) ?? '');
          const targetValueId = valueIdByGender.get(row.gender);
          if (!product) {
            result.errors.push(`${label}: no se encontró el producto`);
          } else if (!targetValueId) {
            result.errors.push(`${label}: género "${row.gender}" no reconocido`);
          } else {
            const currentIds = await facetsService.getProductFacetValueIds(product.id);
            const currentGenderIds = currentIds.filter((id) => allGenderValueIds.has(id));
            if (currentGenderIds.length === 1 && currentGenderIds[0] === targetValueId) {
              result.unchanged += 1;
            } else {
              const nextIds = [...currentIds.filter((id) => !allGenderValueIds.has(id)), targetValueId];
              await facetsService.setProductFacetValues(product.id, nextIds);
              result.updated += 1;
            }
          }
        } catch (err) {
          result.errors.push(`${label}: ${err instanceof Error ? err.message : 'error desconocido'}`);
        }
        setProgress(i + 1);
      }

      const keepIds = new Set(valueIdByGender.values());
      for (const value of await facetsService.getFacetValues(generoFacet.id)) {
        if (!keepIds.has(value.id) && value.isActive) {
          await facetsService.updateFacetValue(value.id, { isActive: false });
        }
      }

      notify.success(`Géneros revisados: ${result.updated} corregidos.`);
    } catch (err) {
      notify.fromError(err, 'No se pudieron corregir los géneros.');
    } finally {
      setSummary(result);
      setRunning(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-gray-900">Corregir géneros</h3>
      <p className="mt-1 text-sm text-gray-600">
        Asigna a cada perfume su género revisado (Mujer, Hombre o Unisex). Solo cambia el género; los demás filtros
        no se tocan. Se puede repetir sin riesgo.
      </p>

      <Button className="mt-4" onClick={() => void runSync()} disabled={running} isLoading={running}>
        {running ? `Revisando… ${progress}/${catalog.length}` : 'Corregir géneros'}
      </Button>

      {summary && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="success">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Corregidos: {summary.updated}
            </Badge>
            <Badge variant="neutral">Ya estaban bien: {summary.unchanged}</Badge>
            <Badge variant="danger">
              <XCircle className="mr-1 inline h-3.5 w-3.5" /> Errores: {summary.errors.length}
            </Badge>
          </div>
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
