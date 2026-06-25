import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-card">
      <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
        {label}
      </div>
    </div>
  );
}
