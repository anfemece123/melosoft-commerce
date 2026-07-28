import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/Input';
import { sanitizePhoneInput } from '@/lib/phone/phoneValidation';

type PhoneInputProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'pattern' | 'maxLength' | 'value' | 'onChange'
> & {
  value: string | null | undefined;
  onValueChange: (value: string) => void;
};

export function PhoneInput({ value, onValueChange, autoComplete = 'tel', ...props }: PhoneInputProps) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={12}
      autoComplete={autoComplete}
      value={value ?? ''}
      onChange={(event) => onValueChange(sanitizePhoneInput(event.target.value))}
    />
  );
}
