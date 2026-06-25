import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ id, label, error, hint, className, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;

    return (
      <div className="space-y-1.5">
        {label ? (
          <label
            htmlFor={textareaId}
            className="block text-[13px] font-semibold text-text-primary"
          >
            {label}
          </label>
        ) : null}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            "min-h-28 w-full resize-y rounded-md border border-surface-border bg-surface-card px-3 py-2.5 text-sm text-text-primary shadow-sm outline-none transition placeholder:text-text-tertiary focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 disabled:cursor-not-allowed disabled:bg-slate-100",
            error ? "border-brand-danger focus:border-brand-danger focus:ring-brand-danger/15" : null,
            className,
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined
          }
          {...props}
        />
        {error ? (
          <p
            id={`${textareaId}-error`}
            className="text-xs font-medium text-brand-danger"
          >
            {error}
          </p>
        ) : null}
        {!error && hint ? (
          <p id={`${textareaId}-hint`} className="text-xs text-text-secondary">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
