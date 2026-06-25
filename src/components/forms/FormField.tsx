import { type ReactNode } from "react";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-semibold text-text-primary"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-brand-danger">{error}</p>
      ) : null}
      {!error && hint ? <p className="text-xs text-text-secondary">{hint}</p> : null}
    </div>
  );
}
