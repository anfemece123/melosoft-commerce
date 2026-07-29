import type { InputHTMLAttributes, ReactNode, WheelEvent } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelAdornment?: ReactNode;
  endAdornment?: ReactNode;
  error?: string;
  hint?: string;
}

export function Input({
  label,
  labelAdornment,
  endAdornment,
  error,
  hint,
  className,
  id,
  name,
  type,
  onWheel,
  ...props
}: InputProps) {
  const fieldId = id ?? name;
  const fieldName = name ?? id;
  const errorId = error && fieldId ? `${fieldId}-error` : undefined;
  const hintId = hint && !error && fieldId ? `${fieldId}-hint` : undefined;
  const describedBy = [props['aria-describedby'], errorId, hintId].filter(Boolean).join(' ') || undefined;
  const wheelHandler =
    type === 'number'
      ? (e: WheelEvent<HTMLInputElement>) => {
          e.currentTarget.blur();
          onWheel?.(e);
        }
      : onWheel;

  return (
    <div className="space-y-1" data-field-name={fieldName}>
      {label && (
        <label htmlFor={fieldId} className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <span>{label}</span>
          {labelAdornment}
        </label>
      )}
      <div className="relative">
        <input
          {...props}
          id={fieldId}
          name={name}
          type={type}
          onWheel={wheelHandler}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={describedBy}
          className={cn(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500',
            'transition-colors duration-150',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            endAdornment && 'pr-10',
            error
              ? 'border-red-300 bg-red-50 text-red-900 placeholder:text-red-300'
              : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
            className
          )}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {endAdornment}
          </div>
        )}
      </div>
      {error && <p id={errorId} data-error-for={fieldName} role="alert" className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p id={hintId} className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
