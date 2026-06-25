import { CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LabourAttendanceTable } from "@/components/casualLabour/LabourAttendanceTable";
import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  LABOUR_RECORD_STATUS_LABELS,
  LABOUR_VENDORS,
} from "@/constants/casualLabour";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import {
  calculateLabourCostSummary,
  casualLabourService,
} from "@/services/casualLabourService";
import type {
  CasualLabourAttendance,
  LabourFilters,
  LabourRecordStatus,
} from "@/types/casualLabour";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function LabourRegisterPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [filters, setFilters] = useState<LabourFilters>({
    month: new Date().toISOString().slice(0, 7),
    projectId: "",
    vendorId: "",
    status: "all",
  });
  const [records, setRecords] = useState<CasualLabourAttendance[]>([]);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    void casualLabourService.listAttendance(user, filters).then(setRecords);
  }, [filters, user]);

  if (!user) {
    return null;
  }

  const canApprove = ["manager", "admin_hr", "super_admin"].includes(user.role);
  const pending = records.filter((record) => record.status === "submitted");

  function update<Key extends keyof LabourFilters>(
    key: Key,
    value: LabourFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function approveAll() {
    if (!user) {
      return;
    }
    setApproving(true);
    try {
      for (const record of pending) {
        await casualLabourService.approveAttendance(record.id, user);
      }
      const refreshed = await casualLabourService.listAttendance(user, filters);
      setRecords(refreshed);
      toast.success("Pending labour attendance approved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Wage Register"
        description="Review labour attendance, attendance status, overtime and wage cost by month."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Casual Labour", to: "/casual-labour" },
          { label: "Register" },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            {canApprove && pending.length > 0 ? (
              <Button
                type="button"
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                isLoading={approving}
                onClick={() => void approveAll()}
              >
                Approve Pending
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
              onClick={() => downloadRegisterCsv(records)}
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
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          <FormField label="Vendor">
            <select
              className={selectClass}
              value={filters.vendorId ?? ""}
              onChange={(event) => update("vendorId", event.target.value)}
            >
              <option value="">All Vendors</option>
              {LABOUR_VENDORS.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status">
            <select
              className={selectClass}
              value={filters.status ?? "all"}
              onChange={(event) =>
                update("status", event.target.value as LabourRecordStatus | "all")
              }
            >
              <option value="all">All Statuses</option>
              {Object.entries(LABOUR_RECORD_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
        </CardContent>
      </Card>

      <LabourAttendanceTable records={records} emptyTitle="No wage records found" />
    </>
  );
}

function downloadRegisterCsv(records: CasualLabourAttendance[]) {
  const header = [
    "Attendance",
    "Date",
    "Project",
    "Vendor",
    "Status",
    "Present",
    "Half Day",
    "OT Hours",
    "Total Cost",
  ];
  const rows = records.map((record) => {
    const cost = calculateLabourCostSummary(record);
    return [
      record.attendanceNumber,
      record.date,
      record.projectName,
      record.vendorName,
      record.status,
      String(cost.presentCount),
      String(cost.halfDayCount),
      String(cost.overtimeHours),
      String(cost.totalCost),
    ];
  });
  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "labour-wage-register.csv";
  link.click();
  URL.revokeObjectURL(url);
}
