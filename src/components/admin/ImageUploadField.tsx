import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { ImageCropDialog } from './ImageCropDialog';
import {
  formatBytes,
  type ImageAssetKind,
} from '@/lib/images/imageAssetPresets';
import {
  getImageAssetPreset,
  disposeLoadedImageFile,
  validateImageFile,
  type LoadedImageFile,
} from '@/lib/images/imageFile.utils';

interface ImageUploadFieldProps {
  id: string;
  label: string;
  assetKind: ImageAssetKind;
  previewUrl: string | null;
  onFileSelect: (file: File | null) => void;
  onClear?: () => void;
  uploading?: boolean;
  hint?: string;
  error?: string;
  aspectClassName?: string;
  clearLabel?: string;
  clearAction?: 'remove' | 'reset';
  labelAdornment?: ReactNode;
  secondaryAction?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
  };
}

export function ImageUploadField({
  id,
  label,
  assetKind,
  previewUrl,
  onFileSelect,
  onClear,
  uploading = false,
  hint,
  error,
  aspectClassName = 'h-24 w-24 rounded-2xl',
  clearLabel = 'Quitar',
  clearAction = 'remove',
  labelAdornment,
  secondaryAction,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [cropSource, setCropSource] = useState<LoadedImageFile | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const preset = getImageAssetPreset(assetKind);

  useEffect(() => () => disposeLoadedImageFile(cropSource), [cropSource]);

  async function handleRawFile(file: File | null) {
    if (!file) return;
    try {
      setLocalError(null);
      const loaded = await validateImageFile(file, assetKind);
      setCropSource(loaded);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo preparar la imagen.');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {labelAdornment}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className={`flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-gray-300 bg-gray-50 ${aspectClassName}`}
          >
            {previewUrl ? (
              <img src={previewUrl} alt={label} className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-8 w-8 text-gray-300" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? 'Subiendo...' : 'Subir imagen'}
              </button>
              {secondaryAction ? (
                <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  disabled={uploading || secondaryAction.disabled}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {secondaryAction.icon}
                  {secondaryAction.label}
                </button>
              ) : null}
              {previewUrl && onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {clearAction === 'reset'
                    ? <RotateCcw className="h-4 w-4" />
                    : <Trash2 className="h-4 w-4" />}
                  {clearLabel}
                </button>
              )}
            </div>

            <input
              id={id}
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              className="hidden"
              onChange={(event) => {
                void handleRawFile(event.target.files?.[0] ?? null);
                event.currentTarget.value = '';
              }}
            />

            <p className="mt-2 text-xs text-gray-500">
              {hint ?? 'Puedes usar una imagen vertical, horizontal o cuadrada; podrás elegir el recorte antes de subirla.'}
            </p>
            <p className="mt-1 text-xs font-medium text-indigo-700">
              Tamaño recomendado: {preset.recommendedWidth} × {preset.recommendedHeight} px
            </p>
            <p className="mt-1 text-xs text-gray-400">
              JPG, PNG, WebP o AVIF hasta {formatBytes(preset.maxBytes)}. Se optimiza automáticamente antes de guardar.
            </p>
            {(error || localError) && <p className="mt-1 text-xs text-red-600">{error ?? localError}</p>}
          </div>
        </div>
      </div>

      <ImageCropDialog
        open={cropSource !== null}
        file={cropSource}
        preset={preset}
        onCancel={() => setCropSource(null)}
        onConfirm={(file) => {
          onFileSelect(file);
          setCropSource(null);
        }}
      />
    </div>
  );
}
