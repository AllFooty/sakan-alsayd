'use client';

import { AlertCircle } from 'lucide-react';

interface FieldErrorProps {
  id: string;
  message?: string;
  withIcon?: boolean;
}

// Pair `id` with the input's `aria-describedby` so screen readers announce the
// error message when it appears. `role="alert"` makes the <p> a polite live
// region, so a freshly-rendered error is read out without focus changes.
export default function FieldError({ id, message, withIcon = false }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-center gap-1 text-sm text-red-500 dark:text-red-400"
    >
      {withIcon && <AlertCircle size={12} />}
      {message}
    </p>
  );
}
