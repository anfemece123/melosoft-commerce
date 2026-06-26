import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Move, ZoomIn, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  cropImageToFile,
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
  onConfirm: (file: File) => void;
}

export function ImageCropDialog({
  open,
  file,
  preset,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setSaving(false);
  }, [open, file?.dataUrl]);

  const frame = useMemo(() => {
    const maxW = 420;
    const maxH = 320;
    let width = maxW;
    let height = width / preset.aspectRatio;
    if (height > maxH) {
      height = maxH;
      width = height * preset.aspectRatio;
    }
    return { width, height };
  }, [preset.aspectRatio]);

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

  useEffect(() => {
    if (!imageLayout) return;
    setOffsetX((current) => clamp(current, -imageLayout.maxOffsetX, imageLayout.maxOffsetX));
    setOffsetY((current) => clamp(current, -imageLayout.maxOffsetY, imageLayout.maxOffsetY));
  }, [imageLayout]);

  if (!open || !file || !imageLayout) return null;
  const safeFile = file;
  const safeLayout = imageLayout;

  async function handleConfirm() {
    try {
      setSaving(true);
      const sourceWidth = frame.width / (safeLayout.baseScale * zoom);
      const sourceHeight = frame.height / (safeLayout.baseScale * zoom);
      const sourceCenterX = safeFile.width / 2 - offsetX / (safeLayout.baseScale * zoom);
      const sourceCenterY = safeFile.height / 2 - offsetY / (safeLayout.baseScale * zoom);

      const crop = {
        x: clamp(sourceCenterX - sourceWidth / 2, 0, safeFile.width - sourceWidth),
        y: clamp(sourceCenterY - sourceHeight / 2, 0, safeFile.height - sourceHeight),
        width: sourceWidth,
        height: sourceHeight,
      };

      const cropped = await cropImageToFile(
        safeFile,
        crop,
        {
          width: preset.recommendedWidth,
          height: preset.recommendedHeight,
        },
        safeFile.file.name.replace(/\.[^.]+$/, '') || preset.kind
      );

      onConfirm(cropped);
    } finally {
      setSaving(false);
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const baseOffsetX = offsetX;
    const baseOffsetY = offsetY;

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-5 top-5 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Ajustar {preset.label.toLowerCase()}</h3>
            <p className="mt-1 text-sm text-gray-500">
              Recorta la imagen antes de subirla. Este formato se aplicará siempre en el sistema.
            </p>

            <div className="mt-5 rounded-3xl bg-gray-950/95 p-6">
              <div
                className="relative mx-auto overflow-hidden rounded-[28px] bg-gray-900"
                style={{ width: frame.width, height: frame.height }}
                onPointerDown={handlePointerDown}
              >
                <img
                  src={safeFile.dataUrl}
                  alt="Vista previa"
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: safeLayout.displayWidth,
                    height: safeLayout.displayHeight,
                    transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
                  }}
                />
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
                Tamaño ideal: <span className="font-semibold">{preset.recommendedWidth}x{preset.recommendedHeight}px</span>
              </p>
              <p>
                Tamaño mínimo: <span className="font-semibold">{preset.minWidth}x{preset.minHeight}px</span>
              </p>
              <p>
                Peso máximo: <span className="font-semibold">{formatBytes(preset.maxBytes)}</span>
              </p>
              <p>
                Archivo actual: <span className="font-semibold">{safeFile.width}x{safeFile.height}px</span>
              </p>
            </div>

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
                  value={offsetX}
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
                  value={offsetY}
                  onChange={(event) => setOffsetY(Number(event.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleConfirm()} isLoading={saving}>
                Usar imagen
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
