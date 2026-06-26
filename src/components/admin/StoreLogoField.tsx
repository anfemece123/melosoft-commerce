import { ImageUploadField } from './ImageUploadField';

interface StoreLogoFieldProps {
  id: string;
  label?: string;
  previewUrl: string | null;
  onFileSelect: (file: File | null) => void;
  onClear?: () => void;
  uploading?: boolean;
  hint?: string;
  error?: string;
}

export function StoreLogoField({
  id,
  label = 'Logo de la empresa',
  previewUrl,
  onFileSelect,
  onClear,
  uploading = false,
  hint,
  error,
}: StoreLogoFieldProps) {
  return (
    <ImageUploadField
      id={id}
      label={label}
      assetKind="store_logo"
      previewUrl={previewUrl}
      onFileSelect={onFileSelect}
      onClear={onClear}
      uploading={uploading}
      hint={hint ?? 'Usa una imagen cuadrada. El sistema la recorta en formato circular para el ecommerce.'}
      error={error}
      aspectClassName="h-24 w-24 rounded-2xl"
    />
  );
}
