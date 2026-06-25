import { Download, FileDown, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { reportsService } from "@/services/reportsService";
import type { DetailedReport } from "@/types/reports";

export function ReportDetailPage() {
  const { reportKey = "claim-ageing" } = useParams();
  const { user } = useAuth();
  const [report, setReport] = useState<DetailedReport | null>(null);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (user) void reportsService.getDetailedReport(reportKey, user).then(setReport);
  }, [reportKey, user]);

  const rows = useMemo(() => {
    if (!report) return [];
    const needle = search.trim().toLowerCase();
    return report.rows.filter((row) => {
      const text = row.join(" ").toLowerCase();
      const rowDate = String(row[0] ?? "");
      return (
        (!needle || text.includes(needle)) &&
        (!fromDate || !/^\d{4}-\d{2}-\d{2}/.test(rowDate) || rowDate >= fromDate) &&
        (!toDate || !/^\d{4}-\d{2}-\d{2}/.test(rowDate) || rowDate <= toDate)
      );
    });
  }, [fromDate, report, search, toDate]);

  const chartRows = useMemo(() => buildChartRows(rows), [rows]);
  const maxChartValue = Math.max(...chartRows.map((row) => row.value), 1);

  if (!user || !report) return null;

  return (
    <>
      <PageHeader
        title={report.definition.title}
        description={report.definition.description}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Reports", to: "/reports" },
          { label: report.definition.title },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<FileDown className="h-4 w-4" />}
              onClick={() => exportPdf(report)}
            >
              PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => exportCsv(report, rows)}
            >
              CSV
            </Button>
          </div>
        }
      />
      <Card className="mb-6 print:border-0 print:shadow-none">
        <CardContent className="flex flex-col gap-3 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              Site Connect
            </p>
            <h2 className="mt-1 text-xl font-bold text-text-primary">
              IPI Site Connect Report
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {report.definition.module} • {report.definition.title} • Generated for{" "}
              {user.fullName}
            </p>
          </div>
          <div className="text-sm text-text-secondary">
            <p>Generated: {new Date().toISOString().slice(0, 10)}</p>
            <p>Scope: role and hierarchy filtered data</p>
          </div>
        </CardContent>
      </Card>
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {report.metrics.map((metric) => (
          <StatCard key={metric.label} metric={metric} />
        ))}
        <StatCard
          metric={{
            label: "Filtered rows",
            value: String(rows.length),
            tone: rows.length > 0 ? "success" : "warning",
          }}
        />
      </div>
      <Card className="mb-6">
        <CardHeader><CardTitle>Report Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Input
            label="Search"
            value={search}
            leftIcon={<Filter className="h-4 w-4" />}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Input label="From Date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <Input label="To Date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader><CardTitle>Report Chart</CardTitle></CardHeader>
        <CardContent>
          {chartRows.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No numeric values are available for this filtered report view.
            </p>
          ) : (
            <div className="space-y-4">
              {chartRows.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-text-primary">{item.label}</span>
                    <span className="text-text-secondary">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-brand-blue"
                      style={{ width: `${Math.max((item.value / maxChartValue) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{rows.length} report rows</CardTitle></CardHeader>
        <CardContent>
          {!rows.length ? (
            <EmptyState title="No matching report records" description="Adjust the report filters and try again." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-border text-sm">
                <thead className="bg-slate-50">
                  <tr>{report.headers.map((header) => <th key={header} className="px-3 py-3 text-left text-xs font-semibold text-text-secondary">{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rows.map((row, index) => (
                    <tr key={`${report.definition.key}-${index}`}>
                      {row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-3 py-3">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function buildChartRows(rows: DetailedReport["rows"]) {
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    const label = String(row[1] ?? row[0] ?? "Record");
    const numericValue = [...row]
      .reverse()
      .find((cell) => typeof cell === "number" && Number.isFinite(cell));
    if (typeof numericValue !== "number") {
      return;
    }
    totals.set(label, (totals.get(label) ?? 0) + numericValue);
  });

  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);
}

function exportPdf(report: DetailedReport) {
  const previousTitle = document.title;
  document.title = `${report.definition.title} - Site Connect`;
  window.print();
  document.title = previousTitle;
}

function exportCsv(report: DetailedReport, rows: DetailedReport["rows"]) {
  const csv = [report.headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.definition.key}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
