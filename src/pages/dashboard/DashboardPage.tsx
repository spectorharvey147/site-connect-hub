import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ReceiptText,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatCard } from "@/components/shared/StatCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/useAuth";
import { dashboardService } from "@/services/dashboardService";
import type { DashboardSummary } from "@/types/dashboard";

const icons = [
  <ReceiptText key="claims" className="h-5 w-5" />,
  <CalendarDays key="calendar" className="h-5 w-5" />,
  <ClipboardCheck key="tasks" className="h-5 w-5" />,
  <BarChart3 key="chart" className="h-5 w-5" />,
];

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      return;
    }
    void dashboardService.getSummary(user).then(setSummary);
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${ROLE_LABELS[user.role]} summary with current operational signals.`}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Dashboard" },
        ]}
      />

      {!summary ? <LoadingState label="Loading live dashboard" /> : null}
      {summary ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.metrics.map((metric, index) => (
          <StatCard key={metric.label} metric={metric} icon={icons[index]} />
        ))}
      </div> : null}

      {summary ? <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Workload Snapshot</CardTitle>
            <CardDescription>
              Live records visible to your role, department and project scope.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0066CC" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest attendance, claim, task and configuration events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.activities.length === 0 ? (
              <EmptyState
                title="No recent activity"
                description="New claims, tasks and leave activity will appear here."
              />
            ) : summary.activities.map((activity) => (
              <div
                key={activity.id}
                className="rounded-lg border border-surface-border bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-text-primary">
                    {activity.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-text-secondary">
                    {activity.module}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-text-secondary">
                  {activity.description}
                </p>
                <p className="mt-3 text-xs font-semibold text-text-tertiary">
                  {activity.timestamp}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div> : null}
    </>
  );
}
