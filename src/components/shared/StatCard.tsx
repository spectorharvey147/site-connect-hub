import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { DashboardMetric } from "@/types/dashboard";

const trendIcon = {
  success: ArrowUpRight,
  danger: ArrowDownRight,
};

export function StatCard({
  metric,
  icon,
}: {
  metric: DashboardMetric;
  icon?: ReactNode;
}) {
  const TrendIcon =
    metric.tone === "success" || metric.tone === "danger"
      ? trendIcon[metric.tone]
      : null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-text-secondary">
            {metric.label}
          </p>
          <p className="mt-2 text-2xl font-bold text-text-primary">
            {metric.value}
          </p>
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-blue">
            {icon}
          </div>
        ) : null}
      </div>
      {metric.trend ? (
        <div className="mt-4">
          <Badge tone={metric.tone}>
            {TrendIcon ? <TrendIcon className="mr-1 h-3.5 w-3.5" /> : null}
            {metric.trend}
          </Badge>
        </div>
      ) : null}
    </Card>
  );
}
