import { Download, FileSpreadsheet, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { DprTable } from "@/components/fieldOperations/DprTable";
import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DPR_STATUS_LABELS } from "@/constants/fieldOperations";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { fieldOperationsService } from "@/services/fieldOperationsService";
import type {
  DailyProgressReport,
  DprFilters,
  DprStatus,
} from "@/types/fieldOperations";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function DprHistoryPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [filters, setFilters] = useState<DprFilters>({
    month: new Date().toISOString().slice(0, 7),
    status: "all",
    projectId: "",
    search: "",
  });
  const [reports, setReports] = useState<DailyProgressReport[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void fieldOperationsService.listReports(user, filters).then(setReports);
  }, [filters, user]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof DprFilters>(
    key: Key,
    value: DprFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <PageHeader
        title="DPR History"
        description="Review submitted DPRs by month, project, status and keyword."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Field Operations", to: "/field-operations" },
          { label: "History" },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={() => void downloadDprPdf(reports)}
            >
              PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
              onClick={() => downloadDprCsv(reports)}
            >
              CSV
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Month"
              type="month"
              value={filters.month ?? ""}
              onChange={(event) => update("month", event.target.value)}
            />
            <FormField label="Project">
              <select
                className={selectClass}
                value={filters.projectId ?? ""}
                onChange={(event) => update("projectId", event.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status">
              <select
                className={selectClass}
                value={filters.status ?? "all"}
                onChange={(event) =>
                  update("status", event.target.value as DprStatus | "all")
                }
              >
                <option value="all">All Statuses</option>
                {Object.entries(DPR_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <Input
              label="Search"
              value={filters.search ?? ""}
              leftIcon={<Search className="h-4 w-4" />}
              onChange={(event) => update("search", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <DprTable reports={reports} emptyTitle="No DPRs match the filters" />
    </>
  );
}

async function downloadDprPdf(reports: DailyProgressReport[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Site Connect DPR History", 20, 20);
  doc.setFontSize(10);
  reports.slice(0, 24).forEach((report, index) => {
    const y = 34 + index * 8;
    doc.text(
      `${report.dprNumber} | ${report.reportDate} | ${report.projectName} | ${report.status}`,
      20,
      y,
    );
  });
  doc.save("dpr-history.pdf");
}

function downloadDprCsv(reports: DailyProgressReport[]) {
  const header = [
    "DPR Number",
    "Date",
    "Project",
    "Submitted By",
    "Status",
    "Activities",
    "Photos",
    "Pending Issues",
  ];
  const rows = reports.map((report) => [
    report.dprNumber,
    report.reportDate,
    report.projectName,
    report.submittedByName,
    report.status,
    String(report.activities.length),
    String(report.photos.length),
    String(report.issues.filter((issue) => issue.status === "pending").length),
  ]);
  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dpr-history.csv";
  link.click();
  URL.revokeObjectURL(url);
}
