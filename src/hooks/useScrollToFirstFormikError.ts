import { useEffect, useRef } from 'react';
import { useFormikContext } from 'formik';

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

function findFieldElement(fieldName: string, root: ParentNode = document): HTMLElement | null {
  // 1. Standard input/select/textarea with name attribute
  const escapedFieldName = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(fieldName)
    : fieldName.replace(/["\\]/g, '\\$&');
  const byName = root.querySelector<HTMLElement>(`[name="${escapedFieldName}"]`);
  if (byName) return byName;

  // 2. Element with matching id
  const byId = root.querySelector<HTMLElement>(`#${escapedFieldName}`);
  if (byId) return byId;

  // 3. Container tagged with data-field-name (custom chip/card selectors)
  const byDataName = root.querySelector<HTMLElement>(
    `[data-field-name="${escapedFieldName}"]`
  );
  if (byDataName) return byDataName;

  // 4. Error paragraph tagged with data-error-for
  const byErrorFor = root.querySelector<HTMLElement>(
    `[data-error-for="${escapedFieldName}"]`
  );
  if (byErrorFor) return byErrorFor;

  return null;
}

export interface ScrollToFirstErrorOptions {
  fieldName?: string | null;
  root?: ParentNode | null;
}

/**
 * Imperative counterpart used by forms that do not use Formik. It waits
 * until React has painted the validation messages, then moves the viewport
 * and keyboard focus to the first actionable error.
 */
export function scrollToFirstError({
  fieldName,
  root,
}: ScrollToFirstErrorOptions = {}): number {
  return window.setTimeout(() => {
    const searchRoot = root ?? document;
    const byField = fieldName ? findFieldElement(fieldName, searchRoot) : null;
    const firstInvalid = searchRoot.querySelector<HTMLElement>('[aria-invalid="true"]');
    const firstError = searchRoot.querySelector<HTMLElement>('[data-error-for]');
    const summary = searchRoot.querySelector<HTMLElement>('[data-error-summary="true"]');
    const element = byField ?? firstInvalid ?? firstError ?? summary;
    if (!element) return;

    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (typeof element.focus === 'function') {
      element.focus({ preventScroll: true });
    }
  }, 80);
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

    const firstKey = getFirstErrorFieldName(errors as Record<string, unknown>);
    const timer = scrollToFirstError({ fieldName: firstKey });

    return () => window.clearTimeout(timer);
  }, [errors, submitCount, isSubmitting]);
}

/** Drop-in component for render-prop based Formik forms. */
export function FormikErrorFocus(): null {
  const formik = useFormikContext<Record<string, unknown>>();
  useScrollToFirstFormikError({
    errors: formik.errors,
    submitCount: formik.submitCount,
    isSubmitting: formik.isSubmitting,
  });
  return null;
}
