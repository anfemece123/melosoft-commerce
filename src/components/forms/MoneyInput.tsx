import { useState, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface MoneyInputProps {
  id?: string;
  name?: string;
  label?: string;
  labelAdornment?: ReactNode;
  value: number | '';
  onChange: (value: number | '') => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  currency?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function formatThousands(value: number | ''): string {
  if (value === '' || value === null || value === undefined) return '';
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(n)) return '';
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
}

function parseRaw(display: string): number | '' {
  // strip everything that isn't a digit
  const digits = display.replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  return isNaN(n) ? '' : n;
}

export function MoneyInput({
  id,
  name,
  label,
  labelAdornment,
  value,
  onChange,
  onBlur,
  error,
  hint,
  currency = 'COP',
  placeholder = '0',
  disabled = false,
  className,
}: MoneyInputProps) {
  const [display, setDisplay] = useState(() => formatThousands(value));
  const isFocused = useRef(false);

  // Sync external value changes (e.g. Formik reset) when not actively editing
  useEffect(() => {
    if (!isFocused.current) {
      setDisplay(formatThousands(value));
    }
  }, [value]);

  function handleFocus() {
    isFocused.current = true;
  }

  function handleBlur() {
    isFocused.current = false;
    // Re-format on blur (normalizes edge cases like "010.000")
    setDisplay(formatThousands(value));
    onBlur?.();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parseRaw(e.target.value);
    const formatted = formatThousands(parsed);
    setDisplay(formatted);
    onChange(parsed);
  }

  // Prevent accidental value changes via scroll wheel
  function handleWheel(e: React.WheelEvent<HTMLInputElement>) {
    e.currentTarget.blur();
  }

  // Allow only digit keys, control keys and clipboard paste
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End',
    ];
    if (allowed.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) return;
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <span>{label}</span>
          {labelAdornment}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400 select-none">
          $
        </span>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            'block w-full rounded-lg border py-2 pl-7 pr-14 text-sm shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500',
            'transition-colors duration-150',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            error
              ? 'border-red-300 bg-red-50 text-red-900 placeholder:text-red-300'
              : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
            className
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 select-none">
          {currency}
        </span>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
