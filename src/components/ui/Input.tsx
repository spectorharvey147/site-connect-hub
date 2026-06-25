import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      className,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="space-y-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="block text-[13px] font-semibold text-text-primary"
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leftIcon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-text-tertiary">
              {leftIcon}
            </span>
          ) : null}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "h-11 w-full rounded-md border border-surface-border bg-surface-card px-3 text-sm text-text-primary shadow-sm outline-none transition placeholder:text-text-tertiary focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:cursor-not-allowed disabled:bg-slate-100",
              leftIcon ? "pl-10" : null,
              rightIcon ? "pr-10" : null,
              error ? "border-brand-danger focus:border-brand-danger focus:ring-brand-danger/15" : null,
              className,
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />
          {rightIcon ? (
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 text-text-tertiary">
              {rightIcon}
            </span>
          ) : null}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-xs font-medium text-brand-danger">
            {error}
          </p>
        ) : null}
        {!error && hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-text-secondary">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
