import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  className,
  id,
  name,
  ...props
}: SelectProps) {
  const fieldId = id ?? name;
  const fieldName = name ?? id;
  const errorId = error && fieldId ? `${fieldId}-error` : undefined;
  const hintId = hint && !error && fieldId ? `${fieldId}-hint` : undefined;
  const describedBy = [props['aria-describedby'], errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1" data-field-name={fieldName}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        {...props}
        id={fieldId}
        name={name}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={describedBy}
        className={cn(
          'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500',
          'transition-colors duration-150 bg-white',
          'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
          error ? 'border-red-300 text-red-900' : 'border-gray-300 text-gray-900',
          className
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p id={errorId} data-error-for={fieldName} role="alert" className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p id={hintId} className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
