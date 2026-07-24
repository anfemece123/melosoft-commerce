import { MelosoftBrand } from './MelosoftBrand';
import { cn } from '@/utils/cn';

interface BrandLoadingIndicatorProps {
  size?: 'sm' | 'lg';
}

interface LoadingStateProps {
  label?: string;
  className?: string;
}

const INDICATOR_SIZE = {
  sm: {
    wrapper: 'h-14 w-14',
    mark: 'inset-2 rounded-xl',
  },
  lg: {
    wrapper: 'h-20 w-20',
    mark: 'inset-3 rounded-2xl',
  },
} as const;

function BrandLoadingIndicator({ size = 'lg' }: BrandLoadingIndicatorProps) {
  const classes = INDICATOR_SIZE[size];

  return (
    <div className={cn('relative shrink-0', classes.wrapper)} aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-slate-200/90" />
      <div className="absolute inset-0 animate-[spin_1.25s_cubic-bezier(0.55,0.15,0.45,0.85)_infinite] rounded-full border-2 border-transparent border-r-indigo-200 border-t-indigo-600 motion-reduce:animate-none" />
      <div className="absolute inset-1 rounded-full bg-indigo-100/40 blur-md" />
      <div
        className={cn(
          'absolute overflow-hidden bg-slate-700 shadow-sm ring-1 ring-slate-900/10',
          classes.mark
        )}
      >
        <MelosoftBrand
          variant="mark"
          alt=""
          className="h-full w-full scale-[1.55] object-cover"
        />
      </div>
    </div>
  );
}

export function LoadingScreen({
  label = 'Preparando tu panel…',
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center bg-slate-50/95 px-6 backdrop-blur-[2px]',
        className
      )}
    >
      <div className="flex flex-col items-center text-center">
        <BrandLoadingIndicator />
        <p className="mt-5 text-sm font-semibold tracking-tight text-slate-800">
          Melosoft Commerce
        </p>
        <p className="mt-1 text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function PanelLoadingState({
  label = 'Cargando información…',
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn(
        'flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white/70 px-6 py-12 text-center',
        className
      )}
    >
      <BrandLoadingIndicator size="sm" />
      <p className="mt-4 text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}
