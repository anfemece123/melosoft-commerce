import { useEffect, useRef } from 'react';

function getFirstErrorFieldName(
  errors: Record<string, unknown>,
  prefix = ''
): string | null {
  for (const [key, val] of Object.entries(errors)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') return fullKey;
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const item = val[i];
        if (typeof item === 'string') return `${fullKey}[${i}]`;
        if (typeof item === 'object' && item !== null) {
          const nested = getFirstErrorFieldName(
            item as Record<string, unknown>,
            `${fullKey}[${i}]`
          );
          if (nested) return nested;
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      const nested = getFirstErrorFieldName(val as Record<string, unknown>, fullKey);
      if (nested) return nested;
    }
  }
  return null;
}

function findFieldElement(fieldName: string): HTMLElement | null {
  // 1. Standard input/select/textarea with name attribute
  const byName = document.querySelector<HTMLElement>(`[name="${CSS.escape(fieldName)}"]`);
  if (byName) return byName;

  // 2. Element with matching id
  const byId = document.querySelector<HTMLElement>(`#${CSS.escape(fieldName)}`);
  if (byId) return byId;

  // 3. Container tagged with data-field-name (custom chip/card selectors)
  const byDataName = document.querySelector<HTMLElement>(
    `[data-field-name="${CSS.escape(fieldName)}"]`
  );
  if (byDataName) return byDataName;

  // 4. Error paragraph tagged with data-error-for
  const byErrorFor = document.querySelector<HTMLElement>(
    `[data-error-for="${CSS.escape(fieldName)}"]`
  );
  if (byErrorFor) return byErrorFor;

  return null;
}

interface Options {
  errors: Record<string, unknown>;
  submitCount: number;
  isSubmitting?: boolean;
}

/**
 * After a submit attempt that produces validation errors, scrolls and focuses
 * the first invalid field.
 *
 * WHY both [errors, submitCount] as deps:
 * Formik increments submitCount BEFORE async validation finishes, so the first
 * render after submit has submitCount++ but errors = {}. Errors are populated
 * in a subsequent render. Adding errors to deps means the effect fires again
 * when errors arrive; the lastScrolledCount ref prevents double-scrolling.
 */
export function useScrollToFirstFormikError({
  errors,
  submitCount,
  isSubmitting,
}: Options): void {
  const lastScrolledCount = useRef(0);

  useEffect(() => {
    if (submitCount === 0 || isSubmitting) return;
    if (Object.keys(errors).length === 0) return;
    // Only scroll once per submit attempt
    if (lastScrolledCount.current === submitCount) return;

    lastScrolledCount.current = submitCount;

    // Small delay so error messages have rendered into the DOM before we search
    const timer = window.setTimeout(() => {
      const firstKey = getFirstErrorFieldName(errors as Record<string, unknown>);

      // Try to find the specific errored field element
      const byField = firstKey ? findFieldElement(firstKey) : null;

      // Fallback: first visible error paragraph
      const byErrorMsg = document.querySelector<HTMLElement>(
        '[data-error-for], p.text-red-600, span.text-red-600'
      );

      // Last resort: scroll to the validation summary banner
      const byErrorSummary = document.querySelector<HTMLElement>('[data-error-summary="true"]');

      const el = byField ?? byErrorMsg ?? byErrorSummary;
      if (!el) return;

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof (el as HTMLInputElement).focus === 'function') {
        (el as HTMLInputElement).focus({ preventScroll: true });
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [errors, submitCount, isSubmitting]);
}
