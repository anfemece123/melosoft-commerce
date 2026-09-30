import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { CheckCircle2, Loader2, SkipForward, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { productsService } from '@/features/products/productsService';
import { slugify } from '@/utils/slugify';
import { notify } from '@/lib/notifications';
import type { VelaireCatalogRow } from '@/features/products/velaireImport/velaireImport.types';

type UploadStatus = 'uploaded' | 'skipped' | 'error';

interface UploadResult {
  label: string;
  status: UploadStatus;
  message?: string;
}

interface VelaireImageUploadCardProps {
  storeId: string;
  catalog: VelaireCatalogRow[];
}

/** Rebuilds the exact slug each catalog row got in VelaireImportPage
 * (brand + name, `-2`, `-3`… for repeated names in catalog order) so a
 * photo can be matched to the product it belongs to even after the
 * owner renamed it. */
function buildCatalogSlugs(catalog: VelaireCatalogRow[]): Map<number, string> {
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

/** Uploads the bottle photos extracted from Velaire's PDF catalog. Files
 * are named `{catalogId}-{slug}.webp` (e.g. `001-dolce-gabbana-light-blue.webp`),
 * already 1200×1200 WebP. A product that already has any image is left
 * untouched, so the owner's own photos are never replaced and the run
 * is safe to repeat. */
export function VelaireImageUploadCard({ storeId, catalog }: VelaireImageUploadCardProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []).filter((file) => /^\d+-.*\.webp$/i.test(file.name)));
    setResults([]);
    setProgress(0);
  }

  async function runUpload() {
    setRunning(true);
    setResults([]);
    setProgress(0);
    const collected: UploadResult[] = [];

    try {
      const catalogById = new Map(catalog.map((row) => [row.id, row]));
      const slugByCatalogId = buildCatalogSlugs(catalog);
      const products = await productsService.getProductsByStore(storeId);
      const productBySlug = new Map(products.map((product) => [product.slug, product]));
      const existingImages = await productsService.getProductImagesByStore(storeId);
      const productIdsWithImages = new Set(existingImages.map((image) => image.productId));

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const catalogId = Number(file.name.split('-')[0]);
        const row = catalogById.get(catalogId);
        const label = row ? `${row.brand} ${row.name}` : file.name;

        try {
          const slug = slugByCatalogId.get(catalogId);
          const product = slug ? productBySlug.get(slug) : undefined;
          if (!row || !product) {
            collected.push({ label, status: 'error', message: 'No se encontró el producto en Velaire' });
          } else if (product.mainImageUrl || productIdsWithImages.has(product.id)) {
            collected.push({ label, status: 'skipped', message: 'Ya tiene imagen' });
          } else {
            const image = await productsService.uploadProductImage(storeId, product.id, file, 0, true);
            await productsService.reorderProductImages(product.id, [image.id]);
            collected.push({ label, status: 'uploaded' });
          }
        } catch (err) {
          collected.push({ label, status: 'error', message: err instanceof Error ? err.message : 'Error desconocido' });
        }

        setProgress(i + 1);
        setResults([...collected]);
      }

      notify.success('Carga de imágenes de Velaire terminada.');
    } catch (err) {
      notify.fromError(err, 'No se pudo completar la carga de imágenes.');
    } finally {
      setRunning(false);
    }
  }

  const uploadedCount = results.filter((r) => r.status === 'uploaded').length;
  const skippedCount = results.filter((r) => r.status === 'skipped').length;
  const errorRows = results.filter((r) => r.status === 'error');

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-gray-900">Fotos del catálogo</h3>
      <p className="mt-1 text-sm text-gray-600">
        Selecciona todas las imágenes de la carpeta <strong>velaire-imagenes</strong> (1200×1200, extraídas del PDF).
        Cada una se asigna como imagen principal de su producto. Los productos que ya tienen foto no se tocan.
      </p>

      <input
        type="file"
        accept="image/webp"
        multiple
        onChange={handleFilesChange}
        disabled={running}
        className="mt-4 block text-sm"
      />

      <Button
        className="mt-4"
        onClick={() => void runUpload()}
        disabled={files.length === 0 || running}
        isLoading={running}
      >
        {running ? `Subiendo… ${progress}/${files.length}` : `Subir ${files.length} imágenes`}
      </Button>

      {results.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="success">
              <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Subidas: {uploadedCount}
            </Badge>
            <Badge variant="neutral">
              <SkipForward className="mr-1 inline h-3.5 w-3.5" /> Ya tenían foto: {skippedCount}
            </Badge>
            <Badge variant="danger">
              <XCircle className="mr-1 inline h-3.5 w-3.5" /> Errores: {errorRows.length}
            </Badge>
            {running && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />}
          </div>

          {errorRows.length > 0 && (
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {errorRows.map((r, index) => (
                <div key={`${r.label}-${index}`} className="rounded-md border border-gray-200 px-3 py-2 text-xs">
                  <span className="font-medium text-gray-800">{r.label}</span>
                  <span className="ml-1.5 text-gray-500">— {r.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
