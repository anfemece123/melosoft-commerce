import { Film, Gauge, Trash2, Upload } from 'lucide-react';
import type { ProductVideo } from '@/features/products/products.types';
import {
  formatVideoBytes,
  formatVideoDuration,
  PRODUCT_VIDEO_MAX_BYTES,
  PRODUCT_VIDEO_MAX_DURATION_SECONDS,
  type LoadedProductVideo,
} from '@/lib/videos/videoFile.utils';

export type ProductVideoDraft =
  | { kind: 'existing'; video: ProductVideo }
  | ({ kind: 'pending' } & LoadedProductVideo);

interface ProductVideoUploadFieldProps {
  value: ProductVideoDraft | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

export function ProductVideoUploadField({
  value,
  disabled = false,
  onSelect,
  onRemove,
}: ProductVideoUploadFieldProps) {
  const src = value?.kind === 'existing' ? value.video.videoUrl : value?.previewUrl ?? null;
  const duration = value?.kind === 'existing' ? value.video.durationSeconds : value?.durationSeconds;
  const bytes = value?.kind === 'existing' ? value.video.fileSizeBytes : value?.file.size;
  const width = value?.kind === 'existing' ? value.video.width : value?.width;
  const height = value?.kind === 'existing' ? value.video.height : value?.height;

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-violet-50 p-2 text-violet-700">
          <Film className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Video corto del producto</h3>
          <p className="mt-1 text-sm text-gray-500">
            Es opcional y se muestra solo en el detalle público. Nunca reemplaza la imagen principal ni aparece en el catálogo.
          </p>
        </div>
      </div>

      {src ? (
        <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:flex-row sm:items-start">
          <video
            src={src}
            controls
            muted
            playsInline
            preload="metadata"
            className="aspect-square w-full max-w-sm rounded-lg bg-black object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800">
              {value?.kind === 'pending' ? 'Video listo para guardar' : 'Video guardado'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {formatVideoDuration(duration ?? 0)} · {width ?? 0}×{height ?? 0} px · {formatVideoBytes(bytes ?? 0)}
            </p>
            {value?.kind === 'pending' && (
              <p className="mt-2 text-xs text-amber-700">Se reemplazará el video anterior al guardar el producto.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Upload className="h-4 w-4" />
                Reemplazar video
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  disabled={disabled}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (file) onSelect(file);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Quitar video
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 px-4 py-8 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40">
          <Film className="h-8 w-8 text-gray-300" />
          <span className="mt-2 text-sm font-medium text-gray-700">Agregar video</span>
          <span className="mt-1 text-xs text-gray-500">MP4 o WebM · se ajusta al formato cuadrado del producto (hasta 1200×1200) · máximo {PRODUCT_VIDEO_MAX_DURATION_SECONDS} segundos y {formatVideoBytes(PRODUCT_VIDEO_MAX_BYTES)}</span>
          <input
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            disabled={disabled}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) onSelect(file);
            }}
          />
        </label>
      )}

      <p className="flex items-center gap-1.5 text-xs text-gray-400">
        <Gauge className="h-3.5 w-3.5" />
        El video se carga únicamente cuando el cliente lo abre, para no hacer pesado el catálogo.
      </p>
    </div>
  );
}
