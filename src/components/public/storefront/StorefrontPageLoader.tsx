import { MelosoftBrand } from '@/components/ui/MelosoftBrand';

interface StorefrontPageLoaderProps {
  label?: string;
}

export function StorefrontPageLoader({
  label = 'Preparando tu experiencia…',
}: StorefrontPageLoaderProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6 text-slate-900"
    >
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-200/35 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex w-full max-w-xs flex-col items-center text-center">
        <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border border-indigo-200/70" />
          <div className="absolute inset-0 animate-[spin_1.35s_cubic-bezier(0.55,0.15,0.45,0.85)_infinite] rounded-full border-2 border-transparent border-t-indigo-600 border-r-indigo-300 motion-reduce:animate-none" />
          <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-white shadow-[0_16px_36px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5">
            <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-indigo-600 shadow-[0_0_0_8px_rgba(79,70,229,0.10)] motion-reduce:animate-none" />
          </div>
        </div>

        <MelosoftBrand
          variant="logo"
          alt="Melosoft Commerce"
          className="mt-7 h-auto w-48 object-contain"
        />
        <p className="mt-3 text-sm leading-6 text-slate-500">{label}</p>
        <div className="mt-7 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div className="h-full w-2/5 animate-[melosoft-loader-progress_1.4s_ease-in-out_infinite] rounded-full bg-indigo-600 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
