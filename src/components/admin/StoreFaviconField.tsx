import { ImageUploadField } from './ImageUploadField';

interface StoreFaviconFieldProps {
  id: string;
  faviconUrl: string | null;
  logoUrl: string | null;
  onFileSelect: (file: File | null) => void;
  onReset: () => void;
  uploading?: boolean;
  error?: string;
}

export function StoreFaviconField({
  id,
  faviconUrl,
  logoUrl,
  onFileSelect,
  onReset,
  uploading = false,
  error,
}: StoreFaviconFieldProps) {
  const isCustom = Boolean(faviconUrl && faviconUrl !== logoUrl);

  return (
    <ImageUploadField
      id={id}
      label="Icono de la pestaña (favicon)"
      labelAdornment={(
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
          {isCustom ? 'Personalizado' : 'Automático'}
        </span>
      )}
      assetKind="store_favicon"
      previewUrl={faviconUrl ?? logoUrl}
      onFileSelect={onFileSelect}
      onClear={isCustom ? onReset : undefined}
      uploading={uploading}
      hint={isCustom
        ? 'Este icono personalizado aparece junto al nombre de la empresa en el navegador.'
        : logoUrl
          ? 'Se usa el logo automáticamente. Puedes subir un icono cuadrado diferente si lo prefieres.'
          : 'Sube primero el logo o elige aquí un icono cuadrado personalizado.'}
      error={error}
      aspectClassName="h-20 w-20 rounded-xl"
      clearLabel="Usar logo"
      clearAction="reset"
    />
  );
}
