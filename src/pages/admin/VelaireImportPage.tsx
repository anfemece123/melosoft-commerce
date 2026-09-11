import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, SkipForward, XCircle } from 'lucide-react';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentStore } from '@/features/stores/stores.selectors';
import { storesService } from '@/features/stores/storesService';
import { categoriesService } from '@/features/categories/categoriesService';
import { productsService } from '@/features/products/productsService';
import { facetsService } from '@/features/facets/facetsService';
import { slugify } from '@/utils/slugify';
import { FRAGRANCE_NOTE_FIELDS } from '@/lib/storefront/fragrancePyramid';
import { notify } from '@/lib/notifications';
import type { ImportRowResult, VelaireCatalogRow } from '@/features/products/velaireImport/velaireImport.types';
import type { ProductDescriptionSection } from '@/types/common.types';

// Dynamically imported (not a static top-level import) — this JSON is
// ~380KB and AppRouter has no route-level code-splitting, so a static
// import here would ship the full Velaire catalog to every visitor of
// the app, storefront customers included.
async function loadCatalog(): Promise<VelaireCatalogRow[]> {
  const mod = await import('@/features/products/velaireImport/velaireCatalog.json');
  return mod.default as VelaireCatalogRow[];
}

const TARGET_STORE_SLUG = 'velaire';
const MIN_PRODUCT_LIMIT = 350;

/** One-time bulk-import tool for Velaire's 294-reference perfume catalog
 * (extracted from their supplier PDF, see the Excel they provided). Not a
 * generic "upload any spreadsheet" feature — the parsed data ships as a
 * bundled JSON file and this page only ever targets the store whose slug
 * is 'velaire', as a safety rail against running it against another
 * store by mistake via a stale/shared link.
 *
 * Everything is created as status: 'draft' — the source sheet has no
 * price, stock or photos for any reference, so nothing should go live
 * automatically. The store owner completes and publishes each product
 * at their own pace from the normal Products screen.
 *
 * Safe to re-run: products are de-duplicated by slug against what
 * already existed before the run started, so a run interrupted partway
 * can just be started again. */
