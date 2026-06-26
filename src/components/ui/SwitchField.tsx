interface SwitchFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
}

export function SwitchField({
  id,
  label,
  checked,
  onChange,
  description,
  disabled = false,
}: SwitchFieldProps) {
  return (
    <label
      htmlFor={id}
      className={[
        'flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-gray-300',
      ].join(' ')}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description ? <p className="mt-1 text-xs text-gray-500">{description}</p> : null}
      </div>

      <div className="relative shrink-0 pt-0.5">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-indigo-600" />
        <div className="absolute left-0.5 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </div>
    </label>
  );
}
