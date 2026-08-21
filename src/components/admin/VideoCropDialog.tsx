import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Move, Scissors, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  cropVideoToFile,
  formatVideoBytes,
  formatVideoDuration,
  getVideoCropRect,
  getVideoOutputSize,
  PRODUCT_VIDEO_ASPECT_RATIO,
  PRODUCT_VIDEO_MAX_BYTES,
  PRODUCT_VIDEO_MAX_DURATION_SECONDS,
  type LoadedProductVideo,
} from '@/lib/videos/videoFile.utils';

interface VideoCropDialogProps {
  open: boolean;
  file: LoadedProductVideo | null;
  onCancel: () => void;
  onConfirm: (file: LoadedProductVideo) => void | Promise<void>;
}

export function VideoCropDialog({
  open,
  file,
  onCancel,
  onConfirm,
}: VideoCropDialogProps) {
  if (!open || !file) return null;
  return (
    <VideoCropDialogContent
      key={file.previewUrl}
      file={file}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function VideoCropDialogContent({
  file,
  onCancel,
  onConfirm,
}: Omit<VideoCropDialogProps, 'open' | 'file'> & { file: LoadedProductVideo }) {
  const [focusX, setFocusX] = useState(0.5);
  const [focusY, setFocusY] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const crop = useMemo(
    () => getVideoCropRect(file.width, file.height, focusX, focusY, zoom),
    [file.height, file.width, focusX, focusY, zoom],
  );
  const output = useMemo(() => getVideoOutputSize(crop), [crop]);
  const sourceAspect = file.width / file.height;
  const canMoveHorizontally = sourceAspect > PRODUCT_VIDEO_ASPECT_RATIO + 0.001;
  const canMoveVertically = sourceAspect < PRODUCT_VIDEO_ASPECT_RATIO - 0.001;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !processing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCancel();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onCancel, processing]);

  async function handleConfirm() {
    try {
      setProcessing(true);
      setProcessingError(null);
      const cropped = await cropVideoToFile(file, crop, file.file.name);
      await onConfirm(cropped);
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'No se pudo preparar el video.');
    } finally {
      setProcessing(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-4"
      data-dialog-layer="nested"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!processing) onCancel();
        }}
      />
      <div
        className="relative my-auto w-full max-w-4xl rounded-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-crop-dialog-title"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          aria-label="Cerrar editor de video"
          className="absolute right-5 top-5 z-10 text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div>
            <h3 id="video-crop-dialog-title" className="text-lg font-semibold text-gray-900">
              Ajustar video del producto
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Elige qué parte se mostrará. El resultado queda cuadrado, igual que las imágenes del producto.
            </p>

            <div className="mt-5 rounded-3xl bg-gray-950/95 p-5 sm:p-6">
              <div className="relative mx-auto aspect-square max-w-2xl overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
                <video
                  src={file.previewUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  style={{
                    objectPosition: `${focusX * 100}% ${focusY * 100}%`,
                    transform: `scale(${zoom})`,
                    transformOrigin: `${focusX * 100}% ${focusY * 100}%`,
                  }}
                  aria-label="Vista previa del video recortado"
                />
                <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />
                <div className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/30" />
                <div className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/30" />
                <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/30" />
                <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/30" />
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-white/70">
                <Move className="h-3.5 w-3.5" />
                {canMoveHorizontally || canMoveVertically
                  ? 'Mueve el encuadre para elegir la parte importante del video.'
                  : 'El video ya tiene la proporción ideal.'}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Salida optimizada</p>
              <p className="mt-2">
                Formato: <span className="font-semibold">1:1 · hasta 1200×1200 px</span>
              </p>
              <p>
                Resultado actual: <span className="font-semibold">{output.width}×{output.height} px</span>
              </p>
              <p>
                Duración: <span className="font-semibold">{formatVideoDuration(file.durationSeconds)}</span> de máximo {PRODUCT_VIDEO_MAX_DURATION_SECONDS} s
              </p>
              <p>
                Archivo original: <span className="font-semibold">{formatVideoBytes(file.file.size)}</span> de máximo {formatVideoBytes(PRODUCT_VIDEO_MAX_BYTES)}
              </p>
            </div>

            {canMoveHorizontally ? (
              <label className="block text-sm text-gray-700">
                <span className="font-medium">Encuadre horizontal</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={focusX}
                  disabled={processing}
                  onChange={(event) => setFocusX(Number(event.target.value))}
                  className="mt-3 w-full accent-indigo-600"
                  aria-label="Encuadre horizontal"
                />
                <span className="mt-1 flex justify-between text-xs text-gray-400"><span>Izquierda</span><span>Derecha</span></span>
              </label>
            ) : null}

            {canMoveVertically ? (
              <label className="block text-sm text-gray-700">
                <span className="font-medium">Encuadre vertical</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={focusY}
                  disabled={processing}
                  onChange={(event) => setFocusY(Number(event.target.value))}
                  className="mt-3 w-full accent-indigo-600"
                  aria-label="Encuadre vertical"
                />
                <span className="mt-1 flex justify-between text-xs text-gray-400"><span>Arriba</span><span>Abajo</span></span>
              </label>
            ) : null}

            <label className="block text-sm text-gray-700">
              <span className="font-medium">Zoom / área visible</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                disabled={processing}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="mt-3 w-full accent-indigo-600"
                aria-label="Zoom del video"
              />
              <span className="mt-1 flex justify-between text-xs text-gray-400"><span>Encuadre amplio</span><span>{zoom.toFixed(1)}×</span><span>Más cerca</span></span>
            </label>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
              <div className="flex items-start gap-2">
                <Scissors className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Se recorta y comprime antes de guardar. El video nunca reemplaza la imagen principal del producto.</p>
              </div>
            </div>

            {processingError ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {processingError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleConfirm()} isLoading={processing}>
                Aplicar recorte
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
