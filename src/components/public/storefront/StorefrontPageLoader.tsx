import { MelosoftBrand } from '@/components/ui/MelosoftBrand';

interface StorefrontPageLoaderProps {
  label?: string;
}

export function StorefrontPageLoader({
  label = 'Cargando…',
}: StorefrontPageLoaderProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6"
    >
      <MelosoftBrand
        variant="logo"
        alt="Melosoft Commerce"
        className="h-auto w-36 object-contain animate-[melosoft-loader-breathe_2.2s_ease-in-out_infinite] motion-reduce:animate-none"
      />
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400 motion-reduce:animate-none"
        aria-hidden="true"
      />
    </div>
  );
}
