import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Move, Sparkles, ZoomIn, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  cropImageToFile,
  getAdaptiveOutputSize,
  type LoadedImageFile,
} from '@/lib/images/imageFile.utils';
import {
  formatBytes,
  type ImageAssetPreset,
} from '@/lib/images/imageAssetPresets';

interface ImageCropDialogProps {
  open: boolean;
  file: LoadedImageFile | null;
  preset: ImageAssetPreset;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
}

export function ImageCropDialog({
  open,
  file,
  preset,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  if (!open || !file) return null;
  return (
    <ImageCropDialogContent
      key={file.id}
      file={file}
      preset={preset}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function ImageCropDialogContent({
  file,
  preset,
  onCancel,
  onConfirm,
}: Omit<ImageCropDialogProps, 'open' | 'file'> & { file: LoadedImageFile }) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window === 'undefined' ? 500 : window.innerWidth
  ));

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  const frame = useMemo(() => {
    const maxW = Math.min(420, Math.max(240, viewportWidth - 80));
    const maxH = 320;
    let width = maxW;
    let height = width / preset.aspectRatio;
    if (height > maxH) {
      height = maxH;
      width = height * preset.aspectRatio;
    }
    return { width, height };
  }, [preset.aspectRatio, viewportWidth]);

  const imageLayout = useMemo(() => {
    if (!file) return null;
    const baseScale = Math.max(frame.width / file.width, frame.height / file.height);
    const displayWidth = file.width * baseScale * zoom;
    const displayHeight = file.height * baseScale * zoom;
    const maxOffsetX = Math.max(0, (displayWidth - frame.width) / 2);
    const maxOffsetY = Math.max(0, (displayHeight - frame.height) / 2);

    return {
      baseScale,
      displayWidth,
      displayHeight,
      maxOffsetX,
      maxOffsetY,
    };
  }, [file, frame.height, frame.width, zoom]);

  if (!imageLayout) return null;
  const safeFile = file;
  const safeLayout = imageLayout;
  const safeOffsetX = clamp(offsetX, -safeLayout.maxOffsetX, safeLayout.maxOffsetX);
  const safeOffsetY = clamp(offsetY, -safeLayout.maxOffsetY, safeLayout.maxOffsetY);

  async function handleConfirm() {
    try {
      setSaving(true);
      setProcessingError(null);
      const sourceWidth = frame.width / (safeLayout.baseScale * zoom);
      const sourceHeight = frame.height / (safeLayout.baseScale * zoom);
      const sourceCenterX = safeFile.width / 2 - safeOffsetX / (safeLayout.baseScale * zoom);
      const sourceCenterY = safeFile.height / 2 - safeOffsetY / (safeLayout.baseScale * zoom);

      const crop = {
        x: clamp(sourceCenterX - sourceWidth / 2, 0, safeFile.width - sourceWidth),
        y: clamp(sourceCenterY - sourceHeight / 2, 0, safeFile.height - sourceHeight),
        width: sourceWidth,
        height: sourceHeight,
      };
      const output = getAdaptiveOutputSize(crop, preset);

      const cropped = await cropImageToFile(
        safeFile,
        crop,
        output,
        safeFile.file.name.replace(/\.[^.]+$/, '') || preset.kind,
        preset.maxOutputBytes,
      );

      await onConfirm(cropped);
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'No se pudo procesar la imagen.');
    } finally {
      setSaving(false);
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const baseOffsetX = safeOffsetX;
    const baseOffsetY = safeOffsetY;

    const move = (moveEvent: PointerEvent) => {
      setOffsetX(clamp(baseOffsetX + (moveEvent.clientX - startX), -safeLayout.maxOffsetX, safeLayout.maxOffsetX));
      setOffsetY(clamp(baseOffsetY + (moveEvent.clientY - startY), -safeLayout.maxOffsetY, safeLayout.maxOffsetY));
    };

    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative my-auto w-full max-w-4xl rounded-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-crop-dialog-title"
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cerrar editor de imagen"
          className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div>
            <h3 id="image-crop-dialog-title" className="text-lg font-semibold text-gray-900">
              Ajustar {preset.label.toLowerCase()}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Usa una imagen vertical, horizontal o cuadrada y elige exactamente qué parte se publicará.
            </p>

            <div className="mt-5 rounded-3xl bg-gray-950/95 p-6">
              <div
                className="relative mx-auto touch-none cursor-grab overflow-hidden rounded-[28px] bg-gray-900 active:cursor-grabbing"
                style={{ width: frame.width, height: frame.height }}
                onPointerDown={handlePointerDown}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 10 : 2;
                  if (event.key === 'ArrowLeft') setOffsetX((value) => value - step);
                  else if (event.key === 'ArrowRight') setOffsetX((value) => value + step);
                  else if (event.key === 'ArrowUp') setOffsetY((value) => value - step);
                  else if (event.key === 'ArrowDown') setOffsetY((value) => value + step);
                  else return;
                  event.preventDefault();
                }}
                tabIndex={0}
                role="application"
                aria-label="Área de recorte. Arrastra o usa las flechas para mover la imagen."
              >
                <img
                  src={safeFile.previewUrl}
                  alt="Vista previa"
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: safeLayout.displayWidth,
                    height: safeLayout.displayHeight,
                    transform: `translate(calc(-50% + ${safeOffsetX}px), calc(-50% + ${safeOffsetY}px))`,
                  }}
                />
                <div className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/35" />
                <div className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/35" />
                <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/35" />
                <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/35" />
                <div
                  className="pointer-events-none absolute inset-0 border-2 border-white/90"
                  style={{
                    borderRadius: preset.shape === 'circle' ? '9999px' : '28px',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                  }}
                />
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-white/70">
                <Move className="h-3.5 w-3.5" />
                Arrastra la imagen para moverla dentro del recorte.
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Guía recomendada</p>
              <p className="mt-2">
                Salida máxima: <span className="font-semibold">{preset.recommendedWidth}x{preset.recommendedHeight}px</span>
              </p>
              <p>
                Recorte mínimo utilizable: <span className="font-semibold">{preset.minimumCropWidth}x{preset.minimumCropHeight}px</span>
              </p>
              <p>
                Archivo original máximo: <span className="font-semibold">{formatBytes(preset.maxBytes)}</span>
              </p>
              <p>
                Peso optimizado: <span className="font-semibold">hasta {formatBytes(preset.maxOutputBytes)}</span>
              </p>
              <p>
                Archivo actual: <span className="font-semibold">{safeFile.width}x{safeFile.height}px</span>
              </p>
            </div>

            {safeFile.qualityWarning ? (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{safeFile.qualityWarning}</p>
              </div>
            ) : null}

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <ZoomIn className="h-4 w-4" />
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Horizontal</label>
                <input
                  type="range"
                  min={-safeLayout.maxOffsetX}
                  max={safeLayout.maxOffsetX}
                  step={1}
                  value={safeOffsetX}
                  onChange={(event) => setOffsetX(Number(event.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Vertical</label>
                <input
                  type="range"
                  min={-safeLayout.maxOffsetY}
                  max={safeLayout.maxOffsetY}
                  step={1}
                  value={safeOffsetY}
                  onChange={(event) => setOffsetY(Number(event.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {processingError ? <p className="text-sm text-red-600">{processingError}</p> : null}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleConfirm()} isLoading={saving}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Recortar y optimizar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
