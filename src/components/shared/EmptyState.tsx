import { Inbox } from "lucide-react";
import { type ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-surface-border bg-surface-card p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-blue">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-bold text-text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
