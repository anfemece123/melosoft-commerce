import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { productsService } from '@/features/products/productsService';
import { facetsService } from '@/features/facets/facetsService';
import { buildVelaireCatalogSlugs } from '@/features/products/velaireImport/velaireCatalogSlugs';
import { FRAGRANCE_NOTE_FIELDS } from '@/lib/storefront/fragrancePyramid';
import { notify } from '@/lib/notifications';
import type { VelaireCatalogRow } from '@/features/products/velaireImport/velaireImport.types';
import type { ProductDescriptionSection } from '@/types/common.types';

interface VelaireProductRepairCardProps {
  storeId: string;
  catalog: VelaireCatalogRow[];
}

interface RepairSummary {
  repaired: string[];
  complete: number;
  errors: string[];
}

function buildNoteSections(row: VelaireCatalogRow): ProductDescriptionSection[] {
  const contents = [row.topNotes, row.heartNotes, row.baseNotes];
  return FRAGRANCE_NOTE_FIELDS.map((field, index) => ({
    id: crypto.randomUUID(),
    title: field.title,
    icon: field.icon,
    content: contents[index],
    sortOrder: index,
    isVisible: true,
  }));
}

/** A product counts as incomplete when it has no fragrance pyramid —
 * that is what products created by hand before the bulk import (e.g.
 * Dolce & Gabbana Light Blue) lack, together with the short description
 * and the Concentración / Acordes filters. */
function isIncomplete(sections: ProductDescriptionSection[]): boolean {
  return !sections.some((section) => FRAGRANCE_NOTE_FIELDS.some((field) => field.title === section.title));
}

/** Completes, from the reviewed catalog, the perfumes whose ficha doesn't
 * match the rest: name, description, short description, fragrance
 * pyramid and the Concentración / Acordes filters. Price, photos, stock,
 * status and every other filter are left exactly as they are, and
 * complete products are never touched. Safe to repeat. */
export function VelaireProductRepairCard({ storeId, catalog }: VelaireProductRepairCardProps) {
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<RepairSummary | null>(null);

  async function runRepair() {
    setRunning(true);
    setSummary(null);
    const result: RepairSummary = { repaired: [], complete: 0, errors: [] };

    try {
      const facets = await facetsService.getStoreFacets(storeId);
      const concentracionFacet = facets.find((facet) => facet.slug === 'concentracion') ?? null;
      const acordesFacet = facets.find((facet) => facet.slug === 'acordes') ?? null;

      const products = await productsService.getProductsByStore(storeId);
      const productBySlug = new Map(products.map((product) => [product.slug, product]));
      const slugByCatalogId = buildVelaireCatalogSlugs(catalog);

      for (const row of catalog) {
        const product = productBySlug.get(slugByCatalogId.get(row.id) ?? '');
        if (!product) continue;
        if (!isIncomplete(product.descriptionSections)) {
          result.complete += 1;
          continue;
        }

        const label = `${row.brand} ${row.name}`;
        try {
          await productsService.updateProduct(product.id, {
            name: label,
            description: row.description,
            shortDescription: row.shortDescription || null,
            // Notes first, then any section the owner added by hand.
            descriptionSections: [
              ...buildNoteSections(row),
              ...product.descriptionSections.map((section, index) => ({ ...section, sortOrder: 3 + index })),
            ],
          });

          const wantedValueIds: string[] = [];
          if (concentracionFacet && row.concentration) {
            wantedValueIds.push((await facetsService.findOrCreateFacetValue(storeId, concentracionFacet.id, row.concentration)).id);
          }
          if (acordesFacet) {
            for (const accord of row.accords) {
              wantedValueIds.push((await facetsService.findOrCreateFacetValue(storeId, acordesFacet.id, accord)).id);
            }
          }
          const currentIds = await facetsService.getProductFacetValueIds(product.id);
          const missingIds = wantedValueIds.filter((id) => !currentIds.includes(id));
          if (missingIds.length > 0) {
            await facetsService.setProductFacetValues(product.id, [...currentIds, ...missingIds]);
          }

          result.repaired.push(label);
        } catch (err) {
          result.errors.push(`${label}: ${err instanceof Error ? err.message : 'error desconocido'}`);
        }
      }

      notify.success(
        result.repaired.length > 0
          ? `Fichas completadas: ${result.repaired.join(', ')}.`
          : 'Todas las fichas ya estaban completas.',
      );
    } catch (err) {
      notify.fromError(err, 'No se pudieron completar las fichas.');
    } finally {
      setSummary(result);
      setRunning(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-gray-900">Completar fichas incompletas</h3>
      <p className="mt-1 text-sm text-gray-600">
        Iguala a los demás los perfumes creados a mano antes de la carga masiva (p. ej. Dolce &amp; Gabbana Light
        Blue): nombre, descripción, descripción corta, pirámide olfativa, concentración y acordes. No cambia precio,
        fotos, stock ni estado, y no toca las fichas que ya están completas.
      </p>

      <Button className="mt-4" onClick={() => void runRepair()} disabled={running} isLoading={running}>
        {running ? 'Revisando fichas…' : 'Completar fichas'}
      </Button>

      {summary && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="success">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Completadas: {summary.repaired.length}
            </Badge>
            <Badge variant="neutral">Ya estaban completas: {summary.complete}</Badge>
            <Badge variant="danger">
              <XCircle className="mr-1 inline h-3.5 w-3.5" /> Errores: {summary.errors.length}
            </Badge>
          </div>
          {summary.repaired.length > 0 && (
            <p className="text-xs text-gray-600">{summary.repaired.join(' · ')}</p>
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