export function VelaireImportPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const store = useAppSelector(selectCurrentStore);
  const [catalog, setCatalog] = useState<VelaireCatalogRow[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<ImportRowResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadCatalog().then((rows) => {
      if (cancelled) return;
      setCatalog(rows);
      setResults(rows.map((row) => ({ row, status: 'pending' })));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const wrongStore = Boolean(store && store.slug !== TARGET_STORE_SLUG);
  const processedCount = results.filter((r) => r.status !== 'pending' && r.status !== 'creating').length;
  const createdCount = results.filter((r) => r.status === 'created').length;
  const skippedCount = results.filter((r) => r.status === 'skipped').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const attentionRows = results.filter((r) =>
    r.status === 'error' || r.status === 'skipped' || (r.status === 'created' && r.row.needsReview)
  );

  function updateRow(index: number, patch: Partial<ImportRowResult>) {
    setResults((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function runImport() {
    if (!storeId || !store || !catalog) return;
    setRunning(true);
    setFinished(false);
    setResults(catalog.map((row) => ({ row, status: 'pending' })));

    try {
      const limits = await storesService.getStoreLimits(storeId);
      if (limits && limits.maxProducts < MIN_PRODUCT_LIMIT) {
        try {
          await storesService.updateStoreLimits(storeId, { maxProducts: MIN_PRODUCT_LIMIT });
        } catch {
          // store_limits can only be updated by platform_admin (RLS) — a
          // store owner/admin can read it but not raise it. Surface a
          // clear cause instead of the raw 406 from the blocked UPDATE.
          throw new Error(
            `El límite de productos de Velaire es ${limits.maxProducts} y hacen falta al menos ${MIN_PRODUCT_LIMIT}. ` +
            'Solo un platform_admin puede subirlo (Planes / límites de la tienda) — pídele que lo haga antes de reintentar.'
          );
        }
      }

      const categories = await categoriesService.getStoreCategories(storeId);
      const category = categories.find((c) => c.slug === 'perfumeria') ?? categories[0] ?? null;

      const facets = await facetsService.getStoreFacets(storeId);
      const generoFacet = facets.find((f) => f.slug === 'genero') ?? null;
      const concentracionFacet = facets.find((f) => f.slug === 'concentracion')
        ?? await facetsService.createFacet({
          storeId,
          name: 'Concentración',
          slug: 'concentracion',
          inputType: 'single_select',
          showInProductForm: true,
          showInCatalogFilters: true,
          showInMegaMenu: false,
          appliesToAllCategories: true,
          sortOrder: facets.length,
        });
      const acordesFacet = facets.find((f) => f.slug === 'acordes')
        ?? await facetsService.createFacet({
          storeId,
          name: 'Acordes',
          slug: 'acordes',
          inputType: 'multi_select',
          showInProductForm: true,
          showInCatalogFilters: true,
          showInMegaMenu: true,
          appliesToAllCategories: true,
          sortOrder: facets.length + 1,
        });

      const genderValueId = new Map<string, string>();
      const concentrationValueId = new Map<string, string>();
      const accordValueId = new Map<string, string>();

      if (generoFacet) {
        for (const g of new Set(catalog.map((r) => r.gender))) {
          const v = await facetsService.findOrCreateFacetValue(storeId, generoFacet.id, g);
          genderValueId.set(g, v.id);
        }
      }
      for (const c of new Set(catalog.map((r) => r.concentration).filter((x): x is string => Boolean(x)))) {
        const v = await facetsService.findOrCreateFacetValue(storeId, concentracionFacet.id, c);
        concentrationValueId.set(c, v.id);
      }
      for (const a of new Set(catalog.flatMap((r) => r.accords))) {
        const v = await facetsService.findOrCreateFacetValue(storeId, acordesFacet.id, a);
        accordValueId.set(a, v.id);
      }

      const existingProducts = await productsService.getProductsByStore(storeId);
      const preExistingSlugs = new Set(existingProducts.map((p) => p.slug));
      const slugsThisRun = new Set<string>();

      for (let i = 0; i < catalog.length; i++) {
        const rowData = catalog[i];
        updateRow(i, { status: 'creating' });

        try {
          const baseSlug = slugify(`${rowData.brand} ${rowData.name}`);

          if (preExistingSlugs.has(baseSlug)) {
            updateRow(i, { status: 'skipped', message: 'Ya existe un producto con este nombre en Velaire' });
            continue;
          }

          let slug = baseSlug;
          let suffix = 2;
          while (slugsThisRun.has(slug)) {
            slug = `${baseSlug}-${suffix}`;
            suffix += 1;
          }
          slugsThisRun.add(slug);

          const descriptionSections: ProductDescriptionSection[] = [
            {
              id: crypto.randomUUID(),
              title: FRAGRANCE_NOTE_FIELDS[0].title,
              icon: FRAGRANCE_NOTE_FIELDS[0].icon,
              content: rowData.topNotes,
              sortOrder: 0,
              isVisible: true,
            },
            {
              id: crypto.randomUUID(),
              title: FRAGRANCE_NOTE_FIELDS[1].title,
              icon: FRAGRANCE_NOTE_FIELDS[1].icon,
              content: rowData.heartNotes,
              sortOrder: 1,
              isVisible: true,
            },
            {
              id: crypto.randomUUID(),
              title: FRAGRANCE_NOTE_FIELDS[2].title,
              icon: FRAGRANCE_NOTE_FIELDS[2].icon,
              content: rowData.baseNotes,
              sortOrder: 2,
              isVisible: true,
            },
          ];
          if (rowData.needsReview || rowData.reviewNote) {
            descriptionSections.push({
              id: crypto.randomUUID(),
              title: 'Por confirmar',
              icon: 'alertCircle',
              content: [rowData.verificationStatus, rowData.reviewNote].filter(Boolean).join(' — '),
              sortOrder: 3,
              isVisible: true,
            });
          }

          const created = await productsService.createProduct({
            storeId,
            productType: 'physical_product',
            name: `${rowData.brand} ${rowData.name}`,
            slug,
            description: rowData.description,
            shortDescription: rowData.shortDescription || null,
            category: category?.name ?? null,
            categoryId: category?.id ?? null,
            regularPrice: 0,
            salePrice: null,
            compareAtPrice: null,
            costPrice: null,
            cartaPrice: null,
            showInCarta: false,
            showInEcommerce: true,
            sku: null,
            trackInventory: true,
            isFeatured: false,
            isAvailable: true,
            preparationTimeMinutes: null,
            allowsSpecialInstructions: false,
            specialInstructionsLabel: null,
            specialInstructionsPlaceholder: null,
            specialInstructionsMaxLength: 180,
            sortOrder: 0,
            status: 'draft',
            mainImageUrl: null,
            descriptionSections,
            hasVariants: false,
            showVariantsAsCards: false,
            sizeChartId: null,
            stock: 0,
          });

          const facetValueIds: string[] = [];
          const genderId = genderValueId.get(rowData.gender);
          if (genderId) facetValueIds.push(genderId);
          if (rowData.concentration) {
            const concId = concentrationValueId.get(rowData.concentration);
            if (concId) facetValueIds.push(concId);
          }
          for (const accord of rowData.accords) {
            const accordId = accordValueId.get(accord);
            if (accordId) facetValueIds.push(accordId);
          }
          if (facetValueIds.length > 0) {
            await facetsService.setProductFacetValues(created.id, facetValueIds);
          }

          updateRow(i, {
            status: 'created',
            message: rowData.needsReview ? 'Borrador creado — confirmar identidad antes de publicar' : undefined,
          });
        } catch (err) {
          updateRow(i, { status: 'error', message: err instanceof Error ? err.message : 'Error desconocido' });
        }
      }

      notify.success('Importación de Velaire terminada.');
    } catch (err) {
      notify.fromError(err, 'No se pudo completar la importación.');
    } finally {
      setRunning(false);
      setFinished(true);
    }
  }

  return (
    <AdminPanelShell
      top={(
        <PageHeader
          title="Carga masiva — Catálogo Velaire"
          description="Crea en borrador los 294 perfumes del catálogo extraído del PDF de proveedor. Precio, stock y fotos se completan producto por producto después."
          sticky={false}
          className="mb-4"
        />
      )}
    >
      <div className="space-y-6 pb-10">
        {wrongStore && (
          <Card className="border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2.5 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Esta herramienta es específica para la tienda Velaire.</p>
                <p className="mt-1">
                  Estás viendo la tienda "{store?.name}". Abre esta página desde la tienda Velaire para continuar.
                </p>
              </div>
            </div>
          </Card>
        )}

        {!wrongStore && !catalog && (
          <Card className="p-5 text-sm text-gray-500">Cargando catálogo…</Card>
        )}

        {!wrongStore && catalog && (
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900">Qué va a pasar</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
              <li>• {catalog.length} productos nuevos, todos como <strong>Borrador</strong> (no visibles en la tienda pública).</li>
              <li>• Precio $0 y stock 0 en todos — hay que completarlos manualmente antes de publicar cada uno.</li>
              <li>• Categoría "Perfumeria", filtros Género / Concentración / Acordes asignados automáticamente.</li>
              <li>• Pirámide olfativa (notas de salida, corazón y fondo) ya cargada en cada producto.</li>
              <li>• {catalog.filter((r) => r.needsReview).length} quedan marcados "Por confirmar" — el PDF no identifica la referencia exacta con certeza.</li>
              <li>• El límite de productos de la tienda se sube a {MIN_PRODUCT_LIMIT} si hace falta.</li>
              <li>• Si un producto con el mismo nombre ya existe en Velaire, esa fila se omite (no duplica).</li>
            </ul>

            <label className="mt-4 flex items-start gap-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={running}
                className="mt-0.5"
              />
              Entiendo que esto crea {catalog.length} productos en borrador en Velaire.
            </label>

            <Button
              className="mt-4"
              onClick={() => void runImport()}
              disabled={!confirmed || running}
              isLoading={running}
            >
              {running ? `Importando… ${processedCount}/${catalog.length}` : 'Iniciar importación'}
            </Button>
          </Card>
        )}

        {(running || finished) && (
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Creados: {createdCount}
              </Badge>
              <Badge variant="neutral">
                <SkipForward className="mr-1 inline h-3.5 w-3.5" /> Omitidos: {skippedCount}
              </Badge>
              <Badge variant="danger">
                <XCircle className="mr-1 inline h-3.5 w-3.5" /> Errores: {errorCount}
              </Badge>
              {running && (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {processedCount}/{catalog?.length ?? 0}
                </span>
              )}
            </div>

            {attentionRows.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900">Revisar ({attentionRows.length})</h4>
                <div className="mt-2 max-h-96 space-y-1.5 overflow-y-auto pr-1">
                  {attentionRows.map((r) => (
                    <div
                      key={r.row.id}
                      className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs"
                    >
                      {r.status === 'error' && <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                      {r.status === 'skipped' && <SkipForward className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />}
                      {r.status === 'created' && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />}
                      <div>
                        <span className="font-medium text-gray-800">{r.row.brand} {r.row.name}</span>
                        {r.message && <span className="ml-1.5 text-gray-500">— {r.message}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </AdminPanelShell>
  );
}
