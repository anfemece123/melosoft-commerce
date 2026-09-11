import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * Shared shimmer block. Callers set size/shape via `className` and, for
 * theme-aware storefront surfaces, a base `backgroundColor` via `style` —
 * a single soft sweep passes over whatever color the caller gives it.
 * Decorative only (`aria-hidden`): wrap a group of these in
 * `SkeletonRegion` to announce the loading state to screen readers once.
 */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative overflow-hidden bg-gray-200 dark:bg-white/10', className)}
      style={style}
    >
      <div
        className="absolute inset-y-0 left-0 w-2/3 animate-[skeleton-sweep_2.2s_ease-in-out_infinite] motion-reduce:hidden"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)',
        }}
      />
    </div>
  );
}

interface SkeletonRegionProps {
  label?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Marks a subtree as an in-flight loading region for assistive tech
 * (`role="status"` + `aria-busy` + `aria-live="polite"`) without adding a
 * second visible loading affordance — the visual skeleton stays whatever
 * children render.
 */
export function SkeletonRegion({ label = 'Cargando contenido…', className, children }: SkeletonRegionProps) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
