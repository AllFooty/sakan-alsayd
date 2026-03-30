'use client';

import { forwardRef, type ChangeEvent } from 'react';
import { Input, type InputProps } from './Input';
import { sanitizePhoneInput } from '@/lib/utils';

export interface PhoneInputProps extends Omit<InputProps, 'type' | 'inputMode' | 'maxLength' | 'dir'> {
  formatHint?: string;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ onChange, formatHint, helperText, placeholder = '05XXXXXXXX', ...props }, ref) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      e.target.value = sanitizePhoneInput(e.target.value);
      onChange?.(e);
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        dir="ltr"
        maxLength={10}
        autoComplete="tel-local"
        placeholder={placeholder}
        helperText={formatHint || helperText}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
