import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ImageIcon, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ImageCropDialog } from './ImageCropDialog';
import { productsService } from '@/features/products/productsService';
import type { ProductImageCandidatePage } from '@/features/products/products.types';
import {
  disposeLoadedImageFile,
  getImageAssetPreset,
  validateImageFile,
  type LoadedImageFile,
} from '@/lib/images/imageFile.utils';

const PAGE_SIZE = 16;

interface ProductImagePickerDialogProps {
  storeId: string;
  categoryIds: string[];
  categoryNameById: Record<string, string>;
  categoryName: string;
  onClose: () => void;
  onSelect: (file: File) => void;
}

const EMPTY_PAGE: ProductImageCandidatePage = { items: [], total: 0 };

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/avif') return 'avif';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export function ProductImagePickerDialog({
  storeId,
  categoryIds,
  categoryNameById,
  categoryName,
  onClose,
  onSelect,
}: ProductImagePickerDialogProps) {
  const [page, setPage] = useState(0);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);
  const [result, setResult] = useState<ProductImageCandidatePage>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preparingProductId, setPreparingProductId] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<LoadedImageFile | null>(null);
  const cropSourceRef = useRef<LoadedImageFile | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const categoryIdsKey = Array.from(new Set(categoryIds)).sort().join(',');

  useEffect(() => {
    let cancelled = false;
    void productsService.getCategoryImageCandidates(
      storeId,
      categoryIdsKey ? categoryIdsKey.split(',') : [],
      { page, pageSize: PAGE_SIZE, search: searchTerm },
    )
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las imágenes.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [categoryIdsKey, page, requestVersion, searchTerm, storeId]);

  useEffect(() => () => disposeLoadedImageFile(cropSource), [cropSource]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (cropSourceRef.current) return;
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  function runSearch() {
    setError(null);
    setLoading(true);
    setPage(0);
    setSearchTerm(searchDraft.trim());
  }

  function changePage(nextPage: number) {
    setError(null);
    setLoading(true);
    setPage(nextPage);
  }

  function retry() {
    setError(null);
    setLoading(true);
    setRequestVersion((value) => value + 1);
  }

  async function prepareImage(productId: string, productName: string, imageUrl: string) {
    setPreparingProductId(productId);
    setError(null);
    try {
      const response = await fetch(imageUrl, { credentials: 'omit' });
      if (!response.ok) throw new Error('No se pudo descargar esta imagen.');
      const blob = await response.blob();
      const mimeType = blob.type || response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
      const sourceFile = new File(
        [blob],
        `${productName || 'producto'}.${extensionForMimeType(mimeType)}`,
        { type: mimeType },
      );
      const loaded = await validateImageFile(sourceFile, 'catalog_taxonomy_image');
      cropSourceRef.current = loaded;
      setCropSource(loaded);
    } catch (prepareError) {
      setError(
        prepareError instanceof Error
          ? prepareError.message
          : 'No se pudo preparar esta imagen.',
      );
    } finally {
      setPreparingProductId(null);
    }
  }

  function cancelCrop() {
    cropSourceRef.current = null;
    setCropSource(null);
  }

  if (cropSource) {
    return (
      <ImageCropDialog
        open
        file={cropSource}
        preset={getImageAssetPreset('catalog_taxonomy_image')}
        onCancel={cancelCrop}
        onConfirm={(file) => {
          onSelect(file);
          cropSourceRef.current = null;
          setCropSource(null);
          onClose();
        }}
      />
    );
  }

  const firstVisible = result.total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastVisible = Math.min((page + 1) * PAGE_SIZE, result.total);
  const hasPrevious = page > 0;
  const hasNext = lastVisible < result.total;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-image-picker-title"
        className="relative flex max-h-[min(90vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h3 id="product-image-picker-title" className="text-lg font-semibold text-gray-900">
              Elegir imagen de un producto
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Productos de {categoryName}{categoryIds.length > 1 ? ' y sus subcategorías' : ''}. Después podrás ajustar el recorte.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar selector de imágenes"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="flex shrink-0 gap-2 px-5 pb-4 sm:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              id="product-image-search"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Buscar producto"
              aria-label="Buscar producto"
              className="h-10"
            />
          </div>
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="overflow-hidden rounded-2xl bg-gray-100">
                  <div className="aspect-square animate-pulse bg-gray-200" />
                  <div className="m-3 h-3 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <ImageIcon className="h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm text-gray-600">{error}</p>
              <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={retry}>
                Intentar nuevamente
              </Button>
            </div>
          ) : result.items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <ImageIcon className="h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-700">No hay imágenes disponibles</p>
              <p className="mt-1 max-w-md text-xs leading-5 text-gray-500">
                Esta categoría todavía no tiene productos con imagen principal.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {result.items.map((candidate) => {
                const preparing = preparingProductId === candidate.productId;
                return (
                  <button
                    key={candidate.productId}
                    type="button"
                    onClick={() => void prepareImage(candidate.productId, candidate.name, candidate.imageUrl)}
                    disabled={preparingProductId !== null}
                    className="group overflow-hidden rounded-2xl bg-gray-50 text-left outline-none ring-indigo-500 transition hover:bg-gray-100 focus-visible:ring-2 disabled:cursor-wait disabled:opacity-60"
                    aria-label={`Usar imagen de ${candidate.name}`}
                  >
                    <span className="relative block aspect-square overflow-hidden bg-gray-100">
                      <img
                        src={candidate.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      {preparing ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </span>
                      ) : null}
                    </span>
                    <span className="block p-3">
                      <span className="block truncate text-sm font-semibold text-gray-800">{candidate.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-gray-500">
                        {candidate.categoryId ? categoryNameById[candidate.categoryId] ?? categoryName : categoryName}
                        {candidate.status === 'draft' ? ' · Borrador' : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!loading && !error && result.total > 0 ? (
          <div className="flex shrink-0 items-center justify-between gap-3 bg-gray-50 px-5 py-3 sm:px-6">
            <p className="text-xs text-gray-500">
              {firstVisible}–{lastVisible} de {result.total}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!hasPrevious}
                onClick={() => changePage(page - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!hasNext}
                onClick={() => changePage(page + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
