import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/Badge";
import type { ModuleDefinition } from "@/types/modules";
import { cn } from "@/utils/cn";

const accentClasses: Record<ModuleDefinition["accent"], string> = {
  blue: "bg-brand-light text-brand-blue",
  green: "bg-green-50 text-brand-success",
  orange: "bg-orange-50 text-[#B56200]",
  red: "bg-red-50 text-brand-danger",
  slate: "bg-slate-100 text-slate-700",
};

export function ModuleTile({
  module,
  pendingCount,
}: {
  module: ModuleDefinition;
  pendingCount?: number;
}) {
  const Icon = module.icon;

  return (
    <Link
      to={module.path}
      className="group flex min-h-44 flex-col justify-between rounded-lg border border-surface-border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-elevated focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg",
              accentClasses[module.accent],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          {pendingCount && pendingCount > 0 ? (
            <Badge tone="warning">{pendingCount} pending</Badge>
          ) : null}
        </div>
        <h3 className="mt-4 text-base font-bold text-text-primary">
          {module.name}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-5 text-text-secondary">
          {module.description}
        </p>
      </div>
      <div className="mt-5 flex items-center text-sm font-semibold text-brand-blue">
        Open
        <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
