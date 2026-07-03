import type { InputHTMLAttributes, WheelEvent } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, type, onWheel, ...props }: InputProps) {
  const wheelHandler =
    type === 'number'
      ? (e: WheelEvent<HTMLInputElement>) => {
          e.currentTarget.blur();
          onWheel?.(e);
        }
      : onWheel;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        onWheel={wheelHandler}
        className={cn(
          'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500',
          'transition-colors duration-150',
          'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
          error
            ? 'border-red-300 bg-red-50 text-red-900 placeholder:text-red-300'
            : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
