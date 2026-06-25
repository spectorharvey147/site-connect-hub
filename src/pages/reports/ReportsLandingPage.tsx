import { Download, FileText, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  buildExportRows,
  REPORT_DEFINITIONS,
  reportsService,
} from "@/services/reportsService";
import { useAuth } from "@/hooks/useAuth";
import type { ReportsDashboard } from "@/types/reports";
import { formatCurrency } from "@/utils/format";

const statusTone = {
  healthy: "success",
  watch: "warning",
  risk: "danger",
} as const;

export function ReportsLandingPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ReportsDashboard | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    void reportsService.getDashboard(user).then(setDashboard);
  }, [user]);

  if (!user || !dashboard) {
    return null;
  }

  const maxFinance = Math.max(...dashboard.financeTrend.map((item) => item.value), 1);
  const maxOperations = Math.max(
    ...dashboard.operationsMix.map((item) => item.value),
    1,
  );

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description="Cross-module operational and financial reporting with export-ready summaries."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Reports" }]}
        action={
          <Button
            type="button"
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => exportReportCsv(dashboard)}
          >
            CSV
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <StatCard
            key={metric.label}
            metric={metric}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Module Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {dashboard.moduleSummaries.map((summary) => (
              <Link
                key={summary.module}
                to={summary.link}
                className="rounded-lg border border-surface-border p-4 text-sm transition hover:border-brand-blue hover:bg-brand-light/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-text-primary">{summary.module}</p>
                  <Badge tone={statusTone[summary.status]}>{summary.status}</Badge>
                </div>
                <p className="mt-3 text-lg font-bold text-brand-blue">
                  {summary.primaryMetric}
                </p>
                <p className="mt-1 text-text-secondary">{summary.secondaryMetric}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Finance Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.financeTrend.map((item) => (
              <Bar
                key={item.label}
                label={item.label}
                value={formatCurrency(item.value)}
                percent={(item.value / maxFinance) * 100}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operations Mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.operationsMix.map((item) => (
              <Bar
                key={item.label}
                label={item.label}
                value={String(item.value)}
                percent={(item.value / maxOperations) * 100}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Exceptions</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.exceptions.length === 0 ? (
            <p className="text-sm text-text-secondary">No cross-module exceptions.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {dashboard.exceptions.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm font-semibold text-[#B56200]"
                >
                  <FileText className="mr-2 inline h-4 w-4" />
                  {item}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Detailed Report Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {REPORT_DEFINITIONS.map((report) => (
              <Link
                key={report.key}
                to={`/reports/${report.key}`}
                className="rounded-lg border border-surface-border p-4 transition hover:border-brand-blue hover:bg-brand-light/40"
              >
                <p className="text-xs font-semibold uppercase text-text-secondary">{report.module}</p>
                <p className="mt-1 font-bold text-text-primary">{report.title}</p>
                <p className="mt-2 text-xs leading-5 text-text-secondary">{report.description}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Bar({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-text-primary">{label}</span>
        <span className="text-text-secondary">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-brand-blue"
          style={{ width: `${Math.max(percent, 8)}%` }}
        />
      </div>
    </div>
  );
}

function exportReportCsv(dashboard: ReportsDashboard) {
  const csv = buildExportRows(dashboard)
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "site-connect-reports.csv";
  link.click();
  URL.revokeObjectURL(url);
}
