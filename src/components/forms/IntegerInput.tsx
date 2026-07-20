import { useState, useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';
import { parseIntegerFieldValue, type NumericFieldValue } from '@/lib/forms/numericInput.utils';

interface IntegerInputProps {
  id?: string;
  name?: string;
  label?: string;
  value: NumericFieldValue;
  onChange: (value: NumericFieldValue) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  /** Short unit label rendered inside the field, e.g. "uds.", "min". */
  suffix?: string;
}

/** Whole-number counterpart to MoneyInput — same internal-display-string +
 * isFocused-ref pattern (so external value changes, e.g. a wizard draft
 * reset, don't clobber what the user is mid-typing), but for plain integers
 * instead of COP-formatted currency: no thousands separator, no `$`
 * prefix. Renders `type="text" inputMode="numeric"` rather than
 * `type="number"` — native number inputs change value on scroll, accept
 * `e`/`+`/`-` keystrokes, and render inconsistent mobile keyboards, none of
 * which this project wants.
 *
 * Never coerces an empty field to 0: clearing the input calls
 * `onChange('')` and stays empty until the user types a digit again.
 * Range/required validation is deliberately NOT enforced here — pass an
 * `error` computed via `validateIntegerField` (numericInput.utils.ts) so
 * out-of-range input surfaces as a visible message instead of a silent
 * clamp. */
export function IntegerInput({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  min,
  max,
  placeholder,
  hint,
  error,
  disabled = false,
  className,
  suffix,
}: IntegerInputProps) {
  const [display, setDisplay] = useState(() => (value === '' ? '' : String(value)));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setDisplay(value === '' ? '' : String(value));
  }, [value]);

  function handleFocus() {
    isFocused.current = true;
  }

  function handleBlur() {
    isFocused.current = false;
    setDisplay(value === '' ? '' : String(value));
    onBlur?.();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parseIntegerFieldValue(e.target.value);
    setDisplay(parsed === '' ? '' : String(parsed));
    onChange(parsed);
  }

  // Prevent accidental value changes via scroll wheel (only matters for
  // type="number", but harmless to keep for consistency with Input/MoneyInput).
  function handleWheel(e: React.WheelEvent<HTMLInputElement>) {
    e.currentTarget.blur();
  }

  // Allow only digit keys, control keys and clipboard paste — blocks "e",
  // "+", "-", "." before they ever reach handleChange.
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
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          min={min}
          max={max}
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
            'block w-full rounded-lg border py-2 px-3 text-sm shadow-sm',
            suffix && 'pr-12',
            'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500',
            'transition-colors duration-150',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            error
              ? 'border-red-300 bg-red-50 text-red-900 placeholder:text-red-300'
              : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
            className
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 select-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
